package middleware

import (
	"context"
	"net/http"
	"strings"

	"gotogether-backend/internal/auth"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
			c.Abort()
			return
		}

		parts := strings.Split(header, "Bearer ")
		if len(parts) != 2 || strings.TrimSpace(parts[1]) == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			c.Abort()
			return
		}

		token := strings.TrimSpace(parts[1])

		decoded, err := auth.FirebaseAuth.VerifyIDToken(context.Background(), token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		c.Set("uid", decoded.UID)

		if email, ok := decoded.Claims["email"].(string); ok {
			c.Set("email", email)
		} else {
			c.Set("email", "")
		}

		if name, ok := decoded.Claims["name"].(string); ok {
			c.Set("name", name)
		} else {
			c.Set("name", "")
		}

		if phone, ok := decoded.Claims["phone_number"].(string); ok {
			c.Set("phone", phone)
		} else {
			c.Set("phone", "")
		}

		c.Next()
	}
}
