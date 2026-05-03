package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"gotogether-backend/internal/models"
)

const (
	defaultOpenAITextModel = "gpt-4.1-mini"
	openAIResponsesURL     = "https://api.openai.com/v1/responses"
)

type ItineraryDraftInput struct {
	TripName     string
	Destination  string
	StartDate    string
	EndDate      string
	CrewNames    []string
	PlanningNote string
}

type DestinationBriefInput struct {
	Destination string
	StartDate   string
	EndDate     string
}

type openAIResponsesRequest struct {
	Model           string `json:"model"`
	Input           []any  `json:"input"`
	MaxOutputTokens int    `json:"max_output_tokens,omitempty"`
	Text            struct {
		Format struct {
			Type string `json:"type"`
		} `json:"format"`
	} `json:"text"`
}

type openAIResponsesResponse struct {
	Output []struct {
		Type    string `json:"type"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	} `json:"output"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type openAIErrorResponse struct {
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type rawItineraryDraft struct {
	Days []struct {
		Title     string `json:"title"`
		DateLabel string `json:"dateLabel"`
		Events    []struct {
			Title     string   `json:"title"`
			Time      string   `json:"time"`
			Location  string   `json:"location"`
			Notes     string   `json:"notes"`
			Attendees []string `json:"attendees"`
			Status    string   `json:"status"`
		} `json:"events"`
	} `json:"days"`
}

func GenerateItineraryDraft(ctx context.Context, input ItineraryDraftInput) ([]models.ItineraryDayPayload, error) {
	responseText, err := createJSONResponse(ctx, itineraryDraftInstructions(), itineraryDraftPrompt(input), 2600)
	if err != nil {
		return nil, err
	}

	var payload rawItineraryDraft
	if err := json.Unmarshal([]byte(responseText), &payload); err != nil {
		return nil, fmt.Errorf("failed to parse itinerary draft: %w", err)
	}

	days := make([]models.ItineraryDayPayload, 0, len(payload.Days))
	for dayIndex, day := range payload.Days {
		title := strings.TrimSpace(day.Title)
		if title == "" {
			title = fmt.Sprintf("Day %d", dayIndex+1)
		}

		dateLabel := strings.TrimSpace(day.DateLabel)
		if dateLabel == "" {
			dateLabel = title
		}

		events := make([]models.ItineraryEventPayload, 0, len(day.Events))
		for _, event := range day.Events {
			eventTitle := strings.TrimSpace(event.Title)
			eventTime := strings.TrimSpace(event.Time)
			if eventTitle == "" || eventTime == "" {
				continue
			}

			location := strings.TrimSpace(event.Location)
			if location == "" {
				location = "Location TBD"
			}

			notes := strings.TrimSpace(event.Notes)
			if notes == "" {
				notes = "AI-suggested stop for your trip."
			}

			attendees := sanitizeAttendees(event.Attendees, input.CrewNames)
			events = append(events, models.ItineraryEventPayload{
				Title:            eventTitle,
				Time:             eventTime,
				Location:         location,
				LocationIsMapped: false,
				Notes:            notes,
				Attendees:        attendees,
				Status:           normalizeDraftStatus(event.Status),
			})
		}

		days = append(days, models.ItineraryDayPayload{
			Title:     title,
			DateLabel: dateLabel,
			Status:    "upcoming",
			Events:    events,
		})
	}

	if len(days) == 0 {
		return nil, errors.New("itinerary draft was empty")
	}

	return days, nil
}

func GenerateDestinationBrief(ctx context.Context, input DestinationBriefInput) (models.DestinationBriefResponse, error) {
	responseText, err := createJSONResponse(ctx, destinationBriefInstructions(), destinationBriefPrompt(input), 1200)
	if err != nil {
		return models.DestinationBriefResponse{}, err
	}

	var payload models.DestinationBriefResponse
	if err := json.Unmarshal([]byte(responseText), &payload); err != nil {
		return models.DestinationBriefResponse{}, fmt.Errorf("failed to parse destination brief: %w", err)
	}

	payload.Vibe = strings.TrimSpace(payload.Vibe)
	payload.IdealFor = strings.TrimSpace(payload.IdealFor)
	payload.Pace = strings.TrimSpace(payload.Pace)
	payload.Highlights = sanitizeStringList(payload.Highlights, 4)
	payload.PlanningTips = sanitizeStringList(payload.PlanningTips, 3)

	if payload.Vibe == "" && payload.IdealFor == "" && len(payload.Highlights) == 0 {
		return models.DestinationBriefResponse{}, errors.New("destination brief was empty")
	}

	return payload, nil
}

func createJSONResponse(ctx context.Context, instructions string, prompt string, maxTokens int) (string, error) {
	apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
	if apiKey == "" {
		return "", errors.New("OPENAI_API_KEY is not configured")
	}

	requestBody := openAIResponsesRequest{
		Model:           strings.TrimSpace(firstNonEmpty(os.Getenv("OPENAI_TEXT_MODEL"), defaultOpenAITextModel)),
		MaxOutputTokens: maxTokens,
		Input: []any{
			map[string]any{
				"role": "developer",
				"content": []map[string]string{
					{"type": "input_text", "text": instructions},
				},
			},
			map[string]any{
				"role": "user",
				"content": []map[string]string{
					{"type": "input_text", "text": prompt},
				},
			},
		},
	}
	requestBody.Text.Format.Type = "json_object"

	body, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("failed to encode openai request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openAIResponsesURL, strings.NewReader(string(body)))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to call openai responses api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var openAIError openAIErrorResponse
		if err := json.NewDecoder(resp.Body).Decode(&openAIError); err == nil && openAIError.Error != nil && strings.TrimSpace(openAIError.Error.Message) != "" {
			return "", fmt.Errorf("openai responses api failed: %s", strings.TrimSpace(openAIError.Error.Message))
		}
		return "", fmt.Errorf("openai responses api failed with status %d", resp.StatusCode)
	}

	responseBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read openai response: %w", err)
	}

	var payload openAIResponsesResponse
	if err := json.Unmarshal(responseBytes, &payload); err != nil {
		return "", fmt.Errorf("failed to parse openai response envelope: %w", err)
	}

	if payload.Error != nil && strings.TrimSpace(payload.Error.Message) != "" {
		return "", errors.New(strings.TrimSpace(payload.Error.Message))
	}

	responseText := extractResponseText(payload)
	if strings.TrimSpace(responseText) == "" {
		return "", errors.New("openai response did not include text output")
	}

	return responseText, nil
}

func extractResponseText(payload openAIResponsesResponse) string {
	var builder strings.Builder
	for _, item := range payload.Output {
		for _, content := range item.Content {
			if strings.Contains(strings.ToLower(content.Type), "text") && strings.TrimSpace(content.Text) != "" {
				if builder.Len() > 0 {
					builder.WriteString("\n")
				}
				builder.WriteString(content.Text)
			}
		}
	}
	return strings.TrimSpace(builder.String())
}

func itineraryDraftInstructions() string {
	return "You are a premium travel planner. Return valid JSON only. Create a realistic multi-day itinerary draft that feels polished, balanced, and travel-ready. Use the exact JSON structure requested by the user. Times must look like '9:00 AM'. Keep each event practical, concise, and destination-specific."
}

func itineraryDraftPrompt(input ItineraryDraftInput) string {
	return fmt.Sprintf(`Return JSON with this shape:
{
  "days": [
    {
      "title": "Day 1",
      "dateLabel": "May 2",
      "events": [
        {
          "title": "string",
          "time": "9:00 AM",
          "location": "string",
          "notes": "string",
          "attendees": ["string"],
          "status": "upcoming"
        }
      ]
    }
  ]
}

Create a premium itinerary draft for this trip:
- Trip name: %s
- Destination: %s
- Start date: %s
- End date: %s
- Crew members: %s
- Planner notes: %s

Rules:
- Return JSON only.
- Create 1 day per trip day, up to 5 days.
- Create 3 or 4 events per day.
- Make activities varied across food, sightseeing, rest, and one memorable anchor moment.
- Keep attendee names limited to the provided crew names.
- Use status "upcoming" for every event.
- Use short practical notes, not essays.
- Avoid nightlife-only plans unless planner notes strongly suggest it.
`, input.TripName, input.Destination, input.StartDate, input.EndDate, strings.Join(input.CrewNames, ", "), firstNonEmpty(strings.TrimSpace(input.PlanningNote), "No extra notes provided."))
}

func destinationBriefInstructions() string {
	return "You are a concise luxury travel concierge. Return valid JSON only. Summarize the destination in a way that helps a group quickly understand the travel vibe and plan better."
}

func destinationBriefPrompt(input DestinationBriefInput) string {
	return fmt.Sprintf(`Return JSON with this shape:
{
  "vibe": "string",
  "ideal_for": "string",
  "pace": "string",
  "highlights": ["string"],
  "planning_tips": ["string"]
}

Destination: %s
Trip window: %s to %s

Rules:
- Return JSON only.
- Keep vibe, ideal_for, and pace to one sentence each.
- Provide exactly 4 highlights.
- Provide exactly 3 planning_tips.
- Focus on actionable travel planning, not generic tourism copy.
`, input.Destination, input.StartDate, input.EndDate)
}

func sanitizeAttendees(selected []string, crew []string) []string {
	allowed := map[string]bool{}
	for _, member := range crew {
		trimmed := strings.TrimSpace(member)
		if trimmed != "" {
			allowed[trimmed] = true
		}
	}

	result := make([]string, 0, len(selected))
	seen := map[string]bool{}
	for _, attendee := range selected {
		trimmed := strings.TrimSpace(attendee)
		if trimmed == "" || !allowed[trimmed] || seen[trimmed] {
			continue
		}
		seen[trimmed] = true
		result = append(result, trimmed)
	}

	if len(result) > 0 {
		return result
	}

	return sanitizeStringList(crew, len(crew))
}

func sanitizeStringList(values []string, maxItems int) []string {
	result := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" || seen[trimmed] {
			continue
		}
		seen[trimmed] = true
		result = append(result, trimmed)
		if maxItems > 0 && len(result) >= maxItems {
			break
		}
	}
	return result
}

func normalizeDraftStatus(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "active", "completed":
		return value
	default:
		return "upcoming"
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
