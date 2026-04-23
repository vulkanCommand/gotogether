package models

type User struct {
	ID              int    `json:"id"`
	FirebaseUID     string `json:"firebase_uid"`
	Email           string `json:"email"`
	Name            string `json:"name"`
	Phone           string `json:"phone"`
	Username        string `json:"username"`
	HomeCity        string `json:"home_city"`
	Bio             string `json:"bio"`
	ProfileImageURL string `json:"profile_image_url"`
	ProfileComplete bool   `json:"profile_complete"`
}

type UpdateProfileRequest struct {
	Name     string `json:"name"`
	Phone    string `json:"phone"`
	Username string `json:"username"`
	HomeCity string `json:"home_city"`
	Bio      string `json:"bio"`
}

type PushTokenRequest struct {
	Token    string `json:"token"`
	Platform string `json:"platform"`
}

type ContactSyncRequest struct {
	Emails []string `json:"emails"`
	Phones []string `json:"phones"`
}

type Friend struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	Email           string `json:"email"`
	Phone           string `json:"phone"`
	Username        string `json:"username"`
	HomeCity        string `json:"home_city"`
	ProfileImageURL string `json:"profile_image_url"`
}
