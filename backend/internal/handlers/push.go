package handlers

import (
	"net/http"
	"strings"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func RegisterPushToken(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	var req models.PushTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	token := strings.TrimSpace(req.ExpoPushToken)
	if token == "" {
		token = strings.TrimSpace(req.Token)
	}
	if !isExpoPushToken(token) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid expo push token"})
		return
	}

	platform := strings.TrimSpace(req.Platform)
	if platform == "" {
		platform = "expo"
	}

	if _, err := db.DB.Exec(`
		INSERT INTO user_push_tokens (user_id, expo_push_token, platform, device_id)
		VALUES ($1, $2, $3, NULLIF($4, ''))
		ON CONFLICT (expo_push_token)
		DO UPDATE SET
			user_id = EXCLUDED.user_id,
			platform = EXCLUDED.platform,
			device_id = EXCLUDED.device_id,
			updated_at = CURRENT_TIMESTAMP
	`, userID, token, platform, strings.TrimSpace(req.DeviceID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save push token", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"saved": true})
}

func UnregisterPushToken(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	var req models.PushTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	token := strings.TrimSpace(req.ExpoPushToken)
	if token == "" {
		token = strings.TrimSpace(req.Token)
	}
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token is required"})
		return
	}

	if _, err := db.DB.Exec(`DELETE FROM user_push_tokens WHERE user_id = $1 AND expo_push_token = $2`, userID, token); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove push token", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"removed": true})
}

func isExpoPushToken(token string) bool {
	return strings.HasPrefix(token, "ExponentPushToken[") || strings.HasPrefix(token, "ExpoPushToken[")
}
