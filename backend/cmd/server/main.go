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
	api.POST("/me/push-token", handlers.RegisterPushToken)
	api.DELETE("/me/push-token", handlers.UnregisterPushToken)
	api.POST("/contacts/sync", handlers.SyncContacts)
	api.GET("/friends", handlers.GetFriends)
	api.GET("/notifications", handlers.GetNotifications)
	api.DELETE("/notifications", handlers.ClearAllNotifications)
	api.DELETE("/notifications/:notificationId", handlers.ClearNotification)
	api.POST("/notifications/:notificationId/accept", handlers.AcceptNotificationAction)
	api.POST("/trips", handlers.CreateTrip)
	api.GET("/trips", handlers.GetTrips)
	api.GET("/trips/:id", handlers.GetTripByID)
	api.POST("/trips/:id/complete", handlers.CompleteTrip)
	api.GET("/trips/:id/setup-status", handlers.GetTripSetupStatus)
	api.POST("/trips/:id/setup-status", handlers.SaveTripSetupStatus)
	api.GET("/trips/:id/itinerary", handlers.GetTripItinerary)
	api.PUT("/trips/:id/itinerary", handlers.SaveTripItinerary)
	api.POST("/trips/:id/itinerary", handlers.SaveTripItinerary)
	api.POST("/trips/:id/itinerary/ai-draft", handlers.GenerateTripItineraryDraft)
	api.POST("/trips/:id/itinerary/days", handlers.CreateItineraryDay)
	api.PATCH("/trips/:id/itinerary/days/:dayId", handlers.UpdateItineraryDay)
	api.DELETE("/trips/:id/itinerary/days/:dayId", handlers.DeleteItineraryDay)
	api.POST("/trips/:id/itinerary/days/:dayId/events", handlers.CreateItineraryEvent)
	api.PATCH("/trips/:id/itinerary/events/:eventId", handlers.UpdateItineraryEvent)
	api.DELETE("/trips/:id/itinerary/events/:eventId", handlers.DeleteItineraryEvent)
	api.POST("/trips/:id/itinerary/events/:eventId/complete", handlers.CompleteItineraryEvent)
	api.POST("/trips/:id/itinerary/events/:eventId/undo-complete", handlers.UndoCompleteItineraryEvent)
	api.GET("/trips/:id/expenses", handlers.GetTripExpenses)
	api.POST("/trips/:id/expenses", handlers.CreateTripExpense)
	api.PATCH("/trips/:id/expenses/:expenseId", handlers.UpdateTripExpense)
	api.DELETE("/trips/:id/expenses/:expenseId", handlers.DeleteTripExpense)
	api.GET("/trips/:id/expense-groups", handlers.GetExpenseGroups)
	api.POST("/trips/:id/expense-groups", handlers.CreateExpenseGroup)
	api.POST("/trips/:id/location", handlers.UpdateTripLocation)
	api.GET("/trips/:id/live", handlers.GetTripLiveLocations)
	api.POST("/trips/:id/cover", handlers.UpdateTripCover)
	api.POST("/trips/:id/cover/auto", handlers.EnsureTripCoverFromDestination)
	api.GET("/trips/:id/destination-brief", handlers.GetDestinationBrief)
	api.DELETE("/trips/:id/cover", handlers.DeleteTripCover)
	api.GET("/trips/:id/cover/file", handlers.GetTripCoverFile)
	api.GET("/trips/:id/photos", handlers.GetTripPhotos)
	api.POST("/trips/:id/photos", handlers.CreateTripPhoto)
	api.GET("/trips/:id/photos/:photoId/file", handlers.GetTripPhotoFile)
	api.POST("/me/profile-image", handlers.UpdateProfileImage)
	api.DELETE("/me/profile-image", handlers.DeleteProfileImage)
	api.GET("/me/profile-image/file", handlers.GetProfileImageFile)
	api.GET("/users/:userId/profile-image/file", handlers.GetUserProfileImageFile)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Println("Server running on port", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server failed to start: %v", err)
	}
}
