package handlers

import (
	"net/http"
	"strings"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"

	"github.com/gin-gonic/gin"
)

var allowedReportContentTypes = map[string]bool{
	"user":    true,
	"trip":    true,
	"event":   true,
	"expense": true,
	"photo":   true,
	"other":   true,
}

func CreateReport(c *gin.Context) {
	reporterUserID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	var req models.CreateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	req.ContentType = strings.ToLower(strings.TrimSpace(req.ContentType))
	req.ContentID = strings.TrimSpace(req.ContentID)
	req.Reason = strings.TrimSpace(req.Reason)
	req.Details = strings.TrimSpace(req.Details)

	if req.ContentType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content_type is required"})
		return
	}
	if !allowedReportContentTypes[req.ContentType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "content_type is invalid"})
		return
	}
	if req.Reason == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reason is required"})
		return
	}

	var reportedUserID any
	if req.ReportedUserID > 0 {
		reportedUserID = req.ReportedUserID
	}
	var contentID any
	if req.ContentID != "" {
		contentID = req.ContentID
	}
	var details any
	if req.Details != "" {
		details = req.Details
	}

	if _, err := db.DB.Exec(`
		INSERT INTO reports (
			reporter_user_id,
			reported_user_id,
			content_type,
			content_id,
			reason,
			details,
			status,
			created_at,
			updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, reporterUserID, reportedUserID, req.ContentType, contentID, req.Reason, details); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to submit report", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "message": "Report submitted"})
}
