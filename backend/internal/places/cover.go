package places

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	placesSearchEndpoint    = "https://places.googleapis.com/v1/places:searchText"
	placesPhotoMaxWidthPx   = 1600
	placesPhotoMaxHeightPx  = 1200
	placesMaxDownloadBytes  = 10 << 20
	placesRequestTimeout    = 12 * time.Second
	placesDownloadTimeout   = 20 * time.Second
	legacyCoverFallbacksEnv = "ENABLE_LEGACY_DESTINATION_COVER_FALLBACKS"
	openAICoverFallbacksEnv = "ENABLE_OPENAI_DESTINATION_COVER_FALLBACK"
)

type CoverResult struct {
	ImageBytes  []byte
	ContentType string
	Source      string
	PlaceID     string
	PhotoName   string
}

type textSearchRequest struct {
	TextQuery    string `json:"textQuery"`
	LanguageCode string `json:"languageCode,omitempty"`
	PageSize     int    `json:"pageSize,omitempty"`
}

type textSearchResponse struct {
	Places []struct {
		ID               string `json:"id"`
		FormattedAddress string `json:"formattedAddress"`
		DisplayName      struct {
			Text string `json:"text"`
		} `json:"displayName"`
		Photos []struct {
			Name string `json:"name"`
		} `json:"photos"`
	} `json:"places"`
}

type photoMediaResponse struct {
	Name     string `json:"name"`
	PhotoURI string `json:"photoUri"`
}

func ResolveDestinationCover(ctx context.Context, destination string) (CoverResult, error) {
	trimmedDestination := strings.TrimSpace(destination)
	if trimmedDestination == "" {
		return CoverResult{}, errors.New("destination is required")
	}

	apiKey := strings.TrimSpace(os.Getenv("GOOGLE_PLACES_API_KEY"))
	if apiKey == "" {
		return CoverResult{}, errors.New("GOOGLE_PLACES_API_KEY is not configured")
	}

	lookupCtx, cancel := context.WithTimeout(ctx, placesRequestTimeout)
	defer cancel()

	placeID, photoName, err := searchPlacePhoto(lookupCtx, apiKey, trimmedDestination)
	if err != nil {
		return CoverResult{}, err
	}

	photoCtx, photoCancel := context.WithTimeout(ctx, placesRequestTimeout)
	defer photoCancel()

	photoURI, err := resolvePhotoURI(photoCtx, apiKey, photoName)
	if err != nil {
		return CoverResult{}, err
	}

	downloadCtx, downloadCancel := context.WithTimeout(ctx, placesDownloadTimeout)
	defer downloadCancel()

	imageBytes, contentType, err := downloadRemoteImage(downloadCtx, photoURI)
	if err != nil {
		return CoverResult{}, err
	}

	return CoverResult{
		ImageBytes:  imageBytes,
		ContentType: contentType,
		Source:      "google_places",
		PlaceID:     placeID,
		PhotoName:   photoName,
	}, nil
}

func searchPlacePhoto(ctx context.Context, apiKey string, destination string) (string, string, error) {
	payload := textSearchRequest{
		TextQuery:    destination,
		LanguageCode: "en",
		PageSize:     5,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", "", fmt.Errorf("failed to encode place search request: %w", err)
	}

	endpoint := placesSearchEndpoint + "?key=" + url.QueryEscape(apiKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(body)))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("X-Goog-FieldMask", "places.id,places.displayName,places.formattedAddress,places.photos.name")

	client := &http.Client{Timeout: placesRequestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("google places text search failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
		return "", "", fmt.Errorf("google places text search failed with status %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
	}

	var payloadResp textSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&payloadResp); err != nil {
		return "", "", fmt.Errorf("failed to parse google places search response: %w", err)
	}

	for _, place := range payloadResp.Places {
		for _, photo := range place.Photos {
			if strings.TrimSpace(photo.Name) == "" {
				continue
			}
			return strings.TrimSpace(place.ID), strings.TrimSpace(photo.Name), nil
		}
	}

	return "", "", fmt.Errorf("google places returned no photos for %q", destination)
}

func resolvePhotoURI(ctx context.Context, apiKey string, photoName string) (string, error) {
	if strings.TrimSpace(photoName) == "" {
		return "", errors.New("photo name is required")
	}

	endpoint := fmt.Sprintf(
		"https://places.googleapis.com/v1/%s/media?maxWidthPx=%d&maxHeightPx=%d&skipHttpRedirect=true&key=%s",
		strings.TrimLeft(strings.TrimSpace(photoName), "/"),
		placesPhotoMaxWidthPx,
		placesPhotoMaxHeightPx,
		url.QueryEscape(apiKey),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", userAgent)

	client := &http.Client{Timeout: placesRequestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("google place photo lookup failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
		return "", fmt.Errorf("google place photo lookup failed with status %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
	}

	var payload photoMediaResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", fmt.Errorf("failed to parse google place photo response: %w", err)
	}
	if strings.TrimSpace(payload.PhotoURI) == "" {
		return "", errors.New("google place photo response did not include photoUri")
	}

	return strings.TrimSpace(payload.PhotoURI), nil
}

func downloadRemoteImage(ctx context.Context, imageURL string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", userAgent)

	client := &http.Client{Timeout: placesDownloadTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to download google places image: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("google places image download failed with status %d", resp.StatusCode)
	}

	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if !strings.HasPrefix(strings.ToLower(contentType), "image/") || strings.Contains(strings.ToLower(contentType), "svg") {
		return nil, "", fmt.Errorf("unsupported google places content type %q", contentType)
	}

	imageBytes, err := io.ReadAll(io.LimitReader(resp.Body, placesMaxDownloadBytes))
	if err != nil {
		return nil, "", fmt.Errorf("failed to read google places image bytes: %w", err)
	}
	if len(imageBytes) == 0 {
		return nil, "", errors.New("downloaded google places image was empty")
	}

	return imageBytes, contentType, nil
}

func LegacyCoverFallbacksEnabled() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv(legacyCoverFallbacksEnv)), "true")
}

func OpenAICoverFallbackEnabled() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv(openAICoverFallbacksEnv)), "true")
}
