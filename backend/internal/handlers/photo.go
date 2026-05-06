package handlers

import (
	"context"
	"database/sql"
	"io"
	"net/http"
	"strconv"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"
	tripstorage "gotogether-backend/internal/storage"

	"github.com/gin-gonic/gin"
)

func GetTripPhotos(c *gin.Context) {
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
			tp.id,
			tp.image_url,
			COALESCE(tp.caption, ''),
			COALESCE(u.name, ''),
			tp.created_at::text
		FROM trip_photos tp
		LEFT JOIN users u ON u.id = tp.uploaded_by_user_id
		WHERE tp.trip_id = $1
		ORDER BY tp.created_at DESC, tp.id DESC
	`, tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch trip photos", "details": err.Error()})
		return
	}
	defer rows.Close()

	photos := make([]models.TripPhoto, 0)
	for rows.Next() {
		var photo models.TripPhoto
		if err := rows.Scan(&photo.ID, &photo.ImageURL, &photo.Caption, &photo.UploadedBy, &photo.UploadedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read trip photos", "details": err.Error()})
			return
		}
		photos = append(photos, photo)
	}

	c.JSON(http.StatusOK, gin.H{"photos": photos})
}

func CreateTripPhoto(c *gin.Context) {
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

	fileHeader, err := c.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "photo file is required"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to open uploaded photo"})
		return
	}
	defer file.Close()

	caption := c.PostForm("caption")
	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/jpeg"
	}

	imageURL, err := tripstorage.UploadTripPhoto(context.Background(), tripID, userID, fileHeader.Filename, contentType, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload trip photo", "details": err.Error()})
		return
	}

	var photo models.TripPhoto
	err = db.DB.QueryRow(`
		INSERT INTO trip_photos (trip_id, image_url, caption, uploaded_by_user_id)
		VALUES ($1, $2, $3, $4)
		RETURNING id, image_url, COALESCE(caption, ''), created_at::text
	`, tripID, imageURL, caption, userID).Scan(&photo.ID, &photo.ImageURL, &photo.Caption, &photo.UploadedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save trip photo", "details": err.Error()})
		return
	}

	nameValue, _ := c.Get("name")
	photo.UploadedBy, _ = nameValue.(string)

	c.JSON(http.StatusCreated, gin.H{"photo": photo})
}

func GetTripPhotoFile(c *gin.Context) {
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

	photoID, err := strconv.Atoi(c.Param("photoId"))
	if err != nil || photoID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid photo id"})
		return
	}

	var imageURL string
	err = db.DB.QueryRow(`
		SELECT image_url
		FROM trip_photos
		WHERE id = $1 AND trip_id = $2
	`, photoID, tripID).Scan(&imageURL)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "photo not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load photo", "details": err.Error()})
		return
	}

	reader, contentType, err := tripstorage.OpenObjectByURL(context.Background(), imageURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read photo", "details": err.Error()})
		return
	}
	defer reader.Close()

	if contentType == "" {
		contentType = "image/jpeg"
	}
	c.Header("Content-Type", contentType)
	if _, err := io.Copy(c.Writer, reader); err != nil {
		c.Status(http.StatusInternalServerError)
	}
}


func DeleteTripPhoto(c *gin.Context) {
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

	photoID, err := strconv.Atoi(c.Param("photoId"))
	if err != nil || photoID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid photo id"})
		return
	}

	result, err := db.DB.Exec(`
		DELETE FROM trip_photos
		WHERE id = $1 AND trip_id = $2
	`, photoID, tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete trip photo", "details": err.Error()})
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to confirm trip photo delete", "details": err.Error()})
		return
	}
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "photo not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

func UpdateTripCover(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}
	tripID, ok := parseTripID(c)
	if !ok {
		return
	}
	if !ensureTripLeadAccess(c, tripID, userID) {
		return
	}

	fileHeader, err := c.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "photo file is required"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to open uploaded photo"})
		return
	}
	defer file.Close()

	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/jpeg"
	}

	imageURL, err := tripstorage.UploadTripCover(context.Background(), tripID, userID, fileHeader.Filename, contentType, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload trip cover", "details": err.Error()})
		return
	}

	if _, err := db.DB.Exec(`UPDATE trips SET image_url = $1 WHERE id = $2`, imageURL, tripID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save trip cover", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"image_url": imageURL})
}

func DeleteTripCover(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}
	tripID, ok := parseTripID(c)
	if !ok {
		return
	}
	if !ensureTripLeadAccess(c, tripID, userID) {
		return
	}

	if _, err := db.DB.Exec(`UPDATE trips SET image_url = NULL WHERE id = $1`, tripID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove trip cover", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"removed": true})
}

func GetTripCoverFile(c *gin.Context) {
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

	var imageURL string
	err := db.DB.QueryRow(`SELECT COALESCE(image_url, '') FROM trips WHERE id = $1`, tripID).Scan(&imageURL)
	if err != nil || imageURL == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "trip cover not found"})
		return
	}

	streamObjectToResponse(c, imageURL)
}

func UpdateProfileImage(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	fileHeader, err := c.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "photo file is required"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to open uploaded photo"})
		return
	}
	defer file.Close()

	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/jpeg"
	}

	imageURL, err := tripstorage.UploadProfileImage(context.Background(), userID, fileHeader.Filename, contentType, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload profile image", "details": err.Error()})
		return
	}

	if _, err := db.DB.Exec(`UPDATE users SET profile_image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, imageURL, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save profile image", "details": err.Error()})
		return
	}

	user, err := loadUserByID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func DeleteProfileImage(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	if _, err := db.DB.Exec(`UPDATE users SET profile_image_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove profile image", "details": err.Error()})
		return
	}

	user, err := loadUserByID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func GetProfileImageFile(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	var imageURL string
	err := db.DB.QueryRow(`SELECT COALESCE(profile_image_url, '') FROM users WHERE id = $1`, userID).Scan(&imageURL)
	if err != nil || imageURL == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "profile image not found"})
		return
	}

	streamObjectToResponse(c, imageURL)
}

func GetUserProfileImageFile(c *gin.Context) {
	if _, ok := getOrCreateAuthenticatedUserID(c); !ok {
		return
	}

	targetUserID, err := strconv.Atoi(c.Param("userId"))
	if err != nil || targetUserID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	var imageURL string
	err = db.DB.QueryRow(`SELECT COALESCE(profile_image_url, '') FROM users WHERE id = $1`, targetUserID).Scan(&imageURL)
	if err != nil || imageURL == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "profile image not found"})
		return
	}

	streamObjectToResponse(c, imageURL)
}

func streamObjectToResponse(c *gin.Context, imageURL string) {
	reader, contentType, err := tripstorage.OpenObjectByURL(context.Background(), imageURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read image", "details": err.Error()})
		return
	}
	defer reader.Close()

	if contentType == "" {
		contentType = "image/jpeg"
	}
	c.Header("Content-Type", contentType)
	if _, err := io.Copy(c.Writer, reader); err != nil {
		c.Status(http.StatusInternalServerError)
	}
}
