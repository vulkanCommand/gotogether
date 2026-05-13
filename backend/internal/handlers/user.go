package handlers

import (
	"context"
	"net/http"
	"strings"

	"gotogether-backend/internal/auth"
	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func GetMe(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	user, err := loadUserByID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Authenticated user",
		"user":    user,
	})
}

func UpdateMe(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	var req models.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Phone = normalizePhone(req.Phone)
	req.Username = strings.TrimSpace(req.Username)
	req.HomeCity = strings.TrimSpace(req.HomeCity)
	req.Bio = strings.TrimSpace(req.Bio)

	nameValidation := validateUserText(req.Name, textValidationOptions{Required: true, MaxLength: 60})
	req.Name = nameValidation.Value

	if nameValidation.Empty {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	if nameValidation.TooLong || nameValidation.Unsafe {
		c.JSON(http.StatusBadRequest, gin.H{"error": friendlyTextValidationMessage})
		return
	}

	if req.Username == "" {
		uidValue, _ := c.Get("uid")
		uid, _ := uidValue.(string)
		req.Username = generateDefaultUsername(req.Name, req.Phone, uid)
	}

	_, err := db.DB.Exec(`
		UPDATE users
		SET
			name = $2,
			phone = CASE WHEN $3 <> '' THEN $3 ELSE phone END,
			username = $4,
			home_city = $5,
			bio = $6,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, userID, req.Name, req.Phone, req.Username, req.HomeCity, req.Bio)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update profile", "details": err.Error()})
		return
	}

	user, err := loadUserByID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func DeleteMe(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	uidValue, _ := c.Get("uid")
	uid, _ := uidValue.(string)

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer rollbackQuietly(tx)

	if _, err := tx.Exec(`
		UPDATE users
		SET
			is_deleted = TRUE,
			deleted_at = CURRENT_TIMESTAMP,
			updated_at = CURRENT_TIMESTAMP,
			firebase_uid = CASE
				WHEN COALESCE(firebase_uid, '') = '' THEN 'deleted:' || id::text
				ELSE firebase_uid || ':deleted:' || id::text
			END,
			phone = '',
			email = '',
			username = '',
			profile_image_url = ''
		WHERE id = $1
	`, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete account", "details": err.Error()})
		return
	}

	if !commitOrRespond(c, tx) {
		return
	}

	authDeleted := true
	if strings.TrimSpace(uid) != "" {
		if err := auth.FirebaseAuth.DeleteUser(context.Background(), uid); err != nil {
			authDeleted = false
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"deleted":      true,
		"auth_deleted": authDeleted,
	})
}
