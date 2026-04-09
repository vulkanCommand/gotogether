package handlers

import (
	"database/sql"
	"net/http"

	"gotogether-backend/internal/db"

	"github.com/gin-gonic/gin"
)

func GetMe(c *gin.Context) {
	uid, _ := c.Get("uid")
	email, _ := c.Get("email")
	name, _ := c.Get("name")

	uidStr, _ := uid.(string)
	emailStr, _ := email.(string)
	nameStr, _ := name.(string)

	if db.DB != nil {
		var userID int

		err := db.DB.QueryRow(`
			INSERT INTO users (firebase_uid, email, name)
			VALUES ($1, $2, $3)
			ON CONFLICT (firebase_uid)
			DO UPDATE SET
				email = EXCLUDED.email,
				name = EXCLUDED.name
			RETURNING id
		`, uidStr, emailStr, nameStr).Scan(&userID)

		if err != nil && err != sql.ErrNoRows {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "failed to sync user",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Authenticated user",
			"user": gin.H{
				"id":           userID,
				"firebase_uid": uidStr,
				"email":        emailStr,
				"name":         nameStr,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Authenticated user",
		"user": gin.H{
			"id":           nil,
			"firebase_uid": uidStr,
			"email":        emailStr,
			"name":         nameStr,
		},
		"db": "not connected",
	})
}
