package handlers

import (
	"net/http"
	"strings"

	"gotogether-backend/internal/places"

	"github.com/gin-gonic/gin"
)

func SearchPlaces(c *gin.Context) {
	_, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		c.JSON(http.StatusOK, gin.H{"results": []any{}})
		return
	}

	results, err := places.Search(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "failed to search locations", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}
