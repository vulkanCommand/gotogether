package models

type CreateTripRequest struct {
	Name        string `json:"name"`
	Destination string `json:"destination"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
	MemberIDs   []int  `json:"member_ids"`
}

type Trip struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Destination string `json:"destination"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
	CreatedBy   int    `json:"created_by"`
}

type TripListItem struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Destination  string `json:"destination"`
	StartDate    string `json:"start_date"`
	EndDate      string `json:"end_date"`
	CreatedBy    int    `json:"created_by"`
	MembersCount int    `json:"members_count"`
}
