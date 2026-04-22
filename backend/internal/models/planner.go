package models

type ItineraryEventPayload struct {
	ID          string   `json:"id"`
	DayID       string   `json:"dayId,omitempty"`
	Title       string   `json:"title"`
	Time        string   `json:"time"`
	Location    string   `json:"location"`
	Notes       string   `json:"notes"`
	Attendees   []string `json:"attendees"`
	Status      string   `json:"status"`
	CompletedAt string   `json:"completedAt,omitempty"`
}

type ItineraryDayPayload struct {
	ID        string                  `json:"id"`
	Title     string                  `json:"title"`
	DateLabel string                  `json:"dateLabel"`
	Status    string                  `json:"status,omitempty"`
	Events    []ItineraryEventPayload `json:"events"`
}

type SaveItineraryRequest struct {
	Days []ItineraryDayPayload `json:"days"`
}

type ExpenseSplitPayload struct {
	MemberID   string  `json:"memberId"`
	MemberName string  `json:"memberName"`
	Amount     float64 `json:"amount"`
}

type CreateExpenseRequest struct {
	Title          string                `json:"title"`
	Amount         float64               `json:"amount"`
	PaidBy         string                `json:"paidBy"`
	PaidByUserID   int                   `json:"paidByUserId"`
	ExpenseGroupID int                   `json:"expenseGroupId"`
	LinkedEventID  string                `json:"linkedEventId"`
	SplitMethod    string                `json:"splitMethod"`
	Notes          string                `json:"notes"`
	SplitPreview   []ExpenseSplitPayload `json:"splitPreview"`
}

type ExpenseResponse struct {
	ID               string                `json:"id"`
	Title            string                `json:"title"`
	Amount           float64               `json:"amount"`
	PaidBy           string                `json:"paidBy"`
	PaidByUserID     int                   `json:"paidByUserId"`
	ExpenseGroupID   int                   `json:"expenseGroupId"`
	LinkedEventID    string                `json:"linkedEventId"`
	LinkedEventTitle string                `json:"linkedEventTitle"`
	LinkedDayTitle   string                `json:"linkedDayTitle"`
	SplitMethod      string                `json:"splitMethod"`
	Notes            string                `json:"notes"`
	CreatedAt        string                `json:"createdAt"`
	SplitPreview     []ExpenseSplitPayload `json:"splitPreview"`
}

type ExpenseGroupResponse struct {
	ID        int               `json:"id"`
	TripID    int               `json:"tripId"`
	Name      string            `json:"name"`
	CreatedAt string            `json:"createdAt"`
	Expenses  []ExpenseResponse `json:"expenses"`
}

type CreateExpenseGroupRequest struct {
	Name string `json:"name"`
}

type NotificationResponse struct {
	ID                int    `json:"id"`
	TripID            int    `json:"tripId"`
	Title             string `json:"title"`
	Body              string `json:"body"`
	Kind              string `json:"kind"`
	RequiresAction    bool   `json:"requiresAction"`
	ActionType        string `json:"actionType"`
	TargetID          int    `json:"targetId"`
	ActionLabel       string `json:"actionLabel"`
	TargetTitle       string `json:"targetTitle"`
	ActionCompletedAt string `json:"actionCompletedAt"`
	CreatedAt         string `json:"createdAt"`
}

type TripMemberSetupRequest struct {
	AvailableDates []string `json:"availableDates"`
	LeadVoteUserID int      `json:"leadVoteUserId"`
}
