package media

import (
	"context"
	"encoding/base64"
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
	defaultOpenAIImageModel = "gpt-image-1"
	defaultOpenAIImageSize  = "1536x1024"
	defaultUserAgent        = "GoTogetherBackend/1.0"
	maxRemoteImageBytes     = 8 << 20
)

type wikipediaSearchResponse struct {
	Query struct {
		Pages []struct {
			Title     string `json:"title"`
			Original  *struct {
				Source string `json:"source"`
			} `json:"original"`
			Thumbnail *struct {
				Source string `json:"source"`
			} `json:"thumbnail"`
		} `json:"pages"`
	} `json:"query"`
}

type pexelsSearchResponse struct {
	Photos []struct {
		Src struct {
			Large2x  string `json:"large2x"`
			Large    string `json:"large"`
			Original string `json:"original"`
		} `json:"src"`
	} `json:"photos"`
}

type unsplashSearchResponse struct {
	Results []struct {
		Urls struct {
			Regular string `json:"regular"`
			Full    string `json:"full"`
			Raw     string `json:"raw"`
		} `json:"urls"`
	} `json:"results"`
}

type openAIImageResponse struct {
	Data []struct {
		B64JSON string `json:"b64_json"`
	} `json:"data"`
}

type openAIErrorResponse struct {
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func ResolveDestinationCover(ctx context.Context, destination string) ([]byte, string, string, error) {
	trimmedDestination := strings.TrimSpace(destination)
	if trimmedDestination == "" {
		return nil, "", "", errors.New("destination is required")
	}

	if imageBytes, contentType, source, err := fetchStockDestinationImage(ctx, trimmedDestination); err == nil {
		return imageBytes, contentType, source, nil
	}

	if imageBytes, contentType, err := fetchWikipediaDestinationImage(ctx, trimmedDestination); err == nil {
		return imageBytes, contentType, "wikipedia", nil
	}

	openAIKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if openAIKey == "" {
		return nil, "", "", errors.New("no destination image found and OPENAI_API_KEY is not configured")
	}

	imageBytes, contentType, err := generateDestinationImageWithOpenAI(ctx, openAIKey, trimmedDestination)
	if err != nil {
		return nil, "", "", err
	}

	return imageBytes, contentType, "openai", nil
}

func fetchStockDestinationImage(ctx context.Context, destination string) ([]byte, string, string, error) {
	if apiKey := strings.TrimSpace(os.Getenv("PEXELS_API_KEY")); apiKey != "" {
		if imageBytes, contentType, err := fetchPexelsDestinationImage(ctx, apiKey, destination); err == nil {
			return imageBytes, contentType, "pexels", nil
		}
	}

	if accessKey := strings.TrimSpace(os.Getenv("UNSPLASH_ACCESS_KEY")); accessKey != "" {
		if imageBytes, contentType, err := fetchUnsplashDestinationImage(ctx, accessKey, destination); err == nil {
			return imageBytes, contentType, "unsplash", nil
		}
	}

	return nil, "", "", errors.New("no stock image provider configured or no stock image found")
}

func fetchPexelsDestinationImage(ctx context.Context, apiKey string, destination string) ([]byte, string, error) {
	endpoint := "https://api.pexels.com/v1/search?orientation=landscape&per_page=1&query=" + url.QueryEscape(destination+" travel destination")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", apiKey)
	req.Header.Set("User-Agent", defaultUserAgent)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to query pexels: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("pexels search failed with status %d", resp.StatusCode)
	}

	var payload pexelsSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, "", fmt.Errorf("failed to parse pexels response: %w", err)
	}

	for _, photo := range payload.Photos {
		candidates := []string{photo.Src.Large2x, photo.Src.Large, photo.Src.Original}
		for _, candidate := range candidates {
			if strings.TrimSpace(candidate) == "" {
				continue
			}
			imageBytes, contentType, err := downloadRemoteImage(ctx, candidate)
			if err == nil {
				return imageBytes, contentType, nil
			}
		}
	}

	return nil, "", errors.New("pexels did not return an image")
}

func fetchUnsplashDestinationImage(ctx context.Context, accessKey string, destination string) ([]byte, string, error) {
	endpoint := "https://api.unsplash.com/search/photos?orientation=landscape&per_page=1&query=" + url.QueryEscape(destination+" travel destination")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", "Client-ID "+accessKey)
	req.Header.Set("User-Agent", defaultUserAgent)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to query unsplash: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("unsplash search failed with status %d", resp.StatusCode)
	}

	var payload unsplashSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, "", fmt.Errorf("failed to parse unsplash response: %w", err)
	}

	for _, result := range payload.Results {
		candidates := []string{result.Urls.Regular, result.Urls.Full, result.Urls.Raw}
		for _, candidate := range candidates {
			if strings.TrimSpace(candidate) == "" {
				continue
			}
			imageBytes, contentType, err := downloadRemoteImage(ctx, candidate)
			if err == nil {
				return imageBytes, contentType, nil
			}
		}
	}

	return nil, "", errors.New("unsplash did not return an image")
}

