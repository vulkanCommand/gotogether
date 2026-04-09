package main

import (
	"log"
	"os"

	"gotogether-backend/internal/auth"
	"gotogether-backend/internal/db"
	"gotogether-backend/internal/handlers"
	"gotogether-backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found")
	}

	r := gin.Default()

	auth.InitFirebase()
	db.InitDB()

	r.GET("/health", handlers.HealthHandler)

	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware())

	api.GET("/me", handlers.GetMe)
	api.POST("/trips", handlers.CreateTrip)
	api.GET("/trips", handlers.GetTrips)
	api.GET("/trips/:id", handlers.GetTripByID)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Println("Server running on port", port)
	r.Run(":" + port)
}
