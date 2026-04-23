package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"

	"github.com/gin-gonic/gin"
)

type expoPushMessage struct {
	To    string         `json:"to"`
	Title string         `json:"title"`
	Body  string         `json:"body"`
	Sound string         `json:"sound,omitempty"`
	Data  map[string]any `json:"data,omitempty"`
}

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

	token := strings.TrimSpace(req.Token)
	if !isExpoPushToken(token) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid expo push token"})
		return
	}

	platform := strings.TrimSpace(req.Platform)
	if platform == "" {
		platform = "expo"
	}

	if _, err := db.DB.Exec(`
		INSERT INTO user_push_tokens (user_id, expo_push_token, platform)
		VALUES ($1, $2, $3)
		ON CONFLICT (expo_push_token)
		DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = CURRENT_TIMESTAMP
	`, userID, token, platform); err != nil {
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

	token := strings.TrimSpace(req.Token)
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

func sendPushNotificationToUser(userID int, title string, body string, data map[string]any) {
	rows, err := db.DB.Query(`
		SELECT expo_push_token
		FROM user_push_tokens
		WHERE user_id = $1
	`, userID)
	if err != nil {
		return
	}
	defer rows.Close()

	messages := make([]expoPushMessage, 0)
	for rows.Next() {
		var token string
		if err := rows.Scan(&token); err == nil && isExpoPushToken(strings.TrimSpace(token)) {
			messages = append(messages, expoPushMessage{
				To:    strings.TrimSpace(token),
				Title: strings.TrimSpace(title),
				Body:  strings.TrimSpace(body),
				Sound: "default",
				Data:  data,
			})
		}
	}

	if len(messages) == 0 {
		return
	}

	payload, err := json.Marshal(messages)
	if err != nil {
		return
	}

	request, err := http.NewRequest(http.MethodPost, "https://exp.host/--/api/v2/push/send", bytes.NewReader(payload))
	if err != nil {
		return
	}
	request.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return
	}
	defer response.Body.Close()

	if response.StatusCode >= 400 {
		return
	}
}
