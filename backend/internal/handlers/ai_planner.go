package handlers

import (
	"net/http"
	"strings"

	"gotogether-backend/internal/ai"
	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func GenerateTripItineraryDraft(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	tripID, ok := parseTripID(c)
	if !ok {
		return
	}

	if !ensureTripLeadAccess(c, tripID, userID) {
		return
	}

	var req models.GenerateItineraryDraftRequest
	if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	trip, crewNames, err := loadTripPlanningContext(tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load trip planning context", "details": err.Error()})
		return
	}

	days, err := ai.GenerateItineraryDraft(c.Request.Context(), ai.ItineraryDraftInput{
		TripName:     strings.TrimSpace(trip.Name),
		Destination:  strings.TrimSpace(trip.Destination),
		StartDate:    strings.TrimSpace(trip.StartDate),
		EndDate:      strings.TrimSpace(trip.EndDate),
		CrewNames:    crewNames,
		PlanningNote: strings.TrimSpace(req.Notes),
	})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to generate itinerary draft", "details": err.Error()})
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer rollbackQuietly(tx)

	if err := neutralizePendingEventCompletionNotificationsForTripTx(tx, tripID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to clear event notifications", "details": err.Error()})
		return
	}

	if err := replaceTripItineraryTx(tx, tripID, days); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save ai itinerary draft", "details": err.Error()})
		return
	}

	if !commitOrRespond(c, tx) {
		return
	}

	freshDays, err := loadTripItinerary(tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "draft saved but itinerary reload failed", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"days": freshDays})
}

func GetDestinationBrief(c *gin.Context) {
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

	trip, _, err := loadTripPlanningContext(tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load trip context", "details": err.Error()})
		return
	}

	brief, err := ai.GenerateDestinationBrief(c.Request.Context(), ai.DestinationBriefInput{
		Destination: strings.TrimSpace(trip.Destination),
		StartDate:   strings.TrimSpace(trip.StartDate),
		EndDate:     strings.TrimSpace(trip.EndDate),
	})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to generate destination brief", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"brief": brief})
}

func loadTripPlanningContext(tripID int) (models.Trip, []string, error) {
	var trip models.Trip
	if err := db.DB.QueryRow(`
		SELECT id, name, destination, start_date::text, end_date::text, created_by, COALESCE(image_url, ''), COALESCE(completed_at::text, '')
		FROM trips
		WHERE id = $1
	`, tripID).Scan(&trip.ID, &trip.Name, &trip.Destination, &trip.StartDate, &trip.EndDate, &trip.CreatedBy, &trip.ImageURL, &trip.CompletedAt); err != nil {
		return trip, nil, err
	}

	rows, err := db.DB.Query(`
		SELECT COALESCE(u.name, '')
		FROM trip_members tm
		INNER JOIN users u ON u.id = tm.user_id
		WHERE tm.trip_id = $1
		ORDER BY
			CASE WHEN tm.role = 'lead' THEN 0 ELSE 1 END,
			u.name ASC
	`, tripID)
	if err != nil {
		return trip, nil, err
	}
	defer rows.Close()

	crewNames := make([]string, 0)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return trip, nil, err
		}
		name = strings.TrimSpace(name)
		if name != "" {
			crewNames = append(crewNames, name)
		}
	}

	return trip, crewNames, rows.Err()
}
