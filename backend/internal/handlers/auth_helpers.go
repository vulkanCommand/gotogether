package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"gotogether-backend/internal/db"

	"github.com/gin-gonic/gin"
)

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
	emailStr, _ := email.(string)
	nameStr, _ := name.(string)

	var userID int
	err := db.DB.QueryRow(`
		INSERT INTO users (firebase_uid, email, name)
		VALUES ($1, $2, $3)
		ON CONFLICT (firebase_uid)
		DO UPDATE SET
			email = EXCLUDED.email,
			name = EXCLUDED.name
		RETURNING id
	`, strings.TrimSpace(uid), strings.TrimSpace(emailStr), strings.TrimSpace(nameStr)).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to sync authenticated user",
			"details": err.Error(),
		})
		return 0, false
	}

	return userID, true
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
