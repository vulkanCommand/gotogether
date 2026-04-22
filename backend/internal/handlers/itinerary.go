package handlers

import (
	"database/sql"
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

	days, err := loadTripItinerary(tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch itinerary", "details": err.Error()})
		return
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
	if !ensureTripLeadAccess(c, tripID, userID) {
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

	if _, err := tx.Exec(`DELETE FROM itinerary_days WHERE trip_id = $1`, tripID); err != nil {
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
			title := strings.TrimSpace(event.Title)
			timeLabel := strings.TrimSpace(event.Time)
			location := strings.TrimSpace(event.Location)
			notes := strings.TrimSpace(event.Notes)
			if title == "" || timeLabel == "" {
				continue
			}
			if location == "" {
				location = "Location TBD"
			}

			if _, err := tx.Exec(`
				INSERT INTO itinerary_events (
					itinerary_day_id, title, time_label, location, notes, status, attendee_summary, event_order
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			`, itineraryDayID, title, timeLabel, location, notes, normalizeEventStatus(event.Status), strings.Join(event.Attendees, "||"), eventIndex); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save itinerary event", "details": err.Error()})
				return
			}
		}
	}

	if err := normalizeTripActiveEventTx(tx, tripID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to normalize active event", "details": err.Error()})
		return
	}

	if !commitOrRespond(c, tx) {
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "itinerary saved"})
}

