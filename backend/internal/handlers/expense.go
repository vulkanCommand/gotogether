package handlers

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"

	"github.com/gin-gonic/gin"
)

type tripExpenseMember struct {
	ID   int
	Name string
}

func GetExpenseGroups(c *gin.Context) {
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

	if _, err := ensureDefaultExpenseGroup(tripID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare expense groups", "details": err.Error()})
		return
	}

	groups, err := loadExpenseGroups(tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch expense groups", "details": err.Error()})
		return
	}

	expenses, err := loadTripExpenses(tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch expenses", "details": err.Error()})
		return
	}

	groupByID := map[int]int{}
	for index := range groups {
		groups[index].Expenses = []models.ExpenseResponse{}
		groupByID[groups[index].ID] = index
	}
	for _, expense := range expenses {
		if index, exists := groupByID[expense.ExpenseGroupID]; exists {
			groups[index].Expenses = append(groups[index].Expenses, expense)
		}
	}

	c.JSON(http.StatusOK, gin.H{"groups": groups})
}

func CreateExpenseGroup(c *gin.Context) {
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

	var req models.CreateExpenseGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "group name is required"})
		return
	}

	var group models.ExpenseGroupResponse
	err := db.DB.QueryRow(`
		INSERT INTO expense_groups (trip_id, name, created_by_user_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (trip_id, name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
		RETURNING id, trip_id, name, created_at::text
	`, tripID, name, userID).Scan(&group.ID, &group.TripID, &group.Name, &group.CreatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create expense group", "details": err.Error()})
		return
	}
	group.Expenses = []models.ExpenseResponse{}

	c.JSON(http.StatusCreated, gin.H{"group": group})
}

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

	if _, err := ensureDefaultExpenseGroup(tripID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare expense groups", "details": err.Error()})
		return
	}

	expenses, err := loadTripExpenses(tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch expenses", "details": err.Error()})
		return
	}
	groups, err := loadExpenseGroups(tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch expense groups", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"expenses": expenses, "groups": groups})
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
	req.SplitMethod = normalizeSplitMethod(req.SplitMethod)
	req.Notes = strings.TrimSpace(req.Notes)
	if req.Title == "" || req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title and positive amount are required"})
		return
	}

	members, err := loadTripExpenseMembers(tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load trip members", "details": err.Error()})
		return
	}
	if len(members) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "trip has no members"})
		return
	}

	memberNames := map[int]string{}
	for _, member := range members {
		memberNames[member.ID] = member.Name
	}

	paidByUserID := req.PaidByUserID
	if _, exists := memberNames[paidByUserID]; !exists {
		paidByUserID = userID
	}
	if _, exists := memberNames[paidByUserID]; !exists {
		paidByUserID = members[0].ID
	}

	expenseGroupID := req.ExpenseGroupID
	if expenseGroupID <= 0 || !expenseGroupBelongsToTrip(expenseGroupID, tripID) {
		expenseGroupID, err = ensureDefaultExpenseGroup(tripID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare expense group", "details": err.Error()})
			return
		}
	}

	linkedEventID := 0
	if strings.TrimSpace(req.LinkedEventID) != "" {
		linkedEventID = parseNumericID(req.LinkedEventID)
		if linkedEventID <= 0 || !eventBelongsToTrip(linkedEventID, tripID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "linked itinerary event is invalid"})
			return
		}
	}

	splits, err := buildExpenseSplits(req, members, memberNames)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
		return
	}
	defer rollbackQuietly(tx)

	var expenseID int
	var createdAt string
	err = tx.QueryRow(`
		INSERT INTO expenses (trip_id, expense_group_id, itinerary_event_id, title, amount, paid_by_user_id, split_method, notes)
		VALUES ($1, $2, NULLIF($3, 0), $4, $5, $6, $7, $8)
		RETURNING id, created_at::text
	`, tripID, expenseGroupID, linkedEventID, req.Title, req.Amount, paidByUserID, req.SplitMethod, req.Notes).Scan(&expenseID, &createdAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create expense", "details": err.Error()})
		return
	}

	for _, split := range splits {
		memberID := parseNumericID(split.MemberID)
		if _, err := tx.Exec(`
			INSERT INTO expense_splits (expense_id, user_id, amount)
			VALUES ($1, $2, $3)
		`, expenseID, memberID, split.Amount); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save expense split", "details": err.Error()})
			return
		}
	}

	if !commitOrRespond(c, tx) {
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"expense": models.ExpenseResponse{
			ID:             "expense-" + strconv.Itoa(expenseID),
			Title:          req.Title,
			Amount:         req.Amount,
			PaidBy:         memberNames[paidByUserID],
			PaidByUserID:   paidByUserID,
			ExpenseGroupID: expenseGroupID,
			LinkedEventID:  formatOptionalEventID(linkedEventID),
			SplitMethod:    splitMethodLabel(req.SplitMethod),
			Notes:          req.Notes,
			CreatedAt:      createdAt,
			SplitPreview:   splits,
		},
	})
}

