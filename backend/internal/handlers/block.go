package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"gotogether-backend/internal/db"
	"gotogether-backend/internal/models"

	"github.com/gin-gonic/gin"
)

func usersHaveBlockRelationship(firstUserID int, secondUserID int) (bool, error) {
	var exists bool
	err := db.DB.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM user_blocks
			WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
			   OR (blocker_user_id = $2 AND blocked_user_id = $1)
		)
	`, firstUserID, secondUserID).Scan(&exists)
	return exists, err
}

func filterBlockedUserIDs(blockerUserID int, candidateIDs []int) ([]int, error) {
	if len(candidateIDs) == 0 {
		return nil, nil
	}

	rows, err := db.DB.Query(`
		SELECT DISTINCT
			CASE
				WHEN blocker_user_id = $1 THEN blocked_user_id
				ELSE blocker_user_id
			END AS restricted_user_id
		FROM user_blocks
		WHERE (blocker_user_id = $1 AND blocked_user_id = ANY($2::int[]))
		   OR (blocked_user_id = $1 AND blocker_user_id = ANY($2::int[]))
	`, blockerUserID, intArrayLiteral(candidateIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	restricted := make([]int, 0)
	for rows.Next() {
		var userID int
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		restricted = append(restricted, userID)
	}

	return restricted, rows.Err()
}

func BlockUser(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	targetUserID, err := strconv.Atoi(strings.TrimSpace(c.Param("id")))
	if err != nil || targetUserID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	if targetUserID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "you cannot block yourself"})
		return
	}

	if _, err := db.DB.Exec(`
		INSERT INTO user_blocks (blocker_user_id, blocked_user_id)
		VALUES ($1, $2)
		ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING
	`, userID, targetUserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to block user", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"blocked": true})
}

func UnblockUser(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	targetUserID, err := strconv.Atoi(strings.TrimSpace(c.Param("id")))
	if err != nil || targetUserID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	if _, err := db.DB.Exec(`
		DELETE FROM user_blocks
		WHERE blocker_user_id = $1
		  AND blocked_user_id = $2
	`, userID, targetUserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to unblock user", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"unblocked": true})
}

func GetBlockedUsers(c *gin.Context) {
	userID, ok := getOrCreateAuthenticatedUserID(c)
	if !ok {
		return
	}

	rows, err := db.DB.Query(`
		SELECT
			u.id,
			COALESCE(u.name, ''),
			COALESCE(u.email, ''),
			COALESCE(u.phone, ''),
			COALESCE(u.username, ''),
			COALESCE(u.home_city, ''),
			COALESCE(u.profile_image_url, '')
		FROM user_blocks ub
		INNER JOIN users u ON u.id = ub.blocked_user_id
		WHERE ub.blocker_user_id = $1
		  AND u.is_deleted = FALSE
		ORDER BY u.name ASC, u.id ASC
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch blocked users", "details": err.Error()})
		return
	}
	defer rows.Close()

	users := make([]models.Friend, 0)
	for rows.Next() {
		var blockedUser models.Friend
		if err := rows.Scan(
			&blockedUser.ID,
			&blockedUser.Name,
			&blockedUser.Email,
			&blockedUser.Phone,
			&blockedUser.Username,
			&blockedUser.HomeCity,
			&blockedUser.ProfileImageURL,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read blocked users", "details": err.Error()})
			return
		}
		users = append(users, blockedUser)
	}

	restrictedRows, err := db.DB.Query(`
		SELECT DISTINCT
			u.id AS id,
			COALESCE(u.name, '') AS name,
			COALESCE(u.email, ''),
			COALESCE(u.phone, ''),
			COALESCE(u.username, ''),
			COALESCE(u.home_city, ''),
			COALESCE(u.profile_image_url, '')
		FROM user_blocks ub
		INNER JOIN users u
			ON u.id = CASE
				WHEN ub.blocker_user_id = $1 THEN ub.blocked_user_id
				ELSE ub.blocker_user_id
			END
		WHERE (ub.blocker_user_id = $1 OR ub.blocked_user_id = $1)
		  AND u.is_deleted = FALSE
		ORDER BY name ASC, id ASC
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch blocked users", "details": err.Error()})
		return
	}
	defer restrictedRows.Close()

	restrictedUsers := make([]models.Friend, 0)
	for restrictedRows.Next() {
		var restrictedUser models.Friend
		if err := restrictedRows.Scan(
			&restrictedUser.ID,
			&restrictedUser.Name,
			&restrictedUser.Email,
			&restrictedUser.Phone,
			&restrictedUser.Username,
			&restrictedUser.HomeCity,
			&restrictedUser.ProfileImageURL,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read blocked users", "details": err.Error()})
			return
		}
		restrictedUsers = append(restrictedUsers, restrictedUser)
	}

	c.JSON(http.StatusOK, gin.H{"users": users, "restricted_users": restrictedUsers})
}
