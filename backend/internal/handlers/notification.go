package handlers

import (
	"context"
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
			COALESCE(type, kind, 'activity'),
			kind,
			requires_action,
			COALESCE(action_type, ''),
			COALESCE(target_id, 0),
			COALESCE(action_completed_at::text, ''),
			COALESCE(read_at::text, ''),
			COALESCE(data::text, 'null'),
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
		var rawData []byte
		if err := rows.Scan(&item.ID, &item.TripID, &item.Title, &item.Body, &item.Type, &item.Kind, &item.RequiresAction, &item.ActionType, &item.TargetID, &item.ActionCompletedAt, &item.ReadAt, &rawData, &item.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read notifications", "details": err.Error()})
			return
		}
		item.Data = rawData
		enrichNotificationActionDetails(&item)
		notifications = append(notifications, item)
	}

	c.JSON(http.StatusOK, gin.H{"notifications": notifications})
}

func GetRecentActivity(c *gin.Context) {
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
			COALESCE(type, kind, 'activity'),
			kind,
			requires_action,
			COALESCE(action_type, ''),
			COALESCE(target_id, 0),
			COALESCE(action_completed_at::text, ''),
			COALESCE(read_at::text, ''),
			COALESCE(data::text, 'null'),
			created_at::text
		FROM notifications
		WHERE user_id = $1
		  AND cleared_at IS NULL
		ORDER BY created_at DESC, id DESC
		LIMIT 5
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch recent activity", "details": err.Error()})
		return
	}
	defer rows.Close()

	activities := make([]models.NotificationResponse, 0)
	for rows.Next() {
		var item models.NotificationResponse
		var rawData []byte
		if err := rows.Scan(&item.ID, &item.TripID, &item.Title, &item.Body, &item.Type, &item.Kind, &item.RequiresAction, &item.ActionType, &item.TargetID, &item.ActionCompletedAt, &item.ReadAt, &rawData, &item.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read recent activity", "details": err.Error()})
			return
		}
		item.Data = rawData
		enrichNotificationActionDetails(&item)
		activities = append(activities, item)
	}

	c.JSON(http.StatusOK, gin.H{"activities": activities})
}

func MarkNotificationRead(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	notificationID, err := strconv.Atoi(c.Param("notificationId"))
	if err != nil || notificationID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid notification id"})
		return
	}

	if err := markNotificationReadForUser(context.Background(), notificationID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark notification read", "details": err.Error()})
		return
	}

	notification, err := loadNotificationByID(context.Background(), notificationID, userID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"read": true})
		return
	}

	c.JSON(http.StatusOK, gin.H{"read": true, "notification": notification})
}

func MarkAllNotificationsRead(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	if err := markAllNotificationsReadForUser(context.Background(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark all notifications read", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"read": true})
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
			var exists bool
			_ = db.DB.QueryRow(`
				SELECT EXISTS (
					SELECT 1
					FROM notifications
					WHERE id = $1
						AND user_id = $2
						AND requires_action = TRUE
				)
			`, notificationID, userID).Scan(&exists)
			if exists {
				c.JSON(http.StatusOK, gin.H{"accepted": false, "stale": true})
				return
			}
			c.JSON(http.StatusNotFound, gin.H{"error": "pending action not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load pending action", "details": err.Error()})
		return
	}

	switch actionType {
	case "event_complete":
		accepted, err := acceptEventCompletion(tripID, targetID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to accept event completion", "details": err.Error()})
			return
		}
		if !accepted {
			neutralizePendingEventCompletionNotifications(tripID, targetID)
			c.JSON(http.StatusOK, gin.H{"accepted": false, "stale": true})
			return
		}
	case "trip_complete":
		if err := acceptTripCompletion(tripID, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to accept trip completion", "details": err.Error()})
			return
		}
	default:
		_, _ = db.DB.Exec(`
			UPDATE notifications
			SET action_completed_at = CURRENT_TIMESTAMP,
				cleared_at = CURRENT_TIMESTAMP
			WHERE id = $1 AND user_id = $2
		`, notificationID, userID)
		c.JSON(http.StatusOK, gin.H{"accepted": false, "stale": true})
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

func enrichNotificationActionDetails(item *models.NotificationResponse) {
	actionType := strings.TrimSpace(item.ActionType)
	switch actionType {
	case "event_complete":
		item.ActionLabel = "Confirm event completion"
		var eventTitle, dayTitle, tripName string
		err := db.DB.QueryRow(`
			SELECT COALESCE(e.title, ''), COALESCE(d.title, ''), COALESCE(t.name, '')
			FROM itinerary_events e
			INNER JOIN itinerary_days d ON d.id = e.itinerary_day_id
			INNER JOIN trips t ON t.id = d.trip_id
			WHERE e.id = $1 AND d.trip_id = $2
		`, item.TargetID, item.TripID).Scan(&eventTitle, &dayTitle, &tripName)
		if err == nil {
			detailParts := make([]string, 0, 3)
			if strings.TrimSpace(tripName) != "" {
				detailParts = append(detailParts, strings.TrimSpace(tripName))
			}
			if strings.TrimSpace(dayTitle) != "" {
				detailParts = append(detailParts, strings.TrimSpace(dayTitle))
			}
			if strings.TrimSpace(eventTitle) != "" {
				detailParts = append(detailParts, strings.TrimSpace(eventTitle))
			}
			item.TargetTitle = strings.Join(detailParts, " - ")
		}
	case "trip_complete":
		item.ActionLabel = "Confirm trip completion"
		var tripName string
		if err := db.DB.QueryRow(`SELECT COALESCE(name, '') FROM trips WHERE id = $1`, item.TripID).Scan(&tripName); err == nil {
			item.TargetTitle = strings.TrimSpace(tripName)
		}
	default:
		if item.RequiresAction {
			item.ActionLabel = "Pending confirmation"
			item.TargetTitle = strings.TrimSpace(item.Title)
		}
	}
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
	createLegacyNotification(userID, tripID, title, body, kind, requiresAction, actionType, targetID, actorUserID)
}
