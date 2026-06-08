package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func computeTripReadiness(completedAt string, viewerSetupCompletedAt string, membersCount int, setupCompletedCount int) (string, bool, int) {
	pendingCount := membersCount - setupCompletedCount
	if pendingCount < 0 {
		pendingCount = 0
	}

	if strings.TrimSpace(completedAt) != "" {
		return "completed", false, 0
	}
	if strings.TrimSpace(viewerSetupCompletedAt) == "" {
		return "needs_your_response", true, pendingCount
	}
	if pendingCount > 0 {
		return "waiting_on_crew", false, pendingCount
	}
	return "ready", false, 0
}

func CreateTrip(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	var req models.CreateTripRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Destination = strings.TrimSpace(req.Destination)
	req.StartDate = strings.TrimSpace(req.StartDate)
	req.EndDate = strings.TrimSpace(req.EndDate)

	nameValidation := validateUserText(req.Name, textValidationOptions{Required: true, MaxLength: 80})
	destinationValidation := validateUserText(req.Destination, textValidationOptions{Required: true, MaxLength: 120})
	req.Name = nameValidation.Value
	req.Destination = destinationValidation.Value

	if nameValidation.Empty || destinationValidation.Empty || req.StartDate == "" || req.EndDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name, destination, start_date, and end_date are required"})
		return
	}
	if nameValidation.TooLong || nameValidation.Unsafe || destinationValidation.TooLong || destinationValidation.Unsafe {
		c.JSON(http.StatusBadRequest, gin.H{"error": friendlyTextValidationMessage})
		return
	}

	restrictedMemberIDs, err := filterBlockedUserIDs(userID, req.MemberIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate selected members", "details": err.Error()})
		return
	}
	if len(restrictedMemberIDs) > 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "one or more selected members are unavailable for new trips"})
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer rollbackQuietly(tx)

	var trip models.Trip
	err = tx.QueryRow(`
		INSERT INTO trips (name, destination, start_date, end_date, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, destination, start_date::text, end_date::text, created_by, COALESCE(image_url, ''), COALESCE(completed_at::text, '')
	`, req.Name, req.Destination, req.StartDate, req.EndDate, userID).
		Scan(&trip.ID, &trip.Name, &trip.Destination, &trip.StartDate, &trip.EndDate, &trip.CreatedBy, &trip.ImageURL, &trip.CompletedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create trip", "details": err.Error()})
		return
	}

	leadUserID := req.LeadUserID
	if leadUserID <= 0 {
		leadUserID = userID
	}
	allowedLead := leadUserID == userID
	for _, memberID := range req.MemberIDs {
		if memberID == leadUserID {
			allowedLead = true
			break
		}
	}
	if !allowedLead {
		leadUserID = userID
	}
	trip.LeadUserID = leadUserID
	trip.ViewerRole = "lead"

	availableDates := ""
	if len(req.AvailableDates) > 0 {
		normalizedDates := make([]string, 0, len(req.AvailableDates))
		for _, value := range req.AvailableDates {
			value = strings.TrimSpace(value)
			if value == "" {
				continue
			}
			normalizedDates = append(normalizedDates, value)
		}
		availableDates = strings.Join(normalizedDates, ",")
	}

	_, err = tx.Exec(`
		INSERT INTO trip_members (trip_id, user_id, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (trip_id, user_id) DO NOTHING
	`, trip.ID, userID, "lead")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create trip member", "details": err.Error()})
		return
	}

	addedMembers := map[int]bool{userID: true}
	newlyInsertedMemberIDs := make([]int, 0)
	for _, memberID := range req.MemberIDs {
		if memberID <= 0 || addedMembers[memberID] {
			continue
		}
		addedMembers[memberID] = true
		var insertedUserID int
		err := tx.QueryRow(`
			INSERT INTO trip_members (trip_id, user_id, role)
			VALUES ($1, $2, $3)
			ON CONFLICT (trip_id, user_id) DO NOTHING
			RETURNING user_id
		`, trip.ID, memberID, "member").Scan(&insertedUserID)
		if err != nil && !sqlErrNoRows(err) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add trip member", "details": err.Error()})
			return
		}
		if err == nil && insertedUserID > 0 && insertedUserID != userID {
			newlyInsertedMemberIDs = append(newlyInsertedMemberIDs, insertedUserID)
		}
	}

	if _, err := tx.Exec(`
		INSERT INTO expense_groups (trip_id, name, created_by_user_id)
		VALUES ($1, 'Trip expenses', $2)
		ON CONFLICT (trip_id, name) DO NOTHING
	`, trip.ID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create expense group", "details": err.Error()})
		return
	}

	if _, err := tx.Exec(`
		INSERT INTO trip_member_setup (trip_id, user_id, available_dates, lead_vote_user_id, completed_at, updated_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (trip_id, user_id) DO UPDATE SET
			available_dates = EXCLUDED.available_dates,
			lead_vote_user_id = EXCLUDED.lead_vote_user_id,
			completed_at = CURRENT_TIMESTAMP,
			updated_at = CURRENT_TIMESTAMP
	`, trip.ID, userID, availableDates, leadUserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save lead vote", "details": err.Error()})
		return
	}

	if err := syncTripItineraryDaysTx(tx, trip.ID, req.StartDate, req.EndDate); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create trip itinerary days", "details": err.Error()})
		return
	}

	if !commitOrRespond(c, tx) {
		return
	}

	for _, addedUserID := range newlyInsertedMemberIDs {
		NotifyTripMemberAdded(context.Background(), trip.ID, userID, addedUserID)
	}

	refreshTripCoverInBackground(trip.ID, userID, false)
	c.JSON(http.StatusCreated, gin.H{"message": "trip created", "trip": trip})
}

