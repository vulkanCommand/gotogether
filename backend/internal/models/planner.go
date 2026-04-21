package models

type ItineraryEventPayload struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	Time      string   `json:"time"`
	Location  string   `json:"location"`
	Notes     string   `json:"notes"`
	Attendees []string `json:"attendees"`
	Status    string   `json:"status"`
}

type ItineraryDayPayload struct {
	ID        string                  `json:"id"`
	Title     string                  `json:"title"`
	DateLabel string                  `json:"dateLabel"`
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
	Title        string                `json:"title"`
	Amount       float64               `json:"amount"`
	PaidBy       string                `json:"paidBy"`
	SplitMethod  string                `json:"splitMethod"`
	Notes        string                `json:"notes"`
	SplitPreview []ExpenseSplitPayload `json:"splitPreview"`
}

type ExpenseResponse struct {
	ID           string                `json:"id"`
	Title        string                `json:"title"`
	Amount       float64               `json:"amount"`
	PaidBy       string                `json:"paidBy"`
	SplitMethod  string                `json:"splitMethod"`
	Notes        string                `json:"notes"`
	CreatedAt    string                `json:"createdAt"`
	SplitPreview []ExpenseSplitPayload `json:"splitPreview"`
}
