package models

type CreateTripRequest struct {
	Name        string `json:"name"`
	Destination string `json:"destination"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
}

type Trip struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Destination string `json:"destination"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
	CreatedBy   int    `json:"created_by"`
}
