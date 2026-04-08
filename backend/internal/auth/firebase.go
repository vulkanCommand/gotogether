package auth

import (
	"context"
	"log"
	"os"

	firebase "firebase.google.com/go"
	firebaseauth "firebase.google.com/go/auth"
	"google.golang.org/api/option"
)

var FirebaseAuth *firebaseauth.Client

func InitFirebase() {
	ctx := context.Background()

	cred := option.WithCredentialsFile(os.Getenv("FIREBASE_CREDENTIALS"))

	app, err := firebase.NewApp(ctx, nil, cred)
	if err != nil {
		log.Fatalf("error initializing firebase: %v", err)
	}

	client, err := app.Auth(ctx)
	if err != nil {
		log.Fatalf("error getting auth client: %v", err)
	}

	FirebaseAuth = client
}
