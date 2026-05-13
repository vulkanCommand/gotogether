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

func updateAuthenticatedUserProfile(userID int, email string, name string, phone string) error {
	_, err := db.DB.Exec(`
		UPDATE users
		SET
			email = CASE WHEN $2 <> '' THEN $2 ELSE email END,
			name = CASE WHEN $3 <> '' THEN $3 ELSE name END,
			phone = CASE WHEN $4 <> '' THEN $4 ELSE phone END,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, userID, email, name, phone)
	return err
}

func tombstoneDeletedFirebaseUID(firebaseUID string) error {
	trimmedUID := strings.TrimSpace(firebaseUID)
	if trimmedUID == "" {
		return nil
	}

	_, err := db.DB.Exec(`
		UPDATE users
		SET
			firebase_uid = firebase_uid || ':deleted:' || id::text,
			updated_at = CURRENT_TIMESTAMP
		WHERE firebase_uid = $1
		  AND is_deleted = TRUE
	`, trimmedUID)
	return err
}

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
	trimmedUID := strings.TrimSpace(uid)
	trimmedEmail := strings.TrimSpace(emailStr)
	trimmedName := strings.TrimSpace(nameStr)
	normalizedPhone := normalizePhone(phoneStr)
	defaultUsername := generateDefaultUsername(trimmedName, normalizedPhone, trimmedUID)

	var userID int

	err := db.DB.QueryRow(`
		SELECT id
		FROM users
		WHERE firebase_uid = $1
		  AND is_deleted = FALSE
		ORDER BY id ASC
		LIMIT 1
	`, trimmedUID).Scan(&userID)
	if err == nil {
		if updateErr := updateAuthenticatedUserProfile(userID, trimmedEmail, trimmedName, normalizedPhone); updateErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "failed to sync authenticated user",
				"details": updateErr.Error(),
			})
			return 0, false
		}
		return userID, true
	}
	if !sqlErrNoRows(err) {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to sync authenticated user",
			"details": err.Error(),
		})
		return 0, false
	}

	if normalizedPhone != "" {
		err = db.DB.QueryRow(`
			SELECT id
			FROM users
			WHERE is_deleted = FALSE
			  AND COALESCE(phone, '') <> ''
			  AND (
					CASE
						WHEN LENGTH(REGEXP_REPLACE(COALESCE(phone, ''), '\D', '', 'g')) = 10
							THEN '1' || REGEXP_REPLACE(COALESCE(phone, ''), '\D', '', 'g')
						ELSE REGEXP_REPLACE(COALESCE(phone, ''), '\D', '', 'g')
					END
			  ) = $1
			ORDER BY id ASC
			LIMIT 1
		`, normalizedPhone).Scan(&userID)
		if err == nil {
			if tombstoneErr := tombstoneDeletedFirebaseUID(trimmedUID); tombstoneErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "failed to sync authenticated user",
					"details": tombstoneErr.Error(),
				})
				return 0, false
			}

			if _, updateErr := db.DB.Exec(`
				UPDATE users
				SET
					firebase_uid = $2,
					email = CASE WHEN $3 <> '' THEN $3 ELSE email END,
					name = CASE WHEN $4 <> '' THEN $4 ELSE name END,
					phone = CASE WHEN $5 <> '' THEN $5 ELSE phone END,
					updated_at = CURRENT_TIMESTAMP
				WHERE id = $1
			`, userID, trimmedUID, trimmedEmail, trimmedName, normalizedPhone); updateErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "failed to sync authenticated user",
					"details": updateErr.Error(),
				})
				return 0, false
			}

			return userID, true
		}
		if !sqlErrNoRows(err) {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "failed to sync authenticated user",
				"details": err.Error(),
			})
			return 0, false
		}
	}

	if tombstoneErr := tombstoneDeletedFirebaseUID(trimmedUID); tombstoneErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to sync authenticated user",
			"details": tombstoneErr.Error(),
		})
		return 0, false
	}

	err = db.DB.QueryRow(`
		INSERT INTO users (firebase_uid, email, name, phone, username)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, trimmedUID, trimmedEmail, trimmedName, normalizedPhone, defaultUsername).Scan(&userID)
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
		  AND is_deleted = FALSE
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
