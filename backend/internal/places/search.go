package places

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"gotogether-backend/internal/models"
)

const userAgent = "GoTogetherBackend/1.0"

type nominatimResult struct {
	PlaceID     int64  `json:"place_id"`
	DisplayName string `json:"display_name"`
	Lat         string `json:"lat"`
	Lon         string `json:"lon"`
	Name        string `json:"name"`
}

func Search(ctx context.Context, query string) ([]models.PlaceSearchResult, error) {
	trimmedQuery := strings.TrimSpace(query)
	if trimmedQuery == "" {
		return []models.PlaceSearchResult{}, nil
	}

	endpoint := "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=" + url.QueryEscape(trimmedQuery)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("place search failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("place search failed with status %d", resp.StatusCode)
	}

	var payload []nominatimResult
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("failed to parse place search response: %w", err)
	}

	results := make([]models.PlaceSearchResult, 0, len(payload))
	for _, item := range payload {
		latitude, latErr := strconv.ParseFloat(strings.TrimSpace(item.Lat), 64)
		longitude, lonErr := strconv.ParseFloat(strings.TrimSpace(item.Lon), 64)
		if latErr != nil || lonErr != nil {
			continue
		}

		title, subtitle := splitDisplayName(item)
		results = append(results, models.PlaceSearchResult{
			ID:          fmt.Sprintf("osm-%d", item.PlaceID),
			Title:       title,
			Subtitle:    subtitle,
			Latitude:    latitude,
			Longitude:   longitude,
			Provider:    "openstreetmap",
			DisplayName: strings.TrimSpace(item.DisplayName),
		})
	}

	return results, nil
}

func splitDisplayName(item nominatimResult) (string, string) {
	displayName := strings.TrimSpace(item.DisplayName)
	name := strings.TrimSpace(item.Name)
	if name == "" {
		parts := strings.Split(displayName, ",")
		if len(parts) > 0 {
			name = strings.TrimSpace(parts[0])
		}
	}

	subtitle := displayName
	if name != "" && strings.HasPrefix(displayName, name) {
		subtitle = strings.TrimSpace(strings.TrimPrefix(displayName, name))
		subtitle = strings.TrimLeft(subtitle, ", ")
	}

	if subtitle == "" {
		subtitle = displayName
	}

	if name == "" {
		name = displayName
	}

	return name, subtitle
}