func CreateItineraryDay(c *gin.Context) {
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

	var req models.ItineraryDayPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	title := strings.TrimSpace(req.Title)
	dateLabel := strings.TrimSpace(req.DateLabel)
	if title == "" {
		title = "New day"
	}
	if dateLabel == "" {
		dateLabel = title
	}

	var nextOrder int
	if err := db.DB.QueryRow(`SELECT COALESCE(MAX(day_order), -1) + 1 FROM itinerary_days WHERE trip_id = $1`, tripID).Scan(&nextOrder); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare day order", "details": err.Error()})
		return
	}

	var dayID int
	err := db.DB.QueryRow(`
		INSERT INTO itinerary_days (trip_id, title, date_label, day_order)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, tripID, title, dateLabel, nextOrder).Scan(&dayID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create day", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"day": models.ItineraryDayPayload{
		ID:        fmt.Sprintf("day-%d", dayID),
		Title:     title,
		DateLabel: dateLabel,
		Status:    "upcoming",
		Events:    []models.ItineraryEventPayload{},
	}})
}

func UpdateItineraryDay(c *gin.Context) {
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

	dayID := parseNumericID(c.Param("dayId"))
	if dayID <= 0 || !dayBelongsToTrip(dayID, tripID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid day id"})
		return
	}

	var req models.ItineraryDayPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	title := strings.TrimSpace(req.Title)
	dateLabel := strings.TrimSpace(req.DateLabel)
	if title == "" || dateLabel == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title and date label are required"})
		return
	}

	if _, err := db.DB.Exec(`UPDATE itinerary_days SET title = $1, date_label = $2 WHERE id = $3`, title, dateLabel, dayID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update day", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func DeleteItineraryDay(c *gin.Context) {
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

	dayID := parseNumericID(c.Param("dayId"))
	if dayID <= 0 || !dayBelongsToTrip(dayID, tripID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid day id"})
		return
	}

	if _, err := db.DB.Exec(`DELETE FROM itinerary_days WHERE id = $1`, dayID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete day", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

func CreateItineraryEvent(c *gin.Context) {
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

	dayID := parseNumericID(c.Param("dayId"))
	if dayID <= 0 || !dayBelongsToTrip(dayID, tripID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid day id"})
		return
	}

	var req models.ItineraryEventPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	event, err := insertItineraryEvent(tripID, dayID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createTripNotifications(tripID, userID, "New itinerary event", event.Title+" was added to the trip plan.", "itinerary", false)
	c.JSON(http.StatusCreated, gin.H{"event": event})
}

func UpdateItineraryEvent(c *gin.Context) {
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

	eventID := parseNumericID(c.Param("eventId"))
	if eventID <= 0 || !eventBelongsToTrip(eventID, tripID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid event id"})
		return
	}

	var req models.ItineraryEventPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	title := strings.TrimSpace(req.Title)
	timeLabel := strings.TrimSpace(req.Time)
	location := strings.TrimSpace(req.Location)
	if title == "" || timeLabel == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "event title and time are required"})
		return
	}
	if location == "" {
		location = "Location TBD"
	}

	if _, err := db.DB.Exec(`
		UPDATE itinerary_events
		SET title = $1, time_label = $2, location = $3, notes = $4, attendee_summary = $5
		WHERE id = $6
	`, title, timeLabel, location, strings.TrimSpace(req.Notes), strings.Join(req.Attendees, "||"), eventID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update event", "details": err.Error()})
		return
	}

	createTripNotifications(tripID, userID, "Itinerary event updated", title+" was updated.", "itinerary", false)
	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func DeleteItineraryEvent(c *gin.Context) {
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

	eventID := parseNumericID(c.Param("eventId"))
	if eventID <= 0 || !eventBelongsToTrip(eventID, tripID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid event id"})
		return
	}

	if _, err := db.DB.Exec(`DELETE FROM itinerary_events WHERE id = $1`, eventID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete event", "details": err.Error()})
		return
	}

	createTripNotifications(tripID, userID, "Itinerary event deleted", "The trip lead deleted an itinerary event.", "itinerary", false)
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

func CompleteItineraryEvent(c *gin.Context) {
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

	eventID := parseNumericID(c.Param("eventId"))
	if eventID <= 0 || !eventBelongsToTrip(eventID, tripID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid event id"})
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer rollbackQuietly(tx)

	if _, err := tx.Exec(`
		UPDATE itinerary_events
		SET status = 'completed', completed_at = CURRENT_TIMESTAMP, completed_by_user_id = $2
		WHERE id = $1
	`, eventID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to complete event", "details": err.Error()})
		return
	}

	if _, err := tx.Exec(`
		UPDATE itinerary_events e
		SET status = 'upcoming'
		FROM itinerary_days d
		WHERE e.itinerary_day_id = d.id AND d.trip_id = $1 AND e.status = 'active'
	`, tripID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to refresh event order", "details": err.Error()})
		return
	}

	var nextEventID int
	err = tx.QueryRow(`
		SELECT e.id
		FROM itinerary_events e
		INNER JOIN itinerary_days d ON d.id = e.itinerary_day_id
		WHERE d.trip_id = $1 AND e.status <> 'completed'
		ORDER BY d.day_order ASC, e.event_order ASC, e.id ASC
		LIMIT 1
	`, tripID).Scan(&nextEventID)
	if err != nil && !sqlErrNoRows(err) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to find next event", "details": err.Error()})
		return
	}
	if nextEventID > 0 {
		if _, err := tx.Exec(`UPDATE itinerary_events SET status = 'active' WHERE id = $1`, nextEventID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to activate next event", "details": err.Error()})
			return
		}
	}

	if err := normalizeTripActiveEventTx(tx, tripID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to normalize active event", "details": err.Error()})
		return
	}

	if !commitOrRespond(c, tx) {
		return
	}

	createTripNotifications(tripID, userID, "Event completed", "The trip lead marked an itinerary event complete.", "itinerary", true)
	days, err := loadTripItinerary(tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "event completed but itinerary reload failed", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"days": days})
}

func UndoCompleteItineraryEvent(c *gin.Context) {
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

	eventID := parseNumericID(c.Param("eventId"))
	if eventID <= 0 || !eventBelongsToTrip(eventID, tripID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid event id"})
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer rollbackQuietly(tx)

	if _, err := tx.Exec(`
		UPDATE itinerary_events e
		SET status = 'upcoming'
		FROM itinerary_days d
		WHERE e.itinerary_day_id = d.id AND d.trip_id = $1 AND e.status = 'active'
	`, tripID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to refresh active event", "details": err.Error()})
		return
	}

	if _, err := tx.Exec(`
		UPDATE itinerary_events
		SET status = 'active', completed_at = NULL, completed_by_user_id = NULL
		WHERE id = $1
	`, eventID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to undo event completion", "details": err.Error()})
		return
	}

	if err := normalizeTripActiveEventTx(tx, tripID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to normalize active event", "details": err.Error()})
		return
	}

	if !commitOrRespond(c, tx) {
		return
	}

	createTripNotifications(tripID, userID, "Event reopened", "The trip lead reopened an itinerary event.", "itinerary", false)
	days, err := loadTripItinerary(tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "event reopened but itinerary reload failed", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"days": days})
}

func loadTripItinerary(tripID int) ([]models.ItineraryDayPayload, error) {
	dayRows, err := db.DB.Query(`
		SELECT id, title, date_label, day_order
		FROM itinerary_days
		WHERE trip_id = $1
		ORDER BY day_order ASC, id ASC
	`, tripID)
	if err != nil {
		return nil, err
	}
	defer dayRows.Close()

	days := make([]models.ItineraryDayPayload, 0)
	dayIndexByID := map[int]int{}
	for dayRows.Next() {
		var dayID, dayOrder int
		var day models.ItineraryDayPayload
		if err := dayRows.Scan(&dayID, &day.Title, &day.DateLabel, &dayOrder); err != nil {
			return nil, err
		}
		day.ID = fmt.Sprintf("day-%d", dayID)
		day.Events = []models.ItineraryEventPayload{}
		dayIndexByID[dayID] = len(days)
		days = append(days, day)
	}
	if err := dayRows.Err(); err != nil {
		return nil, err
	}

	eventRows, err := db.DB.Query(`
		SELECT
			id,
			itinerary_day_id,
			title,
			time_label,
			location,
			COALESCE(notes, ''),
			status,
			COALESCE(attendee_summary, ''),
			COALESCE(completed_at::text, ''),
			event_order
		FROM itinerary_events
		WHERE itinerary_day_id IN (
			SELECT id FROM itinerary_days WHERE trip_id = $1
		)
		ORDER BY itinerary_day_id ASC, event_order ASC, id ASC
	`, tripID)
	if err != nil {
		return nil, err
	}
	defer eventRows.Close()

	for eventRows.Next() {
		var eventID, itineraryDayID, eventOrder int
		var attendeeSummary string
		var event models.ItineraryEventPayload
		if err := eventRows.Scan(&eventID, &itineraryDayID, &event.Title, &event.Time, &event.Location, &event.Notes, &event.Status, &attendeeSummary, &event.CompletedAt, &eventOrder); err != nil {
			return nil, err
		}
		event.ID = fmt.Sprintf("event-%d", eventID)
		event.DayID = fmt.Sprintf("day-%d", itineraryDayID)
		event.Status = normalizeEventStatus(event.Status)
		if strings.TrimSpace(attendeeSummary) == "" {
			event.Attendees = []string{}
		} else {
			event.Attendees = strings.Split(attendeeSummary, "||")
		}
		if idx, exists := dayIndexByID[itineraryDayID]; exists {
			days[idx].Events = append(days[idx].Events, event)
		}
	}
	if err := eventRows.Err(); err != nil {
		return nil, err
	}

	for index := range days {
		days[index].Status = dayCompletionStatus(days[index])
	}

	return days, nil
}

func insertItineraryEvent(tripID int, dayID int, req models.ItineraryEventPayload) (models.ItineraryEventPayload, error) {
	title := strings.TrimSpace(req.Title)
	timeLabel := strings.TrimSpace(req.Time)
	location := strings.TrimSpace(req.Location)
	if title == "" || timeLabel == "" {
		return models.ItineraryEventPayload{}, fmt.Errorf("event title and time are required")
	}
	if location == "" {
		location = "Location TBD"
	}

	var nextOrder int
	if err := db.DB.QueryRow(`SELECT COALESCE(MAX(event_order), -1) + 1 FROM itinerary_events WHERE itinerary_day_id = $1`, dayID).Scan(&nextOrder); err != nil {
		return models.ItineraryEventPayload{}, err
	}

	status := normalizeEventStatus(req.Status)
	var hasActive bool
	if err := db.DB.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM itinerary_events e
			INNER JOIN itinerary_days d ON d.id = e.itinerary_day_id
			WHERE d.trip_id = $1 AND e.status = 'active'
		)
	`, tripID).Scan(&hasActive); err == nil && !hasActive && status == "upcoming" {
		status = "active"
	}
	if status == "active" {
		if _, err := db.DB.Exec(`
			UPDATE itinerary_events e
			SET status = 'upcoming'
			FROM itinerary_days d
			WHERE e.itinerary_day_id = d.id AND d.trip_id = $1 AND e.status = 'active'
		`, tripID); err != nil {
			return models.ItineraryEventPayload{}, err
		}
	}

	var eventID int
	err := db.DB.QueryRow(`
		INSERT INTO itinerary_events (itinerary_day_id, title, time_label, location, notes, status, attendee_summary, event_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`, dayID, title, timeLabel, location, strings.TrimSpace(req.Notes), status, strings.Join(req.Attendees, "||"), nextOrder).Scan(&eventID)
	if err != nil {
		return models.ItineraryEventPayload{}, err
	}

	return models.ItineraryEventPayload{
		ID:        fmt.Sprintf("event-%d", eventID),
		DayID:     fmt.Sprintf("day-%d", dayID),
		Title:     title,
		Time:      timeLabel,
		Location:  location,
		Notes:     strings.TrimSpace(req.Notes),
		Attendees: req.Attendees,
		Status:    status,
	}, nil
}