func fetchWikipediaDestinationImage(ctx context.Context, destination string) ([]byte, string, error) {
	endpoint := "https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=" +
		url.QueryEscape(destination) +
		"&gsrlimit=1&prop=pageimages&piprop=thumbnail|original&pithumbsize=1600&format=json&formatversion=2"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", defaultUserAgent)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to query wikipedia: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("wikipedia search failed with status %d", resp.StatusCode)
	}

	var payload wikipediaSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, "", fmt.Errorf("failed to parse wikipedia search response: %w", err)
	}

	for _, page := range payload.Query.Pages {
		candidates := []string{}
		if page.Thumbnail != nil && strings.TrimSpace(page.Thumbnail.Source) != "" {
			candidates = append(candidates, strings.TrimSpace(page.Thumbnail.Source))
		}
		if page.Original != nil && strings.TrimSpace(page.Original.Source) != "" {
			candidates = append(candidates, strings.TrimSpace(page.Original.Source))
		}

		for _, candidate := range candidates {
			imageBytes, contentType, err := downloadRemoteImage(ctx, candidate)
			if err == nil {
				return imageBytes, contentType, nil
			}
		}
	}

	return nil, "", errors.New("wikipedia did not return an image")
}

func downloadRemoteImage(ctx context.Context, imageURL string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", defaultUserAgent)

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to download image: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("image download failed with status %d", resp.StatusCode)
	}

	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		return nil, "", fmt.Errorf("unsupported content type %q", contentType)
	}
	if strings.Contains(strings.ToLower(contentType), "svg") {
		return nil, "", fmt.Errorf("unsupported content type %q", contentType)
	}

	imageBytes, err := io.ReadAll(io.LimitReader(resp.Body, maxRemoteImageBytes))
	if err != nil {
		return nil, "", fmt.Errorf("failed to read image bytes: %w", err)
	}
	if len(imageBytes) == 0 {
		return nil, "", errors.New("downloaded image was empty")
	}

	return imageBytes, contentType, nil
}

func generateDestinationImageWithOpenAI(ctx context.Context, apiKey string, destination string) ([]byte, string, error) {
	payload := map[string]any{
		"model":  strings.TrimSpace(firstNonEmpty(os.Getenv("OPENAI_IMAGE_MODEL"), defaultOpenAIImageModel)),
		"prompt": buildDestinationPrompt(destination),
		"size":   strings.TrimSpace(firstNonEmpty(os.Getenv("OPENAI_IMAGE_SIZE"), defaultOpenAIImageSize)),
	}

	if quality := strings.TrimSpace(os.Getenv("OPENAI_IMAGE_QUALITY")); quality != "" {
		payload["quality"] = quality
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, "", fmt.Errorf("failed to encode openai request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.openai.com/v1/images/generations", strings.NewReader(string(body)))
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to call openai image generation: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var openAIError openAIErrorResponse
		if err := json.NewDecoder(resp.Body).Decode(&openAIError); err == nil && openAIError.Error != nil && strings.TrimSpace(openAIError.Error.Message) != "" {
			return nil, "", fmt.Errorf("openai image generation failed: %s", strings.TrimSpace(openAIError.Error.Message))
		}
		return nil, "", fmt.Errorf("openai image generation failed with status %d", resp.StatusCode)
	}

	var result openAIImageResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, "", fmt.Errorf("failed to parse openai image response: %w", err)
	}
	if len(result.Data) == 0 || strings.TrimSpace(result.Data[0].B64JSON) == "" {
		return nil, "", errors.New("openai image response did not include image data")
	}

	imageBytes, err := base64.StdEncoding.DecodeString(result.Data[0].B64JSON)
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode openai image data: %w", err)
	}

	return imageBytes, "image/png", nil
}

func buildDestinationPrompt(destination string) string {
	return fmt.Sprintf(
		"Create a vivid, realistic travel cover image for %s. Show the destination itself, landscape orientation, natural lighting, no text, no logos, no watermarks, and no people as the main subject. Make it feel like a premium trip-planning app hero image.",
		destination,
	)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
