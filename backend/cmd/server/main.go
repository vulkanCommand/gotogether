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
	_ = godotenv.Load()

	auth.InitFirebase()
	if err := db.InitDB(); err != nil {
		log.Fatalf("failed to initialize database: %v", err)
	}

	r := gin.Default()

	r.GET("/health", handlers.HealthHandler)

	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware())

	api.GET("/me", handlers.GetMe)
	api.PUT("/me", handlers.UpdateMe)
	api.DELETE("/me", handlers.DeleteMe)
	api.POST("/contacts/sync", handlers.SyncContacts)
	api.GET("/friends", handlers.GetFriends)
	api.POST("/trips", handlers.CreateTrip)
	api.GET("/trips", handlers.GetTrips)
	api.GET("/trips/:id", handlers.GetTripByID)
	api.GET("/trips/:id/itinerary", handlers.GetTripItinerary)
	api.PUT("/trips/:id/itinerary", handlers.SaveTripItinerary)
	api.GET("/trips/:id/expenses", handlers.GetTripExpenses)
	api.POST("/trips/:id/expenses", handlers.CreateTripExpense)
	api.POST("/trips/:id/location", handlers.UpdateTripLocation)
	api.GET("/trips/:id/live", handlers.GetTripLiveLocations)
	api.GET("/trips/:id/photos", handlers.GetTripPhotos)
	api.POST("/trips/:id/photos", handlers.CreateTripPhoto)
	api.GET("/trips/:id/photos/:photoId/file", handlers.GetTripPhotoFile)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Println("Server running on port", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server failed to start: %v", err)
	}
}