func dayBelongsToTrip(dayID int, tripID int) bool {
	var exists bool
	err := db.DB.QueryRow(`SELECT EXISTS (SELECT 1 FROM itinerary_days WHERE id = $1 AND trip_id = $2)`, dayID, tripID).Scan(&exists)
	return err == nil && exists
}

func normalizeTripActiveEventTx(tx *sql.Tx, tripID int) error {
	_, err := tx.Exec(`
		WITH ranked AS (
			SELECT
				e.id,
				ROW_NUMBER() OVER (
					ORDER BY
						CASE WHEN e.status = 'active' THEN 0 ELSE 1 END,
						d.day_order ASC,
						e.event_order ASC,
						e.id ASC
				) AS rn
			FROM itinerary_events e
			INNER JOIN itinerary_days d ON d.id = e.itinerary_day_id
			WHERE d.trip_id = $1 AND e.status <> 'completed'
		)
		UPDATE itinerary_events e
		SET status = CASE WHEN ranked.rn = 1 THEN 'active' ELSE 'upcoming' END
		FROM ranked
		WHERE e.id = ranked.id
	`, tripID)
	return err
}

func normalizeEventStatus(value string) string {
	status := strings.ToLower(strings.TrimSpace(value))
	switch status {
	case "active", "completed":
		return status
	default:
		return "upcoming"
	}
}

func dayCompletionStatus(day models.ItineraryDayPayload) string {
	if len(day.Events) == 0 {
		return "upcoming"
	}
	for _, event := range day.Events {
		if normalizeEventStatus(event.Status) != "completed" {
			return "active"
		}
	}
	return "completed"
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
