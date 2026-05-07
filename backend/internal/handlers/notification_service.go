package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"
)

type expoPushMessage struct {
	To    string         `json:"to"`
	Title string         `json:"title"`
	Body  string         `json:"body"`
	Sound string         `json:"sound,omitempty"`
	Data  map[string]any `json:"data,omitempty"`
}

func CreateNotification(
	ctx context.Context,
	userID int,
	actorUserID int,
	tripID int,
	notificationType string,
	title string,
	body string,
	data map[string]any,
) (int, error) {
	trimmedType := strings.TrimSpace(notificationType)
	if trimmedType == "" {
		trimmedType = "activity"
	}

	payload := []byte("null")
	if data != nil {
		encoded, err := json.Marshal(data)
		if err != nil {
			return 0, err
		}
		payload = encoded
	}

	var notificationID int
	err := db.DB.QueryRowContext(ctx, `
		INSERT INTO notifications (
			user_id,
			trip_id,
			title,
			body,
			type,
			kind,
			actor_user_id,
			data,
			read_at
		)
		VALUES (
			$1,
			NULLIF($2, 0),
			$3,
			$4,
			$5,
			$5,
			NULLIF($6, 0),
			$7::jsonb,
			NULL
		)
		RETURNING id
	`, userID, tripID, strings.TrimSpace(title), strings.TrimSpace(body), trimmedType, actorUserID, string(payload)).Scan(&notificationID)
	if err != nil {
		return 0, err
	}

	return notificationID, nil
}

func SendExpoPushNotification(ctx context.Context, userID int, title string, body string, data map[string]any) error {
	rows, err := db.DB.QueryContext(ctx, `
		SELECT expo_push_token
		FROM user_push_tokens
		WHERE user_id = $1
	`, userID)
	if err != nil {
		return err
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

	if err := rows.Err(); err != nil {
		return err
	}

	if len(messages) == 0 {
		return nil
	}

	payload, err := json.Marshal(messages)
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://exp.host/--/api/v2/push/send", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= 400 {
		return errors.New("expo push request failed")
	}

	return nil
}

func NotifyTripMemberAdded(ctx context.Context, tripID int, actorUserID int, addedUserID int) {
	if actorUserID <= 0 || addedUserID <= 0 || actorUserID == addedUserID {
		return
	}

	var tripName string
	if err := db.DB.QueryRowContext(ctx, `SELECT COALESCE(name, '') FROM trips WHERE id = $1`, tripID).Scan(&tripName); err != nil {
		log.Printf("notify trip member added load trip failed trip=%d user=%d: %v", tripID, addedUserID, err)
		return
	}

	actorName := "Someone"
	if actorUser, err := loadUserByID(actorUserID); err == nil {
		if strings.TrimSpace(actorUser.Name) != "" {
			actorName = strings.TrimSpace(actorUser.Name)
		} else if strings.TrimSpace(actorUser.Username) != "" {
			actorName = strings.TrimSpace(actorUser.Username)
		}
	}

	title := "You were added to a trip"
	body := strings.TrimSpace(actorName) + " added you to " + strings.TrimSpace(tripName)
	data := map[string]any{
		"type":   "trip_added",
		"tripId": tripID,
	}

	notificationID, err := CreateNotification(ctx, addedUserID, actorUserID, tripID, "trip_added", title, body, data)
	if err != nil {
		log.Printf("notify trip member added create notification failed trip=%d user=%d: %v", tripID, addedUserID, err)
		return
	}

	data["notificationId"] = notificationID
	if err := SendExpoPushNotification(ctx, addedUserID, title, body, data); err != nil {
		log.Printf("notify trip member added push failed trip=%d user=%d notification=%d: %v", tripID, addedUserID, notificationID, err)
	}
}

func createLegacyNotification(
	userID int,
	tripID int,
	title string,
	body string,
	kind string,
	requiresAction bool,
	actionType string,
	targetID int,
	actorUserID int,
) {
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

	payload := map[string]any{
		"screen":         "Notifications",
		"tripId":         tripID,
		"kind":           strings.TrimSpace(kind),
		"requiresAction": requiresAction,
	}
	notificationType := strings.TrimSpace(kind)
	if notificationType == "" {
		notificationType = "activity"
	}

	notificationData, _ := json.Marshal(payload)

	var notificationID int
	err := db.DB.QueryRow(`
		INSERT INTO notifications (
			user_id,
			trip_id,
			title,
			body,
			type,
			kind,
			requires_action,
			action_type,
			target_id,
			actor_user_id,
			data,
			read_at
		)
		VALUES (
			$1,
			NULLIF($2, 0),
			$3,
			$4,
			$5,
			$6,
			$7,
			NULLIF($8, ''),
			NULLIF($9, 0),
			NULLIF($10, 0),
			$11::jsonb,
			NULL
		)
		RETURNING id
	`, userID, tripID, strings.TrimSpace(title), strings.TrimSpace(body), notificationType, strings.TrimSpace(kind), requiresAction, actionType, targetID, actorUserID, string(notificationData)).Scan(&notificationID)
	if err != nil {
		return
	}

	payload["notificationId"] = notificationID
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
		defer cancel()
		if err := SendExpoPushNotification(ctx, userID, title, body, payload); err != nil {
			log.Printf("legacy push failed user=%d notification=%d: %v", userID, notificationID, err)
		}
	}()
}

func unreadNotificationCount(ctx context.Context, userID int) (int, error) {
	var count int
	err := db.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM notifications
		WHERE user_id = $1
		  AND cleared_at IS NULL
		  AND read_at IS NULL
	`, userID).Scan(&count)
	return count, err
}

func markNotificationReadForUser(ctx context.Context, notificationID int, userID int) error {
	_, err := db.DB.ExecContext(ctx, `
		UPDATE notifications
		SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
		WHERE id = $1
		  AND user_id = $2
		  AND cleared_at IS NULL
	`, notificationID, userID)
	return err
}

func markAllNotificationsReadForUser(ctx context.Context, userID int) error {
	_, err := db.DB.ExecContext(ctx, `
		UPDATE notifications
		SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
		WHERE user_id = $1
		  AND cleared_at IS NULL
	`, userID)
	return err
}

func loadNotificationByID(ctx context.Context, notificationID int, userID int) (models.NotificationResponse, error) {
	var item models.NotificationResponse
	var rawData []byte
	err := db.DB.QueryRowContext(ctx, `
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
		WHERE id = $1
		  AND user_id = $2
		  AND cleared_at IS NULL
	`, notificationID, userID).Scan(
		&item.ID,
		&item.TripID,
		&item.Title,
		&item.Body,
		&item.Type,
		&item.Kind,
		&item.RequiresAction,
		&item.ActionType,
		&item.TargetID,
		&item.ActionCompletedAt,
		&item.ReadAt,
		&rawData,
		&item.CreatedAt,
	)
	if err != nil {
		return item, err
	}
	item.Data = rawData
	enrichNotificationActionDetails(&item)
	return item, nil
}
