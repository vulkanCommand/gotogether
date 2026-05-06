package models

type CreateTripRequest struct {
	Name           string   `json:"name"`
	Destination    string   `json:"destination"`
	StartDate      string   `json:"start_date"`
	EndDate        string   `json:"end_date"`
	AvailableDates []string `json:"available_dates"`
	MemberIDs      []int    `json:"member_ids"`
	LeadUserID     int      `json:"lead_user_id"`
}

type UpdateTripRequest struct {
	Name        string `json:"name"`
	Destination string `json:"destination"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
}

type Trip struct {
	ID                  int    `json:"id"`
	Name                string `json:"name"`
	Destination         string `json:"destination"`
	StartDate           string `json:"start_date"`
	EndDate             string `json:"end_date"`
	CreatedBy           int    `json:"created_by"`
	ImageURL            string `json:"image_url"`
	CompletedAt         string `json:"completed_at"`
	ViewerRole          string `json:"viewer_role"`
	LeadUserID          int    `json:"lead_user_id"`
	SetupCompletedCount int    `json:"setup_completed_count"`
	SetupPendingCount   int    `json:"setup_pending_count"`
	SetupRequired       bool   `json:"setup_required"`
	ReadinessStatus     string `json:"readiness_status"`
	CompletionConfirmedCount int  `json:"completion_confirmed_count"`
	CompletionPendingCount   int  `json:"completion_pending_count"`
	CompletionRequested      bool `json:"completion_requested"`
}

type TripListItem struct {
	ID                  int    `json:"id"`
	Name                string `json:"name"`
	Destination         string `json:"destination"`
	StartDate           string `json:"start_date"`
	EndDate             string `json:"end_date"`
	CreatedBy           int    `json:"created_by"`
	MembersCount        int    `json:"members_count"`
	ImageURL            string `json:"image_url"`
	CompletedAt         string `json:"completed_at"`
	ViewerRole          string `json:"viewer_role"`
	LeadUserID          int    `json:"lead_user_id"`
	SetupCompletedCount int    `json:"setup_completed_count"`
	SetupPendingCount   int    `json:"setup_pending_count"`
	SetupRequired       bool   `json:"setup_required"`
	ReadinessStatus     string `json:"readiness_status"`
	CompletionConfirmedCount int  `json:"completion_confirmed_count"`
	CompletionPendingCount   int  `json:"completion_pending_count"`
	CompletionRequested      bool `json:"completion_requested"`
}

type PlaceSearchResult struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Subtitle    string  `json:"subtitle"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	Provider    string  `json:"provider"`
	DisplayName string  `json:"display_name"`
}
