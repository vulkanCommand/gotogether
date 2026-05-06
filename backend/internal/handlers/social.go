package handlers

import (
	"net/http"
	"strings"
	"time"

	"gotogether-backend/internal/config"
	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"
	"gotogether-backend/internal/sms"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
)

func SyncContacts(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	var req models.ContactSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	emails := make([]string, 0, len(req.Emails))
	for _, email := range req.Emails {
		normalized := strings.ToLower(strings.TrimSpace(email))
		if normalized != "" {
			emails = append(emails, normalized)
		}
	}

	phones := make([]string, 0, len(req.Phones))
	for _, phone := range req.Phones {
		normalized := normalizePhone(phone)
		if normalized != "" {
			phones = append(phones, normalized)
		}
	}

	rows, err := db.DB.Query(`
		SELECT
			id,
			COALESCE(name, ''),
			COALESCE(email, ''),
			COALESCE(phone, ''),
			COALESCE(username, ''),
			COALESCE(home_city, ''),
			COALESCE(profile_image_url, '')
		FROM users
		WHERE id <> $1
		  AND (
				(array_length($2::text[], 1) IS NOT NULL AND LOWER(COALESCE(email, '')) = ANY($2::text[]))
				OR
				(array_length($3::text[], 1) IS NOT NULL AND COALESCE(phone, '') = ANY($3::text[]))
		  )
		ORDER BY name ASC, id ASC
	`, userID, pq.Array(emails), pq.Array(phones))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to match contacts", "details": err.Error()})
		return
	}
	defer rows.Close()

	friends := make([]models.Friend, 0)
	friendIDs := make([]int, 0)
	for rows.Next() {
		var friend models.Friend
		if err := rows.Scan(&friend.ID, &friend.Name, &friend.Email, &friend.Phone, &friend.Username, &friend.HomeCity, &friend.ProfileImageURL); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read matched contacts", "details": err.Error()})
			return
		}
		friends = append(friends, friend)
		friendIDs = append(friendIDs, friend.ID)
	}

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer rollbackQuietly(tx)

	for _, friendID := range friendIDs {
		if _, err := tx.Exec(`
			INSERT INTO friendships (user_id, friend_user_id)
			VALUES ($1, $2), ($2, $1)
			ON CONFLICT (user_id, friend_user_id) DO NOTHING
		`, userID, friendID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save friendships", "details": err.Error()})
			return
		}
	}

	if !commitOrRespond(c, tx) {
		return
	}

	c.JSON(http.StatusOK, gin.H{"friends": friends})
}

