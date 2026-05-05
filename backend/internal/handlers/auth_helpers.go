package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"

	"github.com/gin-gonic/gin"
)

var nonDigitPattern = regexp.MustCompile(`\D+`)
var nonUsernamePattern = regexp.MustCompile(`[^a-z0-9]+`)

func getOrCreateAuthenticatedUserID(c *gin.Context) (int, bool) {
	if db.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database not connected"})
		return 0, false
	}

	uidValue, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing authenticated user"})
		return 0, false
	}

	uid, ok := uidValue.(string)
	if !ok || strings.TrimSpace(uid) == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authenticated user"})
		return 0, false
	}

	email, _ := c.Get("email")
	name, _ := c.Get("name")
	phone, _ := c.Get("phone")
	emailStr, _ := email.(string)
	nameStr, _ := name.(string)
	phoneStr, _ := phone.(string)
	normalizedPhone := normalizePhone(phoneStr)
	defaultUsername := generateDefaultUsername(nameStr, normalizedPhone, uid)

	var userID int
	err := db.DB.QueryRow(`
		INSERT INTO users (firebase_uid, email, name, phone, username)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (firebase_uid)
		DO UPDATE SET
			email = COALESCE(NULLIF(EXCLUDED.email, ''), users.email),
			name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name),
			phone = COALESCE(NULLIF(EXCLUDED.phone, ''), users.phone),
			username = COALESCE(NULLIF(users.username, ''), NULLIF(EXCLUDED.username, ''), users.username),
			updated_at = CURRENT_TIMESTAMP
		RETURNING id
	`, strings.TrimSpace(uid), strings.TrimSpace(emailStr), strings.TrimSpace(nameStr), normalizedPhone, defaultUsername).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to sync authenticated user",
			"details": err.Error(),
		})
		return 0, false
	}

	return userID, true
}

func loadUserByID(userID int) (models.User, error) {
	var user models.User
	err := db.DB.QueryRow(`
		SELECT
			id,
			firebase_uid,
			COALESCE(email, ''),
			COALESCE(name, ''),
			COALESCE(phone, ''),
			COALESCE(username, ''),
			COALESCE(home_city, ''),
			COALESCE(bio, ''),
			COALESCE(profile_image_url, '')
		FROM users
		WHERE id = $1
	`, userID).Scan(
		&user.ID,
		&user.FirebaseUID,
		&user.Email,
		&user.Name,
		&user.Phone,
		&user.Username,
		&user.HomeCity,
		&user.Bio,
		&user.ProfileImageURL,
	)
	if err != nil {
		return user, err
	}

	user.ProfileComplete = strings.TrimSpace(user.Name) != ""
	return user, nil
}

func ensureTripAccess(c *gin.Context, tripID int, userID int) bool {
	var exists bool
	err := db.DB.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM trips t
			LEFT JOIN trip_members tm ON tm.trip_id = t.id
			WHERE t.id = $1
			  AND (t.created_by = $2 OR tm.user_id = $2)
		)
	`, tripID, userID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to verify trip access",
			"details": err.Error(),
		})
		return false
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
		return false
	}

	return true
}

func tripRole(userID int, tripID int) (string, error) {
	var role string
	err := db.DB.QueryRow(`
		SELECT COALESCE(tm.role, '')
		FROM trip_members tm
		WHERE tm.trip_id = $1 AND tm.user_id = $2
	`, tripID, userID).Scan(&role)
	if err == nil {
		return strings.ToLower(strings.TrimSpace(role)), nil
	}

	if !sqlErrNoRows(err) {
		return "", err
	}

	var createdBy int
	if creatorErr := db.DB.QueryRow(`SELECT created_by FROM trips WHERE id = $1`, tripID).Scan(&createdBy); creatorErr != nil {
		return "", creatorErr
	}
	if createdBy == userID {
		return "lead", nil
	}

	return "", sql.ErrNoRows
}

func ensureTripLeadAccess(c *gin.Context, tripID int, userID int) bool {
	role, err := tripRole(userID, tripID)
	if err != nil {
		if sqlErrNoRows(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
			return false
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to verify trip lead access",
			"details": err.Error(),
		})
		return false
	}

	if role != "lead" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the trip lead can manage this"})
		return false
	}

	return true
}

func rollbackQuietly(tx *sql.Tx) {
	if tx != nil {
		_ = tx.Rollback()
	}
}

func commitOrRespond(c *gin.Context, tx *sql.Tx) bool {
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save changes"})
		return false
	}
	return true
}

func sqlErrNoRows(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}

func normalizePhone(value string) string {
	digits := nonDigitPattern.ReplaceAllString(strings.TrimSpace(value), "")
	if digits == "" {
		return ""
	}

	if len(digits) == 10 {
		return "1" + digits
	}

	return digits
}

func generateDefaultUsername(name string, phone string, uid string) string {
	base := strings.ToLower(strings.TrimSpace(name))
	replacer := strings.NewReplacer(" ", "", "-", "", "_", "", ".", "")
	base = replacer.Replace(base)
	base = nonUsernamePattern.ReplaceAllString(base, "")
	if len(base) >= 3 {
		return "gt" + base
	}

	normalizedPhone := normalizePhone(phone)
	if len(normalizedPhone) >= 4 {
		return "traveler" + normalizedPhone[len(normalizedPhone)-4:]
	}

	trimmedUID := strings.ToLower(strings.TrimSpace(uid))
	if trimmedUID == "" {
		return "traveler"
	}

	allowed := nonUsernamePattern.ReplaceAllString(trimmedUID, "")
	if len(allowed) > 6 {
		allowed = allowed[:6]
	}
	if len(allowed) == 0 {
		return "traveler"
	}

	return "traveler" + allowed
}
