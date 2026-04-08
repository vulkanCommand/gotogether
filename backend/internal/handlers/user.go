package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetMe(c *gin.Context) {
	uid, _ := c.Get("uid")

	c.JSON(http.StatusOK, gin.H{
		"message": "Authenticated user",
		"uid":     uid,
	})
}
