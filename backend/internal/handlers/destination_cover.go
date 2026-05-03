package handlers

import (
	"bytes"
	"database/sql"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/media"
	tripstorage "gotogether-backend/internal/storage"

	"github.com/gin-gonic/gin"
)

var nonFileNameChars = regexp.MustCompile(`[^a-z0-9]+`)

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

	var destination string
	var existingImageURL string
	err := db.DB.QueryRow(`
		SELECT destination, COALESCE(image_url, '')
		FROM trips
		WHERE id = $1
	`, tripID).Scan(&destination, &existingImageURL)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load trip", "details": err.Error()})
		return
	}

	if strings.TrimSpace(existingImageURL) != "" {
		c.JSON(http.StatusOK, gin.H{
			"image_url": existingImageURL,
			"source":    "existing",
		})
		return
	}

	destinationKey := normalizeDestinationCoverKey(destination)
	if cachedImageURL, cachedSource, ok := loadCachedDestinationCover(destinationKey); ok {
		if _, err := db.DB.Exec(`UPDATE trips SET image_url = $1 WHERE id = $2`, cachedImageURL, tripID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save cached destination cover", "details": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"image_url": cachedImageURL,
			"source":    cachedSource,
		})
		return
	}

	imageBytes, contentType, source, err := media.ResolveDestinationCover(c.Request.Context(), destination)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to create destination cover", "details": err.Error()})
		return
	}

	filename := buildDestinationImageFilename(destination, contentType)
	imageURL, err := tripstorage.UploadTripCover(c.Request.Context(), tripID, userID, filename, contentType, bytes.NewReader(imageBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store destination cover", "details": err.Error()})
		return
	}

	if _, err := db.DB.Exec(`UPDATE trips SET image_url = $1 WHERE id = $2`, imageURL, tripID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save destination cover", "details": err.Error()})
		return
	}

	saveCachedDestinationCover(destinationKey, destination, imageURL, source)

	c.JSON(http.StatusOK, gin.H{
		"image_url": imageURL,
		"source":    source,
	})
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

func loadCachedDestinationCover(destinationKey string) (string, string, bool) {
	if destinationKey == "" {
		return "", "", false
	}

	var imageURL string
	var source string
	err := db.DB.QueryRow(`
		SELECT image_url, source
		FROM destination_cover_cache
		WHERE destination_key = $1
	`, destinationKey).Scan(&imageURL, &source)
	if err != nil || strings.TrimSpace(imageURL) == "" {
		return "", "", false
	}

	if strings.TrimSpace(source) == "" {
		source = "cache"
	}
	return imageURL, source, true
}

func saveCachedDestinationCover(destinationKey string, destination string, imageURL string, source string) {
	if destinationKey == "" || strings.TrimSpace(imageURL) == "" {
		return
	}

	if strings.TrimSpace(source) == "" {
		source = "unknown"
	}

	_, _ = db.DB.Exec(`
		INSERT INTO destination_cover_cache (destination_key, destination_label, image_url, source, updated_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
		ON CONFLICT (destination_key) DO UPDATE SET
			destination_label = EXCLUDED.destination_label,
			image_url = EXCLUDED.image_url,
			source = EXCLUDED.source,
			updated_at = CURRENT_TIMESTAMP
	`, destinationKey, strings.TrimSpace(destination), strings.TrimSpace(imageURL), strings.TrimSpace(source))
}
