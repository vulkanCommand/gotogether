package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func GetTripExpenses(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}
	tripID, ok := parseTripID(c)
	if !ok {
		return
	}
	if !ensureTripAccess(c, tripID, userID) {
		return
	}

	rows, err := db.DB.Query(`
		SELECT e.id, e.title, e.amount::float8, COALESCE(u.name, ''), e.split_method, COALESCE(e.notes, ''), e.created_at::text
		FROM expenses e
		LEFT JOIN users u ON u.id = e.paid_by_user_id
		WHERE e.trip_id = $1
		ORDER BY e.created_at DESC, e.id DESC
	`, tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch expenses", "details": err.Error()})
		return
	}
	defer rows.Close()

	expenses := make([]models.ExpenseResponse, 0)
	for rows.Next() {
		var expenseID int
		var expense models.ExpenseResponse
		if err := rows.Scan(&expenseID, &expense.Title, &expense.Amount, &expense.PaidBy, &expense.SplitMethod, &expense.Notes, &expense.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read expenses", "details": err.Error()})
			return
		}
		expense.ID = "expense-" + strconv.Itoa(expenseID)
		expense.SplitPreview = []models.ExpenseSplitPayload{}
		expenses = append(expenses, expense)
	}

	c.JSON(http.StatusOK, gin.H{"expenses": expenses})
}

func CreateTripExpense(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}
	tripID, ok := parseTripID(c)
	if !ok {
		return
	}
	if !ensureTripAccess(c, tripID, userID) {
		return
	}

	var req models.CreateExpenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	req.PaidBy = strings.TrimSpace(req.PaidBy)
	req.SplitMethod = strings.TrimSpace(req.SplitMethod)
	req.Notes = strings.TrimSpace(req.Notes)
	if req.Title == "" || req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title and positive amount are required"})
		return
	}
	if req.SplitMethod == "" {
		req.SplitMethod = "Equal split"
	}

	var expenseID int
	var createdAt string
	paidByName := strings.TrimSpace(req.PaidBy)
	if paidByName == "" {
		if nameValue, exists := c.Get("name"); exists {
			if name, ok := nameValue.(string); ok {
				paidByName = strings.TrimSpace(name)
			}
		}
	}
	if paidByName == "" {
		paidByName = "Trip Lead"
	}
	err := db.DB.QueryRow(`
		INSERT INTO expenses (trip_id, title, amount, paid_by_user_id, split_method, notes)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at::text
	`, tripID, req.Title, req.Amount, userID, req.SplitMethod, req.Notes).Scan(&expenseID, &createdAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create expense", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"expense": models.ExpenseResponse{
			ID:           "expense-" + strconv.Itoa(expenseID),
			Title:        req.Title,
			Amount:       req.Amount,
			PaidBy:       paidByName,
			SplitMethod:  req.SplitMethod,
			Notes:        req.Notes,
			CreatedAt:    createdAt,
			SplitPreview: []models.ExpenseSplitPayload{},
		},
	})
}
