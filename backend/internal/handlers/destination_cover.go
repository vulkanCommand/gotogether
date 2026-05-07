package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/media"
	"gotogether-backend/internal/places"
	tripstorage "gotogether-backend/internal/storage"

	"github.com/gin-gonic/gin"
)

var nonFileNameChars = regexp.MustCompile(`[^a-z0-9]+`)

type destinationCoverRecord struct {
	ImageURL  string
	Source    string
	PlaceID   string
	PhotoName string
}

func EnsureTripCoverFromDestination(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	tripID, ok := parseTripID(c)
	if !ok {
		return
	}

	if !ensureTripAccess(c, tripID, userID) {
		return
	}

	record, err := ensureTripCoverFromDestination(c.Request.Context(), tripID, userID, false)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to create destination cover", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"image_url": record.ImageURL,
		"source":    record.Source,
	})
}

func refreshTripCoverInBackground(tripID int, userID int, force bool) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()

		if _, err := ensureTripCoverFromDestination(ctx, tripID, userID, force); err != nil {
			log.Printf("trip cover refresh failed for trip %d: %v", tripID, err)
		}
	}()
}

func ensureTripCoverFromDestination(ctx context.Context, tripID int, userID int, force bool) (*destinationCoverRecord, error) {
	var destination string
	var existingImageURL string
	err := db.DB.QueryRow(`
		SELECT destination, COALESCE(image_url, '')
		FROM trips
		WHERE id = $1
	`, tripID).Scan(&destination, &existingImageURL)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("trip not found")
		}
		return nil, fmt.Errorf("failed to load trip: %w", err)
	}

	if !force && strings.TrimSpace(existingImageURL) != "" {
		return &destinationCoverRecord{
			ImageURL: existingImageURL,
			Source:   "existing",
		}, nil
	}

	destinationKey := normalizeDestinationCoverKey(destination)
	if cachedCover, ok := loadCachedDestinationCover(destinationKey); ok {
		if err := persistTripCoverRecord(tripID, cachedCover); err != nil {
			return nil, err
		}
		return &cachedCover, nil
	}

	var imageBytes []byte
	var contentType string
	var source string
	record := destinationCoverRecord{}

	placesCover, placeErr := places.ResolveDestinationCover(ctx, destination)
	if placeErr == nil {
		imageBytes = placesCover.ImageBytes
		contentType = placesCover.ContentType
		source = placesCover.Source
		record.PlaceID = placesCover.PlaceID
		record.PhotoName = placesCover.PhotoName
	} else {
		if !places.LegacyCoverFallbacksEnabled() {
			return nil, placeErr
		}
		imageBytes, contentType, source, err = media.ResolveDestinationCover(ctx, destination)
		if err != nil {
			return nil, placeErr
		}
	}

	filename := buildDestinationImageFilename(destination, contentType)
	imageURL, err := tripstorage.UploadTripCover(ctx, tripID, userID, filename, contentType, bytes.NewReader(imageBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to store destination cover: %w", err)
	}

	record.ImageURL = imageURL
	record.Source = source
	saveCachedDestinationCover(destinationKey, destination, record)

	if err := persistTripCoverRecord(tripID, record); err != nil {
		return nil, err
	}

	return &record, nil
}

func buildDestinationImageFilename(destination string, contentType string) string {
	base := strings.ToLower(strings.TrimSpace(destination))
	base = nonFileNameChars.ReplaceAllString(base, "-")
	base = strings.Trim(base, "-")
	if base == "" {
		base = "destination-cover"
	}

	extension := ".jpg"
	switch {
	case strings.Contains(strings.ToLower(contentType), "png"):
		extension = ".png"
	case strings.Contains(strings.ToLower(contentType), "webp"):
		extension = ".webp"
	}

	return fmt.Sprintf("%s%s", base, extension)
}

func normalizeDestinationCoverKey(destination string) string {
	key := strings.ToLower(strings.TrimSpace(destination))
	key = nonFileNameChars.ReplaceAllString(key, "-")
	key = strings.Trim(key, "-")
	return key
}

func loadCachedDestinationCover(destinationKey string) (destinationCoverRecord, bool) {
	if destinationKey == "" {
		return destinationCoverRecord{}, false
	}

	record := destinationCoverRecord{}
	err := db.DB.QueryRow(`
		SELECT image_url, source, COALESCE(google_place_id, ''), COALESCE(google_photo_name, '')
		FROM destination_cover_cache
		WHERE destination_key = $1
	`, destinationKey).Scan(&record.ImageURL, &record.Source, &record.PlaceID, &record.PhotoName)
	if err != nil || strings.TrimSpace(record.ImageURL) == "" {
		return destinationCoverRecord{}, false
	}

	if strings.TrimSpace(record.Source) == "" {
		record.Source = "cache"
	}
	return record, true
}

func saveCachedDestinationCover(destinationKey string, destination string, record destinationCoverRecord) {
	if destinationKey == "" || strings.TrimSpace(record.ImageURL) == "" {
		return
	}

	if strings.TrimSpace(record.Source) == "" {
		record.Source = "unknown"
	}

	_, _ = db.DB.Exec(`
		INSERT INTO destination_cover_cache (
			destination_key, destination_label, image_url, source, google_place_id, google_photo_name, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
		ON CONFLICT (destination_key) DO UPDATE SET
			destination_label = EXCLUDED.destination_label,
			image_url = EXCLUDED.image_url,
			source = EXCLUDED.source,
			google_place_id = EXCLUDED.google_place_id,
			google_photo_name = EXCLUDED.google_photo_name,
			updated_at = CURRENT_TIMESTAMP
	`, destinationKey, strings.TrimSpace(destination), strings.TrimSpace(record.ImageURL), strings.TrimSpace(record.Source), strings.TrimSpace(record.PlaceID), strings.TrimSpace(record.PhotoName))
}

func persistTripCoverRecord(tripID int, record destinationCoverRecord) error {
	if _, err := db.DB.Exec(`
		UPDATE trips
		SET image_url = $2,
			cover_photo_source = $3,
			google_place_id = NULLIF($4, ''),
			google_photo_name = NULLIF($5, ''),
			cover_updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, tripID, record.ImageURL, record.Source, record.PlaceID, record.PhotoName); err != nil {
		return fmt.Errorf("failed to save destination cover: %w", err)
	}
	return nil
}