func GetFriends(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	rows, err := db.DB.Query(`
		SELECT
			u.id,
			COALESCE(u.name, ''),
			COALESCE(u.email, ''),
			COALESCE(u.phone, ''),
			COALESCE(u.username, ''),
			COALESCE(u.home_city, ''),
			COALESCE(u.profile_image_url, '')
		FROM friendships f
		INNER JOIN users u ON u.id = f.friend_user_id
		WHERE f.user_id = $1
		ORDER BY u.name ASC, u.id ASC
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch friends", "details": err.Error()})
		return
	}
	defer rows.Close()

	friends := make([]models.Friend, 0)
	for rows.Next() {
		var friend models.Friend
		if err := rows.Scan(&friend.ID, &friend.Name, &friend.Email, &friend.Phone, &friend.Username, &friend.HomeCity, &friend.ProfileImageURL); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read friends", "details": err.Error()})
			return
		}
		friends = append(friends, friend)
	}

	c.JSON(http.StatusOK, gin.H{"friends": friends})
}

func SendSMSInvite(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	var req models.SMSInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	normalizedPhone := normalizePhone(req.Phone)
	if normalizedPhone == "" || len(normalizedPhone) < 10 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "a valid phone number is required"})
		return
	}

	var currentUserPhone string
	var inviterName string
	if err := db.DB.QueryRow(`
		SELECT COALESCE(phone, ''), COALESCE(NULLIF(name, ''), NULLIF(username, ''), NULLIF(email, ''), 'Your friend')
		FROM users
		WHERE id = $1
	`, userID).Scan(&currentUserPhone, &inviterName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load inviter", "details": err.Error()})
		return
	}

	if normalizePhone(currentUserPhone) == normalizedPhone {
		c.JSON(http.StatusBadRequest, gin.H{"error": "you cannot invite your own phone number"})
		return
	}

	var recentInviteCount int
	if err := db.DB.QueryRow(`
		SELECT COUNT(1)
		FROM sms_invites
		WHERE sender_user_id = $1
		  AND recipient_phone = $2
		  AND created_at >= $3
	`, userID, normalizedPhone, time.Now().Add(-15*time.Minute)).Scan(&recentInviteCount); err == nil && recentInviteCount >= 3 {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many invites sent to this number recently"})
		return
	}

	cfg := config.Load()
	sender, err := sms.NewTwilioSender(cfg)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "sms provider is not configured"})
		return
	}

	displayName := strings.TrimSpace(req.Name)
	if displayName == "" {
		displayName = "there"
	}

	messageBody := inviterName + " invited you to join GoTogether for trip planning. " +
		"Create your account and join the crew here: " + strings.TrimSpace(cfg.AppInviteURL)

	messageSID, err := sender.SendSMS("+"+normalizedPhone, messageBody)
	status := "sent"
	if err != nil {
		status = "failed"
	}

	_, _ = db.DB.Exec(`
		INSERT INTO sms_invites (
			sender_user_id,
			recipient_phone,
			recipient_name,
			provider,
			provider_message_sid,
			status,
			invite_context
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, userID, normalizedPhone, displayName, "twilio", messageSID, status, "create_group")

	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to send sms invite", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.SMSInviteResponse{
		Sent:           true,
		RecipientPhone: normalizedPhone,
		Provider:       "twilio",
		MessageSID:     messageSID,
	})
}

func UpdateTripLocation(c *gin.Context) {
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

	var req models.LiveLocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if req.Latitude < -90 || req.Latitude > 90 || req.Longitude < -180 || req.Longitude > 180 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid coordinates"})
		return
	}

	_, err := db.DB.Exec(`
		INSERT INTO trip_live_locations (trip_id, user_id, latitude, longitude, accuracy, updated_at)
		VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
		ON CONFLICT (trip_id, user_id)
		DO UPDATE SET
			latitude = EXCLUDED.latitude,
			longitude = EXCLUDED.longitude,
			accuracy = EXCLUDED.accuracy,
			updated_at = CURRENT_TIMESTAMP
	`, tripID, userID, req.Latitude, req.Longitude, req.Accuracy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update location", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func GetTripLiveLocations(c *gin.Context) {
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

	rows, err := db.DB.Query(`
		SELECT
			u.id,
			COALESCE(u.name, ''),
			COALESCE(u.email, ''),
			COALESCE(u.profile_image_url, ''),
			tll.latitude,
			tll.longitude,
			tll.accuracy,
			COALESCE(tll.updated_at::text, '')
		FROM trip_members tm
		INNER JOIN users u ON u.id = tm.user_id
		LEFT JOIN trip_live_locations tll
			ON tll.trip_id = tm.trip_id
			AND tll.user_id = tm.user_id
		WHERE tm.trip_id = $1
		ORDER BY u.name ASC, u.id ASC
	`, tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch live locations", "details": err.Error()})
		return
	}
	defer rows.Close()

	locations := make([]models.TripLiveLocation, 0)
	for rows.Next() {
		var item models.TripLiveLocation
		if err := rows.Scan(&item.UserID, &item.Name, &item.Email, &item.ProfileImageURL, &item.Latitude, &item.Longitude, &item.Accuracy, &item.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read live locations", "details": err.Error()})
			return
		}
		item.IsCurrent = item.UserID == userID
		locations = append(locations, item)
	}

	c.JSON(http.StatusOK, gin.H{"locations": locations})
}
