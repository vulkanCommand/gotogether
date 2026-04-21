package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func GetTripItinerary(c *gin.Context) {
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

	dayRows, err := db.DB.Query(`
		SELECT id, title, date_label, day_order
		FROM itinerary_days
		WHERE trip_id = $1
		ORDER BY day_order ASC, id ASC
	`, tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch itinerary", "details": err.Error()})
		return
	}
	defer dayRows.Close()

	days := make([]models.ItineraryDayPayload, 0)
	dayIDOrder := make([]int, 0)
	dayIndexByID := map[int]int{}

	for dayRows.Next() {
		var dayID, dayOrder int
		var day models.ItineraryDayPayload
		if err := dayRows.Scan(&dayID, &day.Title, &day.DateLabel, &dayOrder); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read itinerary days", "details": err.Error()})
			return
		}
		day.ID = fmt.Sprintf("day-%d", dayID)
		day.Events = []models.ItineraryEventPayload{}
		dayIndexByID[dayID] = len(days)
		dayIDOrder = append(dayIDOrder, dayID)
		days = append(days, day)
	}

	eventRows, err := db.DB.Query(`
		SELECT id, itinerary_day_id, title, time_label, location, COALESCE(notes, ''), status, COALESCE(attendee_summary, ''), event_order
		FROM itinerary_events
		WHERE itinerary_day_id IN (
			SELECT id FROM itinerary_days WHERE trip_id = $1
		)
		ORDER BY itinerary_day_id ASC, event_order ASC, id ASC
	`, tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch itinerary events", "details": err.Error()})
		return
	}
	defer eventRows.Close()

	for eventRows.Next() {
		var eventID, itineraryDayID, eventOrder int
		var event models.ItineraryEventPayload
		var attendeeSummary string
		if err := eventRows.Scan(&eventID, &itineraryDayID, &event.Title, &event.Time, &event.Location, &event.Notes, &event.Status, &attendeeSummary, &eventOrder); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read itinerary events", "details": err.Error()})
			return
		}
		event.ID = fmt.Sprintf("event-%d", eventID)
		if strings.TrimSpace(attendeeSummary) == "" {
			event.Attendees = []string{}
		} else {
			event.Attendees = strings.Split(attendeeSummary, "||")
		}
		if idx, exists := dayIndexByID[itineraryDayID]; exists {
			days[idx].Events = append(days[idx].Events, event)
		}
	}

	c.JSON(http.StatusOK, gin.H{"days": days})
}

func SaveTripItinerary(c *gin.Context) {
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

	var req models.SaveItineraryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer rollbackQuietly(tx)

	_, err = tx.Exec(`DELETE FROM itinerary_days WHERE trip_id = $1`, tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to clear existing itinerary", "details": err.Error()})
		return
	}

	for dayIndex, day := range req.Days {
		dayTitle := strings.TrimSpace(day.Title)
		dayDateLabel := strings.TrimSpace(day.DateLabel)
		if dayTitle == "" {
			dayTitle = fmt.Sprintf("Day %d", dayIndex+1)
		}
		if dayDateLabel == "" {
			dayDateLabel = dayTitle
		}

		var itineraryDayID int
		err = tx.QueryRow(`
			INSERT INTO itinerary_days (trip_id, title, date_label, day_order)
			VALUES ($1, $2, $3, $4)
			RETURNING id
		`, tripID, dayTitle, dayDateLabel, dayIndex).Scan(&itineraryDayID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save itinerary day", "details": err.Error()})
			return
		}

		for eventIndex, event := range day.Events {
			attendeeSummary := strings.Join(event.Attendees, "||")
			title := strings.TrimSpace(event.Title)
			timeLabel := strings.TrimSpace(event.Time)
			location := strings.TrimSpace(event.Location)
			notes := strings.TrimSpace(event.Notes)
			status := strings.TrimSpace(event.Status)
			if title == "" || timeLabel == "" {
				continue
			}
			if location == "" {
				location = "Location TBD"
			}
			if status == "" {
				status = "upcoming"
			}

			_, err = tx.Exec(`
				INSERT INTO itinerary_events (
					itinerary_day_id, title, time_label, location, notes, status, attendee_summary, event_order
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			`, itineraryDayID, title, timeLabel, location, notes, status, attendeeSummary, eventIndex)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save itinerary event", "details": err.Error()})
				return
			}
		}
	}

	if !commitOrRespond(c, tx) {
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "itinerary saved"})
}

func parseTripID(c *gin.Context) (int, bool) {
	tripIDParam := strings.TrimSpace(c.Param("id"))
	tripID, err := strconv.Atoi(tripIDParam)
	if err != nil || tripID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid trip id"})
		return 0, false
	}
	return tripID, true
}
