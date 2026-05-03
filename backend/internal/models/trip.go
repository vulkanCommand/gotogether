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
}