func loadExpenseGroups(tripID int) ([]models.ExpenseGroupResponse, error) {
	rows, err := db.DB.Query(`
		SELECT id, trip_id, name, created_at::text
		FROM expense_groups
		WHERE trip_id = $1
		ORDER BY created_at ASC, id ASC
	`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	groups := make([]models.ExpenseGroupResponse, 0)
	for rows.Next() {
		var group models.ExpenseGroupResponse
		if err := rows.Scan(&group.ID, &group.TripID, &group.Name, &group.CreatedAt); err != nil {
			return nil, err
		}
		group.Expenses = []models.ExpenseResponse{}
		groups = append(groups, group)
	}
	return groups, rows.Err()
}

func loadTripExpenses(tripID int) ([]models.ExpenseResponse, error) {
	rows, err := db.DB.Query(`
		SELECT
			e.id,
			e.title,
			e.amount::float8,
			COALESCE(e.paid_by_user_id, 0),
			COALESCE(u.name, ''),
			COALESCE(e.expense_group_id, 0),
			COALESCE(e.itinerary_event_id, 0),
			e.split_method,
			COALESCE(e.notes, ''),
			e.created_at::text
		FROM expenses e
		LEFT JOIN users u ON u.id = e.paid_by_user_id
		WHERE e.trip_id = $1
		ORDER BY e.created_at DESC, e.id DESC
	`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	expenses := make([]models.ExpenseResponse, 0)
	expenseDBIDs := make([]int, 0)
	indexByDBID := map[int]int{}
	for rows.Next() {
		var expenseDBID, linkedEventID int
		var expense models.ExpenseResponse
		if err := rows.Scan(
			&expenseDBID,
			&expense.Title,
			&expense.Amount,
			&expense.PaidByUserID,
			&expense.PaidBy,
			&expense.ExpenseGroupID,
			&linkedEventID,
			&expense.SplitMethod,
			&expense.Notes,
			&expense.CreatedAt,
		); err != nil {
			return nil, err
		}
		expense.ID = "expense-" + strconv.Itoa(expenseDBID)
		expense.LinkedEventID = formatOptionalEventID(linkedEventID)
		expense.SplitMethod = splitMethodLabel(expense.SplitMethod)
		expense.SplitPreview = []models.ExpenseSplitPayload{}
		indexByDBID[expenseDBID] = len(expenses)
		expenseDBIDs = append(expenseDBIDs, expenseDBID)
		expenses = append(expenses, expense)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(expenseDBIDs) == 0 {
		return expenses, nil
	}

	splitRows, err := db.DB.Query(`
		SELECT es.expense_id, es.user_id, COALESCE(u.name, ''), es.amount::float8
		FROM expense_splits es
		INNER JOIN users u ON u.id = es.user_id
		WHERE es.expense_id = ANY($1::int[])
		ORDER BY es.id ASC
	`, intArrayLiteral(expenseDBIDs))
	if err != nil {
		return nil, err
	}
	defer splitRows.Close()

	for splitRows.Next() {
		var expenseDBID, userID int
		var split models.ExpenseSplitPayload
		if err := splitRows.Scan(&expenseDBID, &userID, &split.MemberName, &split.Amount); err != nil {
			return nil, err
		}
		split.MemberID = strconv.Itoa(userID)
		if index, exists := indexByDBID[expenseDBID]; exists {
			expenses[index].SplitPreview = append(expenses[index].SplitPreview, split)
		}
	}
	return expenses, splitRows.Err()
}

func ensureDefaultExpenseGroup(tripID int, userID int) (int, error) {
	var groupID int
	err := db.DB.QueryRow(`
		INSERT INTO expense_groups (trip_id, name, created_by_user_id)
		VALUES ($1, 'Trip expenses', $2)
		ON CONFLICT (trip_id, name) DO UPDATE SET updated_at = expense_groups.updated_at
		RETURNING id
	`, tripID, userID).Scan(&groupID)
	return groupID, err
}

func loadTripExpenseMembers(tripID int) ([]tripExpenseMember, error) {
	rows, err := db.DB.Query(`
		SELECT u.id, COALESCE(NULLIF(u.name, ''), NULLIF(u.email, ''), 'Crew member')
		FROM trip_members tm
		INNER JOIN users u ON u.id = tm.user_id
		WHERE tm.trip_id = $1
		ORDER BY tm.role = 'lead' DESC, tm.joined_at ASC, tm.id ASC
	`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := make([]tripExpenseMember, 0)
	for rows.Next() {
		var member tripExpenseMember
		if err := rows.Scan(&member.ID, &member.Name); err != nil {
			return nil, err
		}
		members = append(members, member)
	}
	return members, rows.Err()
}

func buildExpenseSplits(req models.CreateExpenseRequest, members []tripExpenseMember, memberNames map[int]string) ([]models.ExpenseSplitPayload, error) {
	amount := roundCurrency(req.Amount)
	if req.SplitMethod == "custom" {
		splits := make([]models.ExpenseSplitPayload, 0)
		total := 0.0
		seen := map[int]bool{}
		for _, incoming := range req.SplitPreview {
			memberID := parseNumericID(incoming.MemberID)
			memberName, exists := memberNames[memberID]
			if !exists || seen[memberID] {
				continue
			}
			splitAmount := roundCurrency(incoming.Amount)
			if splitAmount < 0 {
				return nil, fmt.Errorf("custom split amounts cannot be negative")
			}
			seen[memberID] = true
			total = roundCurrency(total + splitAmount)
			splits = append(splits, models.ExpenseSplitPayload{
				MemberID:   strconv.Itoa(memberID),
				MemberName: memberName,
				Amount:     splitAmount,
			})
		}
		if len(splits) == 0 {
			return nil, fmt.Errorf("custom split needs at least one member amount")
		}
		if math.Abs(total-amount) > 0.01 {
			return nil, fmt.Errorf("custom splits must add up to the expense total")
		}
		return splits, nil
	}

	splits := make([]models.ExpenseSplitPayload, 0, len(members))
	base := math.Floor((amount/float64(len(members)))*100) / 100
	remainingCents := int(math.Round(amount*100)) - int(math.Round(base*100))*len(members)
	for index, member := range members {
		memberAmount := base
		if index < remainingCents {
			memberAmount += 0.01
		}
		splits = append(splits, models.ExpenseSplitPayload{
			MemberID:   strconv.Itoa(member.ID),
			MemberName: member.Name,
			Amount:     roundCurrency(memberAmount),
		})
	}
	return splits, nil
}

func expenseGroupBelongsToTrip(groupID int, tripID int) bool {
	var exists bool
	err := db.DB.QueryRow(`SELECT EXISTS (SELECT 1 FROM expense_groups WHERE id = $1 AND trip_id = $2)`, groupID, tripID).Scan(&exists)
	return err == nil && exists
}

func eventBelongsToTrip(eventID int, tripID int) bool {
	var exists bool
	err := db.DB.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM itinerary_events e
			INNER JOIN itinerary_days d ON d.id = e.itinerary_day_id
			WHERE e.id = $1 AND d.trip_id = $2
		)
	`, eventID, tripID).Scan(&exists)
	return err == nil && exists
}

func normalizeSplitMethod(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if strings.Contains(normalized, "custom") {
		return "custom"
	}
	return "equal"
}

func splitMethodLabel(value string) string {
	if normalizeSplitMethod(value) == "custom" {
		return "Custom split"
	}
	return "Equal split"
}

func parseNumericID(value string) int {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return 0
	}
	parts := strings.Split(normalized, "-")
	if len(parts) > 1 {
		normalized = parts[len(parts)-1]
	}
	id, err := strconv.Atoi(normalized)
	if err != nil {
		return 0
	}
	return id
}

func formatOptionalEventID(eventID int) string {
	if eventID <= 0 {
		return ""
	}
	return "event-" + strconv.Itoa(eventID)
}

func roundCurrency(value float64) float64 {
	return math.Round(value*100) / 100
}

func intArrayLiteral(values []int) string {
	parts := make([]string, 0, len(values))
	for _, value := range values {
		parts = append(parts, strconv.Itoa(value))
	}
	return "{" + strings.Join(parts, ",") + "}"
}
