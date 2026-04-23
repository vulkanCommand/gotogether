package handlers

import (
	"net/http"
	"strings"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func GetTripSetupStatus(c *gin.Context) {
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

	role, _ := tripRole(userID, tripID)
	var availableDates string
	var leadVoteUserID int
	var completedAt string
	_ = db.DB.QueryRow(`
		SELECT available_dates, COALESCE(lead_vote_user_id, 0), COALESCE(completed_at::text, '')
		FROM trip_member_setup
		WHERE trip_id = $1 AND user_id = $2
	`, tripID, userID).Scan(&availableDates, &leadVoteUserID, &completedAt)

	c.JSON(http.StatusOK, gin.H{
		"viewerRole":     role,
		"required":       strings.TrimSpace(completedAt) == "",
		"availableDates": splitSetupDates(availableDates),
		"leadVoteUserId": leadVoteUserID,
		"completedAt":    completedAt,
	})
}

func SaveTripSetupStatus(c *gin.Context) {
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

	var req models.TripMemberSetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if len(req.AvailableDates) == 0 || req.LeadVoteUserID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "available dates and lead vote are required"})
		return
	}

	_, err := db.DB.Exec(`
		INSERT INTO trip_member_setup (trip_id, user_id, available_dates, lead_vote_user_id, completed_at, updated_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (trip_id, user_id)
		DO UPDATE SET
			available_dates = EXCLUDED.available_dates,
			lead_vote_user_id = EXCLUDED.lead_vote_user_id,
			completed_at = CURRENT_TIMESTAMP,
			updated_at = CURRENT_TIMESTAMP
	`, tripID, userID, strings.Join(req.AvailableDates, ","), req.LeadVoteUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save setup", "details": err.Error()})
		return
	}

	createTripNotifications(tripID, userID, "Trip setup completed", "A crew member submitted availability and trip lead vote.", "setup", false)
	if err := finalizeLeadVotingIfReady(tripID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "setup saved but lead vote failed", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"completed": true})
}

func finalizeLeadVotingIfReady(tripID int) error {
	var memberCount, voteCount int
	if err := db.DB.QueryRow(`SELECT COUNT(*) FROM trip_members WHERE trip_id = $1`, tripID).Scan(&memberCount); err != nil {
		return err
	}
	if err := db.DB.QueryRow(`SELECT COUNT(*) FROM trip_member_setup WHERE trip_id = $1 AND completed_at IS NOT NULL AND lead_vote_user_id IS NOT NULL`, tripID).Scan(&voteCount); err != nil {
		return err
	}
	if memberCount == 0 || voteCount < memberCount {
		return nil
	}

	var leadUserID int
	if err := db.DB.QueryRow(`
		SELECT lead_vote_user_id
		FROM trip_member_setup
		WHERE trip_id = $1 AND lead_vote_user_id IS NOT NULL
		GROUP BY lead_vote_user_id
		ORDER BY COUNT(*) DESC, MIN(updated_at) ASC, lead_vote_user_id ASC
		LIMIT 1
	`, tripID).Scan(&leadUserID); err != nil {
		return err
	}

	tx, err := db.DB.Begin()
	if err != nil {
		return err
	}
	defer rollbackQuietly(tx)

	if _, err := tx.Exec(`UPDATE trip_members SET role = 'member' WHERE trip_id = $1`, tripID); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE trip_members SET role = 'lead' WHERE trip_id = $1 AND user_id = $2`, tripID, leadUserID); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	var leadName string
	_ = db.DB.QueryRow(`SELECT COALESCE(name, email, 'Trip lead') FROM users WHERE id = $1`, leadUserID).Scan(&leadName)
	createTripNotifications(tripID, leadUserID, "Trip lead finalized", strings.TrimSpace(leadName)+" is now the trip lead based on votes.", "alert", false)
	return nil
}

func splitSetupDates(value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return []string{}
	}
	return strings.Split(value, ",")
}
