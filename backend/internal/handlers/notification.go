package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func GetNotifications(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	rows, err := db.DB.Query(`
		SELECT
			id,
			COALESCE(trip_id, 0),
			title,
			body,
			kind,
			requires_action,
			COALESCE(action_type, ''),
			COALESCE(target_id, 0),
			COALESCE(action_completed_at::text, ''),
			created_at::text
		FROM notifications
		WHERE user_id = $1 AND cleared_at IS NULL
		ORDER BY created_at DESC, id DESC
		LIMIT 100
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch notifications", "details": err.Error()})
		return
	}
	defer rows.Close()

	notifications := make([]models.NotificationResponse, 0)
	for rows.Next() {
		var item models.NotificationResponse
		if err := rows.Scan(&item.ID, &item.TripID, &item.Title, &item.Body, &item.Kind, &item.RequiresAction, &item.ActionType, &item.TargetID, &item.ActionCompletedAt, &item.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read notifications", "details": err.Error()})
			return
		}
		notifications = append(notifications, item)
	}

	c.JSON(http.StatusOK, gin.H{"notifications": notifications})
}

func AcceptNotificationAction(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	notificationID, err := strconv.Atoi(c.Param("notificationId"))
	if err != nil || notificationID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid notification id"})
		return
	}

	var tripID, targetID int
	var actionType string
	err = db.DB.QueryRow(`
		SELECT COALESCE(trip_id, 0), COALESCE(action_type, ''), COALESCE(target_id, 0)
		FROM notifications
		WHERE id = $1
			AND user_id = $2
			AND requires_action = TRUE
			AND action_completed_at IS NULL
	`, notificationID, userID).Scan(&tripID, &actionType, &targetID)
	if err != nil {
		if sqlErrNoRows(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "pending action not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load pending action", "details": err.Error()})
		return
	}

	switch actionType {
	case "event_complete":
		if err := acceptEventCompletion(tripID, targetID, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to accept event completion", "details": err.Error()})
			return
		}
	case "trip_complete":
		if err := acceptTripCompletion(tripID, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to accept trip completion", "details": err.Error()})
			return
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported pending action"})
		return
	}

	_, _ = db.DB.Exec(`
		UPDATE notifications
		SET action_completed_at = CURRENT_TIMESTAMP, cleared_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND user_id = $2
	`, notificationID, userID)

	user, _ := loadUserByID(userID)
	createUserNotification(userID, tripID, "Task accepted", "You accepted the completion request.", "alert", false, "", 0, userID)
	createTripNotifications(tripID, userID, "Task accepted", user.Name+" accepted "+strings.ReplaceAll(actionType, "_", " ")+".", "alert", false)
	c.JSON(http.StatusOK, gin.H{"accepted": true})
}

func ClearNotification(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	notificationID, err := strconv.Atoi(c.Param("notificationId"))
	if err != nil || notificationID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid notification id"})
		return
	}

	_, err = db.DB.Exec(`
		UPDATE notifications
		SET cleared_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND user_id = $2 AND requires_action = FALSE
	`, notificationID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to clear notification", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"cleared": true})
}

func ClearAllNotifications(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	if _, err := db.DB.Exec(`
		UPDATE notifications
		SET cleared_at = CURRENT_TIMESTAMP
		WHERE user_id = $1 AND requires_action = FALSE
	`, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to clear notifications", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"cleared": true})
}

func createTripNotifications(tripID int, actorUserID int, title string, body string, kind string, requiresAction bool) {
	createTripActionNotifications(tripID, actorUserID, title, body, kind, requiresAction, "", 0)
}

func createTripActionNotifications(tripID int, actorUserID int, title string, body string, kind string, requiresAction bool, actionType string, targetID int) {
	rows, err := db.DB.Query(`
		SELECT user_id
		FROM trip_members
		WHERE trip_id = $1 AND user_id <> $2
	`, tripID, actorUserID)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var userID int
		if err := rows.Scan(&userID); err == nil {
			createUserNotification(userID, tripID, title, body, kind, requiresAction, actionType, targetID, actorUserID)
		}
	}
}

func createUserNotification(userID int, tripID int, title string, body string, kind string, requiresAction bool, actionType string, targetID int, actorUserID int) {
	actionType = strings.TrimSpace(actionType)
	if requiresAction && actionType != "" && targetID > 0 {
		var existingID int
		err := db.DB.QueryRow(`
			SELECT id
			FROM notifications
			WHERE user_id = $1
				AND trip_id = $2
				AND action_type = $3
				AND target_id = $4
				AND requires_action = TRUE
				AND action_completed_at IS NULL
				AND cleared_at IS NULL
			LIMIT 1
		`, userID, tripID, actionType, targetID).Scan(&existingID)
		if err == nil && existingID > 0 {
			return
		}
	}

	_, _ = db.DB.Exec(`
		INSERT INTO notifications (
			user_id, trip_id, title, body, kind, requires_action, action_type, target_id, actor_user_id
		)
		VALUES ($1, NULLIF($2, 0), $3, $4, $5, $6, NULLIF($7, ''), NULLIF($8, 0), NULLIF($9, 0))
	`, userID, tripID, strings.TrimSpace(title), strings.TrimSpace(body), strings.TrimSpace(kind), requiresAction, actionType, targetID, actorUserID)
}
