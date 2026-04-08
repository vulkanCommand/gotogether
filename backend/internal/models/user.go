package models

type User struct {
	ID          string `json:"id"`
	FirebaseUID string `json:"firebase_uid"`
	Email       string `json:"email"`
	Name        string `json:"name"`
}
