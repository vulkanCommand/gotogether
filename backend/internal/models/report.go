package models

type CreateReportRequest struct {
	ReportedUserID int    `json:"reported_user_id"`
	ContentType    string `json:"content_type"`
	ContentID      string `json:"content_id"`
	Reason         string `json:"reason"`
	Details        string `json:"details"`
}