func GetTrips(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	rows, err := db.DB.Query(`
		SELECT
			t.id,
			t.name,
			t.destination,
			t.start_date::text,
			t.end_date::text,
			t.created_by,
			COUNT(DISTINCT tm.user_id)::int AS members_count,
			COALESCE(t.image_url, '') AS image_url,
			COALESCE(t.completed_at::text, '') AS completed_at,
			COALESCE(viewer.role, '') AS viewer_role,
			COALESCE(MAX(CASE WHEN tm.role = 'lead' THEN tm.user_id END), t.created_by) AS lead_user_id,
			COUNT(DISTINCT CASE WHEN setup.completed_at IS NOT NULL THEN setup.user_id END)::int AS setup_completed_count,
			COALESCE(viewer_setup.completed_at::text, '') AS viewer_setup_completed_at,
			COALESCE((
				SELECT COUNT(*)
				FROM trip_completion_confirmations tcc
				WHERE tcc.trip_id = t.id
			), 0)::int AS completion_confirmed_count,
			EXISTS(
				SELECT 1
				FROM trip_completion_confirmations tcc
				WHERE tcc.trip_id = t.id
			) AND COALESCE(t.completed_at::text, '') = '' AS completion_requested
		FROM trips t
		LEFT JOIN trip_members tm ON tm.trip_id = t.id
		LEFT JOIN trip_members viewer ON viewer.trip_id = t.id AND viewer.user_id = $1
		LEFT JOIN trip_member_setup setup ON setup.trip_id = t.id AND setup.user_id = tm.user_id
		LEFT JOIN trip_member_setup viewer_setup ON viewer_setup.trip_id = t.id AND viewer_setup.user_id = $1
		WHERE t.created_by = $1
		   OR t.id IN (
				SELECT trip_id
				FROM trip_members
				WHERE user_id = $1
		   )
		GROUP BY t.id, t.name, t.destination, t.start_date, t.end_date, t.created_by, t.image_url, t.completed_at, viewer.role, viewer_setup.completed_at
		ORDER BY t.start_date ASC, t.id ASC
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch trips", "details": err.Error()})
		return
	}
	defer rows.Close()

	trips := make([]models.TripListItem, 0)
	for rows.Next() {
		var trip models.TripListItem
		var viewerSetupCompletedAt string
		var completionConfirmedCount int
		var completionRequested bool
		if err := rows.Scan(
			&trip.ID,
			&trip.Name,
			&trip.Destination,
			&trip.StartDate,
			&trip.EndDate,
			&trip.CreatedBy,
			&trip.MembersCount,
			&trip.ImageURL,
			&trip.CompletedAt,
			&trip.ViewerRole,
			&trip.LeadUserID,
			&trip.SetupCompletedCount,
			&viewerSetupCompletedAt,
			&completionConfirmedCount,
			&completionRequested,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read trips", "details": err.Error()})
			return
		}
		trip.ReadinessStatus, trip.SetupRequired, trip.SetupPendingCount = computeTripReadiness(
			trip.CompletedAt,
			viewerSetupCompletedAt,
			trip.MembersCount,
			trip.SetupCompletedCount,
		)
		trip.CompletionConfirmedCount = completionConfirmedCount
		trip.CompletionRequested = completionRequested
		trip.CompletionPendingCount = trip.MembersCount - completionConfirmedCount
		if trip.CompletionPendingCount < 0 {
			trip.CompletionPendingCount = 0
		}
		trips = append(trips, trip)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed while reading trips", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"trips": trips})
}

func GetTripByID(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	tripIDParam := strings.TrimSpace(c.Param("id"))
	tripID, err := strconv.Atoi(tripIDParam)
	if err != nil || tripID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid trip id"})
		return
	}

	var trip models.Trip
	var membersCount int
	var viewerSetupCompletedAt string
	var completionConfirmedCount int
	var completionRequested bool
	err = db.DB.QueryRow(`
		SELECT
			t.id,
			t.name,
			t.destination,
			t.start_date::text,
			t.end_date::text,
			t.created_by,
			COUNT(DISTINCT tm.user_id)::int AS members_count,
			COALESCE(t.image_url, '') AS image_url,
			COALESCE(t.completed_at::text, '') AS completed_at,
			COALESCE(viewer.role, '') AS viewer_role,
			COALESCE(MAX(CASE WHEN tm.role = 'lead' THEN tm.user_id END), t.created_by) AS lead_user_id,
			COUNT(DISTINCT CASE WHEN setup.completed_at IS NOT NULL THEN setup.user_id END)::int AS setup_completed_count,
			COALESCE(viewer_setup.completed_at::text, '') AS viewer_setup_completed_at,
			COALESCE((
				SELECT COUNT(*)
				FROM trip_completion_confirmations tcc
				WHERE tcc.trip_id = t.id
			), 0)::int AS completion_confirmed_count,
			EXISTS(
				SELECT 1
				FROM trip_completion_confirmations tcc
				WHERE tcc.trip_id = t.id
			) AND COALESCE(t.completed_at::text, '') = '' AS completion_requested
		FROM trips t
		LEFT JOIN trip_members tm ON tm.trip_id = t.id
		LEFT JOIN trip_members viewer ON viewer.trip_id = t.id AND viewer.user_id = $2
		LEFT JOIN trip_member_setup setup ON setup.trip_id = t.id AND setup.user_id = tm.user_id
		LEFT JOIN trip_member_setup viewer_setup ON viewer_setup.trip_id = t.id AND viewer_setup.user_id = $2
		WHERE t.id = $1
		  AND (
				t.created_by = $2
				OR t.id IN (
					SELECT trip_id
					FROM trip_members
				WHERE user_id = $2
				)
		  )
		GROUP BY t.id, t.name, t.destination, t.start_date, t.end_date, t.created_by, t.image_url, t.completed_at, viewer.role, viewer_setup.completed_at
	`, tripID, userID).Scan(
		&trip.ID,
		&trip.Name,
		&trip.Destination,
		&trip.StartDate,
		&trip.EndDate,
		&trip.CreatedBy,
		&membersCount,
		&trip.ImageURL,
		&trip.CompletedAt,
		&trip.ViewerRole,
		&trip.LeadUserID,
		&trip.SetupCompletedCount,
		&viewerSetupCompletedAt,
		&completionConfirmedCount,
		&completionRequested,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch trip", "details": err.Error()})
		return
	}
	trip.SetupPendingCount = membersCount - trip.SetupCompletedCount
	if trip.SetupPendingCount < 0 {
		trip.SetupPendingCount = 0
	}
	trip.ReadinessStatus, trip.SetupRequired, _ = computeTripReadiness(
		trip.CompletedAt,
		viewerSetupCompletedAt,
		membersCount,
		trip.SetupCompletedCount,
	)
	trip.CompletionConfirmedCount = completionConfirmedCount
	trip.CompletionRequested = completionRequested
	trip.CompletionPendingCount = membersCount - completionConfirmedCount
	if trip.CompletionPendingCount < 0 {
		trip.CompletionPendingCount = 0
	}

	memberRows, err := db.DB.Query(`
		SELECT
			u.id,
			COALESCE(u.name, ''),
			COALESCE(tm.role, 'member'),
			COALESCE(setup.available_dates, ''),
			COALESCE(setup.lead_vote_user_id, 0),
			COALESCE(setup.completed_at::text, ''),
			CASE WHEN tm.user_id = $2 THEN TRUE ELSE FALSE END AS is_viewer
		FROM trip_members tm
		INNER JOIN users u ON u.id = tm.user_id
		LEFT JOIN trip_member_setup setup ON setup.trip_id = tm.trip_id AND setup.user_id = tm.user_id
		WHERE tm.trip_id = $1
		ORDER BY tm.joined_at ASC, tm.id ASC
	`, tripID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch trip members", "details": err.Error()})
		return
	}
	defer memberRows.Close()

	members := make([]gin.H, 0)
	for memberRows.Next() {
		var memberID int
		var memberName, memberRole string
		var availableDates string
		var leadVoteUserID int
		var setupCompletedAt string
		var isViewer bool
		if err := memberRows.Scan(&memberID, &memberName, &memberRole, &availableDates, &leadVoteUserID, &setupCompletedAt, &isViewer); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read trip members", "details": err.Error()})
			return
		}
		proposalStatus := "waiting"
		if strings.TrimSpace(setupCompletedAt) != "" {
			proposalStatus = "confirmed"
		} else if isViewer {
			proposalStatus = "needs_response"
		}
		members = append(members, gin.H{
			"id":                 memberID,
			"name":               memberName,
			"role":               memberRole,
			"available_dates":    splitSetupDates(availableDates),
			"lead_vote_user_id":  leadVoteUserID,
			"setup_completed_at": setupCompletedAt,
			"is_viewer":          isViewer,
			"proposal_status":    proposalStatus,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"trip": gin.H{
			"id":                         trip.ID,
			"name":                       trip.Name,
			"destination":                trip.Destination,
			"start_date":                 trip.StartDate,
			"end_date":                   trip.EndDate,
			"created_by":                 trip.CreatedBy,
			"members_count":              membersCount,
			"image_url":                  trip.ImageURL,
			"completed_at":               trip.CompletedAt,
			"viewer_role":                trip.ViewerRole,
			"lead_user_id":               trip.LeadUserID,
			"setup_completed_count":      trip.SetupCompletedCount,
			"setup_pending_count":        trip.SetupPendingCount,
			"setup_required":             trip.SetupRequired,
			"readiness_status":           trip.ReadinessStatus,
			"completion_confirmed_count": trip.CompletionConfirmedCount,
			"completion_pending_count":   trip.CompletionPendingCount,
			"completion_requested":       trip.CompletionRequested,
		},
		"members": members,
		"permissions": gin.H{
			"can_edit_trip":      true,
			"can_edit_itinerary": true,
			"can_complete_trip":  true,
			"can_delete_trip":    trip.CreatedBy == userID,
			"can_remove_members": trip.CreatedBy == userID,
		},
	})
}

func UpdateTrip(c *gin.Context) {
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

	var req models.UpdateTripRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Destination = strings.TrimSpace(req.Destination)
	req.StartDate = strings.TrimSpace(req.StartDate)
	req.EndDate = strings.TrimSpace(req.EndDate)

	nameValidation := validateUserText(req.Name, textValidationOptions{Required: true, MaxLength: 80})
	destinationValidation := validateUserText(req.Destination, textValidationOptions{Required: true, MaxLength: 120})
	req.Name = nameValidation.Value
	req.Destination = destinationValidation.Value

	if nameValidation.Empty || destinationValidation.Empty || req.StartDate == "" || req.EndDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name, destination, start_date, and end_date are required"})
		return
	}
	if nameValidation.TooLong || nameValidation.Unsafe || destinationValidation.TooLong || destinationValidation.Unsafe {
		c.JSON(http.StatusBadRequest, gin.H{"error": friendlyTextValidationMessage})
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer rollbackQuietly(tx)

	var previousDestination string
	if err := tx.QueryRow(`SELECT COALESCE(destination, '') FROM trips WHERE id = $1`, tripID).Scan(&previousDestination); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load current trip destination", "details": err.Error()})
		return
	}

	if _, err := tx.Exec(`
		UPDATE trips
		SET name = $2, destination = $3, start_date = $4, end_date = $5
		WHERE id = $1
	`, tripID, req.Name, req.Destination, req.StartDate, req.EndDate); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update trip", "details": err.Error()})
		return
	}

	if err := syncTripItineraryDaysTx(tx, tripID, req.StartDate, req.EndDate); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync itinerary days", "details": err.Error()})
		return
	}

	if !commitOrRespond(c, tx) {
		return
	}

	if !strings.EqualFold(strings.TrimSpace(previousDestination), strings.TrimSpace(req.Destination)) {
		refreshTripCoverInBackground(tripID, userID, true)
	}

	actorName := loadActorDisplayName(userID)
	createUserNotification(userID, tripID, "You updated "+req.Name, req.Name+" was updated", "alert", false, "", 0, userID)
	createTripNotifications(tripID, userID, actorName+" updated "+req.Name, actorName+" updated "+req.Name, "alert", false)
	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func syncTripItineraryDaysTx(tx *sql.Tx, tripID int, startDate string, endDate string) error {
	start, err := time.Parse("2006-01-02", strings.TrimSpace(startDate))
	if err != nil {
		return err
	}
	end, err := time.Parse("2006-01-02", strings.TrimSpace(endDate))
	if err != nil {
		return err
	}
	if end.Before(start) {
		return fmt.Errorf("end date cannot be before start date")
	}

	type existingDay struct {
		ID int
	}

	existingDays := make([]existingDay, 0)
	rows, err := tx.Query(`
		SELECT id
		FROM itinerary_days
		WHERE trip_id = $1
		ORDER BY day_order ASC, id ASC
	`, tripID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var day existingDay
		if err := rows.Scan(&day.ID); err != nil {
			return err
		}
		existingDays = append(existingDays, day)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	desiredLabels := make([]string, 0)
	for cursor := start; !cursor.After(end); cursor = cursor.AddDate(0, 0, 1) {
		desiredLabels = append(desiredLabels, cursor.Format("Jan 2"))
	}

	for index, label := range desiredLabels {
		if index < len(existingDays) {
			if _, err := tx.Exec(`
				UPDATE itinerary_days
				SET title = $1, date_label = $1, day_order = $2
				WHERE id = $3
			`, label, index, existingDays[index].ID); err != nil {
				return err
			}
			continue
		}

		if _, err := tx.Exec(`
			INSERT INTO itinerary_days (trip_id, title, date_label, day_order)
			VALUES ($1, $2, $3, $4)
		`, tripID, label, label, index); err != nil {
			return err
		}
	}

	if len(existingDays) > len(desiredLabels) {
		for _, day := range existingDays[len(desiredLabels):] {
			if _, err := tx.Exec(`DELETE FROM itinerary_days WHERE id = $1`, day.ID); err != nil {
				return err
			}
		}
	}

	return normalizeTripActiveEventTx(tx, tripID)
}

func DeleteTrip(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	tripID, ok := parseTripID(c)
	if !ok {
		return
	}

	if !ensureTripCreatorAccess(c, tripID, userID) {
		return
	}

	if _, err := db.DB.Exec(`DELETE FROM trips WHERE id = $1`, tripID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete trip", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

func CompleteTrip(c *gin.Context) {
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

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start completion transaction"})
		return
	}
	defer rollbackQuietly(tx)

	if _, err := tx.Exec(`DELETE FROM trip_completion_confirmations WHERE trip_id = $1`, tripID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to clear completion confirmations", "details": err.Error()})
		return
	}

	if _, err := tx.Exec(`
		UPDATE notifications
		SET action_completed_at = CURRENT_TIMESTAMP,
			cleared_at = CURRENT_TIMESTAMP
		WHERE trip_id = $1
			AND action_type = 'trip_complete'
			AND action_completed_at IS NULL
	`, tripID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to clear trip completion notifications", "details": err.Error()})
		return
	}

	if _, err := tx.Exec(`
		UPDATE trips
		SET completed_at = CURRENT_TIMESTAMP, completed_by_user_id = $2
		WHERE id = $1
	`, tripID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to complete trip", "details": err.Error()})
		return
	}

	if !commitOrRespond(c, tx) {
		return
	}

	var tripName string
	_ = db.DB.QueryRow(`SELECT COALESCE(name, '') FROM trips WHERE id = $1`, tripID).Scan(&tripName)
	if strings.TrimSpace(tripName) == "" {
		tripName = loadTripDisplayName(tripID)
	}
	tripName = strings.TrimSpace(tripName)
	actorName := loadActorDisplayName(userID)
	createUserNotification(userID, tripID, "You completed "+tripName, "Trip moved to completed", "alert", false, "", 0, userID)
	createTripNotifications(tripID, userID, actorName+" completed "+tripName, tripName+" was wrapped up", "alert", false)
	c.JSON(http.StatusOK, gin.H{"completed": true, "pending_confirmations": false})
}

func insertTripCompletionConfirmation(tripID int, userID int) error {
	_, err := db.DB.Exec(`
		INSERT INTO trip_completion_confirmations (trip_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT (trip_id, user_id) DO UPDATE SET confirmed_at = CURRENT_TIMESTAMP
	`, tripID, userID)
	if err != nil {
		return err
	}
	return finalizeTripIfConfirmed(tripID)
}

func acceptTripCompletion(tripID int, userID int) error {
	return insertTripCompletionConfirmation(tripID, userID)
}

func finalizeTripIfConfirmed(tripID int) error {
	var memberCount, confirmationCount int
	if err := db.DB.QueryRow(`SELECT COUNT(*) FROM trip_members WHERE trip_id = $1`, tripID).Scan(&memberCount); err != nil {
		return err
	}
	if err := db.DB.QueryRow(`SELECT COUNT(*) FROM trip_completion_confirmations WHERE trip_id = $1`, tripID).Scan(&confirmationCount); err != nil {
		return err
	}
	if memberCount == 0 || confirmationCount < memberCount {
		return nil
	}

	var leadUserID int
	if err := db.DB.QueryRow(`SELECT user_id FROM trip_members WHERE trip_id = $1 AND role = 'lead' LIMIT 1`, tripID).Scan(&leadUserID); err != nil {
		return err
	}
	if _, err := db.DB.Exec(`
		UPDATE trips
		SET completed_at = CURRENT_TIMESTAMP, completed_by_user_id = $2
		WHERE id = $1
	`, tripID, leadUserID); err != nil {
		return err
	}
	tripName := loadTripDisplayName(tripID)
	actorName := loadActorDisplayName(leadUserID)
	createTripNotifications(tripID, leadUserID, actorName+" completed "+tripName, tripName+" was wrapped up", "alert", false)
	return nil
}
