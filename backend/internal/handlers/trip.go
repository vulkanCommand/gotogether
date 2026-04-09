package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
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

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to start transaction",
		})
		return
	}
	defer tx.Rollback()

	var trip models.Trip
	err = tx.QueryRow(`
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

	_, err = tx.Exec(`
		INSERT INTO trip_members (trip_id, user_id, role)
		VALUES ($1, $2, 'lead')
		ON CONFLICT (trip_id, user_id) DO NOTHING
	`, trip.ID, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to create trip member",
			"details": err.Error(),
		})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to save trip",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "trip created",
		"trip":    trip,
	})
}

func GetTrips(c *gin.Context) {
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

	var userID int
	err := db.DB.QueryRow(`
		SELECT id
		FROM users
		WHERE firebase_uid = $1
	`, uid).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to find authenticated user",
		})
		return
	}

	rows, err := db.DB.Query(`
		SELECT
			t.id,
			t.name,
			t.destination,
			t.start_date::text,
			t.end_date::text,
			t.created_by,
			COUNT(tm.user_id)::int AS members_count
		FROM trips t
		LEFT JOIN trip_members tm ON tm.trip_id = t.id
		WHERE t.created_by = $1
		   OR t.id IN (
				SELECT trip_id
				FROM trip_members
				WHERE user_id = $1
		   )
		GROUP BY t.id, t.name, t.destination, t.start_date, t.end_date, t.created_by
		ORDER BY t.start_date ASC, t.id ASC
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to fetch trips",
			"details": err.Error(),
		})
		return
	}
	defer rows.Close()

	trips := make([]models.TripListItem, 0)
	for rows.Next() {
		var trip models.TripListItem
		if err := rows.Scan(
			&trip.ID,
			&trip.Name,
			&trip.Destination,
			&trip.StartDate,
			&trip.EndDate,
			&trip.CreatedBy,
			&trip.MembersCount,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "failed to read trips",
				"details": err.Error(),
			})
			return
		}
		trips = append(trips, trip)
	}

	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed while reading trips",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"trips": trips,
	})
}

func GetTripByID(c *gin.Context) {
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

	tripIDParam := strings.TrimSpace(c.Param("id"))
	tripID, err := strconv.Atoi(tripIDParam)
	if err != nil || tripID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid trip id",
		})
		return
	}

	var userID int
	err = db.DB.QueryRow(`
		SELECT id
		FROM users
		WHERE firebase_uid = $1
	`, uid).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to find authenticated user",
		})
		return
	}

	var trip models.Trip
	var membersCount int

	err = db.DB.QueryRow(`
		SELECT
			t.id,
			t.name,
			t.destination,
			t.start_date::text,
			t.end_date::text,
			t.created_by,
			COUNT(tm.user_id)::int AS members_count
		FROM trips t
		LEFT JOIN trip_members tm ON tm.trip_id = t.id
		WHERE t.id = $1
		  AND (
				t.created_by = $2
				OR t.id IN (
					SELECT trip_id
					FROM trip_members
					WHERE user_id = $2
				)
		  )
		GROUP BY t.id, t.name, t.destination, t.start_date, t.end_date, t.created_by
	`, tripID, userID).Scan(
		&trip.ID,
		&trip.Name,
		&trip.Destination,
		&trip.StartDate,
		&trip.EndDate,
		&trip.CreatedBy,
		&membersCount,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "trip not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to fetch trip",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"trip": gin.H{
			"id":            trip.ID,
			"name":          trip.Name,
			"destination":   trip.Destination,
			"start_date":    trip.StartDate,
			"end_date":      trip.EndDate,
			"created_by":    trip.CreatedBy,
			"members_count": membersCount,
		},
	})
}
