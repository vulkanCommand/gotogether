package models

type LiveLocationRequest struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Accuracy  float64 `json:"accuracy"`
}

type TripLiveLocation struct {
	UserID    int      `json:"user_id"`
	Name      string   `json:"name"`
	Email     string   `json:"email"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
	Accuracy  *float64 `json:"accuracy"`
	UpdatedAt string   `json:"updated_at"`
	IsCurrent bool     `json:"is_current_user"`
}

type CreateTripPhotoRequest struct {
	ImageURL string `json:"image_url"`
	Caption  string `json:"caption"`
}

type TripPhoto struct {
	ID         int    `json:"id"`
	ImageURL   string `json:"image_url"`
	Caption    string `json:"caption"`
	UploadedBy string `json:"uploaded_by"`
	UploadedAt string `json:"uploaded_at"`
}
