package auth

import (
	"context"
	"encoding/base64"
	"log"
	"os"
	"strings"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

var FirebaseAuth *auth.Client

func InitFirebase() {
	ctx := context.Background()

	var (
		app *firebase.App
		err error
	)

	if credentialsJSON := strings.TrimSpace(os.Getenv("FIREBASE_ADMIN_JSON")); credentialsJSON != "" {
		app, err = firebase.NewApp(ctx, nil, option.WithCredentialsJSON(normalizeCredentialsJSON(credentialsJSON)))
		if err != nil {
			log.Fatalf("Failed to initialize Firebase app from FIREBASE_ADMIN_JSON: %v", err)
		}
	} else {
		serviceAccountPath := strings.TrimSpace(os.Getenv("FIREBASE_ADMIN_JSON_PATH"))
		if serviceAccountPath == "" {
			serviceAccountPath = strings.TrimSpace(os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"))
		}
		if serviceAccountPath == "" {
			serviceAccountPath = "firebase-admin.json"
		}

		if _, statErr := os.Stat(serviceAccountPath); statErr == nil {
			app, err = firebase.NewApp(ctx, nil, option.WithCredentialsFile(serviceAccountPath))
			if err != nil {
				log.Fatalf("Failed to initialize Firebase app from credentials file: %v", err)
			}
		} else {
			app, err = firebase.NewApp(ctx, nil)
			if err != nil {
				log.Fatalf("Failed to initialize Firebase app from default credentials: %v", err)
			}
		}
	}

	FirebaseAuth, err = app.Auth(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize Firebase Auth client: %v", err)
	}

	log.Println("Firebase initialized")
}

func normalizeCredentialsJSON(value string) []byte {
	trimmed := strings.TrimSpace(value)
	if strings.HasPrefix(trimmed, "{") {
		return []byte(trimmed)
	}

	decoded, err := base64.StdEncoding.DecodeString(trimmed)
	if err == nil && len(decoded) > 0 {
		return decoded
	}

	return []byte(trimmed)
}
