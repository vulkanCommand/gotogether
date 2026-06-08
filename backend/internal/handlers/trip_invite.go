package handlers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"net/http"
	"strconv"
	"strings"

	"gotogether-backend/internal/config"
	"gotogether-backend/internal/db"

	"github.com/gin-gonic/gin"
)

type addTripMembersRequest struct {
	UserID  int   `json:"user_id"`
	UserIDs []int `json:"user_ids"`
}

func generateTripInviteToken() (string, error) {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func buildTripInviteURL(token string) string {
	base := strings.TrimRight(config.Load().AppInviteURL, "/")
	if base == "" {
		base = "https://gotogether.app"
	}
	return base + "/trip-invite/" + token
}

func buildTripInviteAppURL(token string) string {
	return "gotogether://trip-invite/" + token
}

func addMemberToTripTx(tx *sql.Tx, tripID int, actorUserID int, targetUserID int) (bool, error) {
	var exists bool
	if err := tx.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM users
			WHERE id = $1
			  AND is_deleted = FALSE
		)
	`, targetUserID).Scan(&exists); err != nil {
		return false, err
	}
	if !exists {
		return false, sql.ErrNoRows
	}

	var insertedUserID int
	err := tx.QueryRow(`
		INSERT INTO trip_members (trip_id, user_id, role)
		VALUES ($1, $2, 'member')
		ON CONFLICT (trip_id, user_id) DO NOTHING
		RETURNING user_id
	`, tripID, targetUserID).Scan(&insertedUserID)
	if err != nil {
		if sqlErrNoRows(err) {
			return false, nil
		}
		return false, err
	}

	if _, err := tx.Exec(`DELETE FROM trip_completion_confirmations WHERE trip_id = $1`, tripID); err != nil {
		return false, err
	}

	return insertedUserID > 0, nil
}

func CreateTripInvite(c *gin.Context) {
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

	var token string
	err := db.DB.QueryRow(`
		SELECT token
		FROM trip_invites
		WHERE trip_id = $1
		ORDER BY created_at ASC, id ASC
		LIMIT 1
	`, tripID).Scan(&token)
	if err != nil && !sqlErrNoRows(err) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load trip invite", "details": err.Error()})
		return
	}

	if token == "" {
		for attempt := 0; attempt < 3; attempt++ {
			nextToken, tokenErr := generateTripInviteToken()
			if tokenErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create invite token", "details": tokenErr.Error()})
				return
			}
			err = db.DB.QueryRow(`
				INSERT INTO trip_invites (trip_id, token, created_by_user_id)
				VALUES ($1, $2, $3)
				RETURNING token
			`, tripID, nextToken, userID).Scan(&token)
			if err == nil {
				break
			}
		}
		if token == "" {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create trip invite"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"token":      token,
		"invite_url": buildTripInviteURL(token),
		"app_url":    buildTripInviteAppURL(token),
	})
}

func AcceptTripInvite(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	token := strings.TrimSpace(c.Param("token"))
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invite token is required"})
		return
	}

	var tripID int
	if err := db.DB.QueryRow(`SELECT trip_id FROM trip_invites WHERE token = $1`, token).Scan(&tripID); err != nil {
		if sqlErrNoRows(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "invite not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load invite", "details": err.Error()})
		return
	}

	restrictedMemberIDs, err := filterBlockedUserIDs(userID, []int{userID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate invite", "details": err.Error()})
		return
	}
	if len(restrictedMemberIDs) > 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "this invite is unavailable"})
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer rollbackQuietly(tx)

	inserted, err := addMemberToTripTx(tx, tripID, userID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to join trip", "details": err.Error()})
		return
	}
	if !commitOrRespond(c, tx) {
		return
	}

	if inserted {
		createTripNotifications(tripID, userID, loadActorDisplayName(userID)+" joined the trip", "A new traveler joined using the invite link.", "alert", false)
	}

	c.JSON(http.StatusOK, gin.H{"accepted": true, "trip_id": tripID, "already_member": !inserted})
}

func AddTripMembers(c *gin.Context) {
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

	var req addTripMembersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	seen := map[int]bool{}
	memberIDs := make([]int, 0)
	if req.UserID > 0 {
		seen[req.UserID] = true
		memberIDs = append(memberIDs, req.UserID)
	}
	for _, id := range req.UserIDs {
		if id <= 0 || seen[id] {
			continue
		}
		seen[id] = true
		memberIDs = append(memberIDs, id)
	}
	if len(memberIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "select at least one member"})
		return
	}

	restrictedMemberIDs, err := filterBlockedUserIDs(userID, memberIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate selected members", "details": err.Error()})
		return
	}
	if len(restrictedMemberIDs) > 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "one or more selected members are unavailable"})
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer rollbackQuietly(tx)

	addedIDs := make([]int, 0)
	for _, memberID := range memberIDs {
		inserted, err := addMemberToTripTx(tx, tripID, userID, memberID)
		if err != nil {
			if sqlErrNoRows(err) {
				c.JSON(http.StatusNotFound, gin.H{"error": "selected member not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add trip member", "details": err.Error()})
			return
		}
		if inserted {
			addedIDs = append(addedIDs, memberID)
		}
	}

	if !commitOrRespond(c, tx) {
		return
	}

	for _, addedUserID := range addedIDs {
		if addedUserID != userID {
			NotifyTripMemberAdded(context.Background(), tripID, userID, addedUserID)
		}
	}

	c.JSON(http.StatusOK, gin.H{"added": true, "added_user_ids": addedIDs})
}

func RemoveTripMember(c *gin.Context) {
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

	memberID, err := strconv.Atoi(strings.TrimSpace(c.Param("userId")))
	if err != nil || memberID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid member id"})
		return
	}
	if memberID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "trip creator cannot be removed"})
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer rollbackQuietly(tx)

	result, err := tx.Exec(`DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2`, tripID, memberID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove trip member", "details": err.Error()})
		return
	}
	affected, err := result.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to confirm member removal", "details": err.Error()})
		return
	}
	if affected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
		return
	}

	if _, err := tx.Exec(`DELETE FROM trip_member_setup WHERE trip_id = $1 AND user_id = $2`, tripID, memberID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove member setup", "details": err.Error()})
		return
	}
	if _, err := tx.Exec(`DELETE FROM trip_completion_confirmations WHERE trip_id = $1 AND user_id = $2`, tripID, memberID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove completion confirmation", "details": err.Error()})
		return
	}
	if _, err := tx.Exec(`DELETE FROM trip_live_locations WHERE trip_id = $1 AND user_id = $2`, tripID, memberID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove live location", "details": err.Error()})
		return
	}

	if !commitOrRespond(c, tx) {
		return
	}

	createTripNotifications(tripID, userID, loadActorDisplayName(userID)+" removed a traveler", "A traveler was removed from "+loadTripDisplayName(tripID)+".", "alert", false)
	c.JSON(http.StatusOK, gin.H{"removed": true})
}
