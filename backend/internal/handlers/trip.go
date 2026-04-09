package handlers

import (
	"net/http"
	"strings"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func CreateTrip(c *gin.Context) {
	if db.DB == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "database not connected",
		})
		return
	}

	uidValue, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "missing authenticated user",
		})
		return
	}

	uid, ok := uidValue.(string)
	if !ok || strings.TrimSpace(uid) == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "invalid authenticated user",
		})
		return
	}

	var req models.CreateTripRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Destination = strings.TrimSpace(req.Destination)
	req.StartDate = strings.TrimSpace(req.StartDate)
	req.EndDate = strings.TrimSpace(req.EndDate)

	if req.Name == "" || req.Destination == "" || req.StartDate == "" || req.EndDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "name, destination, start_date, and end_date are required",
		})
		return
	}

	var createdBy int
	err := db.DB.QueryRow(`
		SELECT id
		FROM users
		WHERE firebase_uid = $1
	`, uid).Scan(&createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to find authenticated user",
		})
		return
	}

	var trip models.Trip
	err = db.DB.QueryRow(`
		INSERT INTO trips (name, destination, start_date, end_date, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, destination, start_date::text, end_date::text, created_by
	`, req.Name, req.Destination, req.StartDate, req.EndDate, createdBy).
		Scan(&trip.ID, &trip.Name, &trip.Destination, &trip.StartDate, &trip.EndDate, &trip.CreatedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to create trip",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "trip created",
		"trip":    trip,
	})
}
