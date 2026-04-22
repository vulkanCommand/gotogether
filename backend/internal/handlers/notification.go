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
		SELECT id, COALESCE(trip_id, 0), title, body, kind, requires_action, created_at::text
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
		if err := rows.Scan(&item.ID, &item.TripID, &item.Title, &item.Body, &item.Kind, &item.RequiresAction, &item.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read notifications", "details": err.Error()})
			return
		}
		notifications = append(notifications, item)
	}

	c.JSON(http.StatusOK, gin.H{"notifications": notifications})
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
			_, _ = db.DB.Exec(`
				INSERT INTO notifications (user_id, trip_id, title, body, kind, requires_action)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, userID, tripID, strings.TrimSpace(title), strings.TrimSpace(body), strings.TrimSpace(kind), requiresAction)
		}
	}
}
