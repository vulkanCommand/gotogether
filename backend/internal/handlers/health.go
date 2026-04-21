package handlers

import (
	"net/http"

	"gotogether-backend/internal/db"

	"github.com/gin-gonic/gin"
)

func HealthHandler(c *gin.Context) {
	status := http.StatusOK
	payload := gin.H{
		"status": "ok",
		"db":     "connected",
	}

	if db.DB == nil {
		status = http.StatusServiceUnavailable
		payload["status"] = "degraded"
		payload["db"] = "disconnected"
	}

	c.JSON(status, payload)
}
