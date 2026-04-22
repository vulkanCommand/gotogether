package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func InitDB() error {
	connStr, err := resolveConnectionString()
	if err != nil {
		return err
	}

	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		DB = nil
		return fmt.Errorf("failed to open DB connection: %w", err)
	}

	DB.SetMaxOpenConns(5)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(30 * time.Minute)
	DB.SetConnMaxIdleTime(10 * time.Minute)

	pingErr := DB.Ping()
	if pingErr != nil {
		_ = DB.Close()
		DB = nil
		return fmt.Errorf("database ping failed: %w", pingErr)
	}

	if err := ensureSchema(DB); err != nil {
		_ = DB.Close()
		DB = nil
		return err
	}

	log.Println("Database connected")
	return nil
}

func resolveConnectionString() (string, error) {
	if connStr := strings.TrimSpace(os.Getenv("DATABASE_URL")); connStr != "" {
		return connStr, nil
	}

	dbUser := strings.TrimSpace(os.Getenv("DB_USER"))
	dbPassword := strings.TrimSpace(os.Getenv("DB_PASSWORD"))
	dbName := strings.TrimSpace(os.Getenv("DB_NAME"))

	if dbUser == "" || dbName == "" {
		return "", fmt.Errorf("database configuration missing: set DATABASE_URL or DB_USER/DB_NAME")
	}

	host := strings.TrimSpace(os.Getenv("DB_HOST"))
	if host == "" {
		if instance := strings.TrimSpace(os.Getenv("INSTANCE_CONNECTION_NAME")); instance != "" {
			socketDir := strings.TrimSpace(os.Getenv("DB_SOCKET_DIR"))
			if socketDir == "" {
				socketDir = "/cloudsql"
			}
			host = fmt.Sprintf("%s/%s", strings.TrimRight(socketDir, "/"), instance)
		}
	}
	if host == "" {
		host = "127.0.0.1"
	}

	port := parsePort(os.Getenv("DB_PORT"))
	sslMode := strings.TrimSpace(os.Getenv("DB_SSLMODE"))
	if sslMode == "" {
		if strings.HasPrefix(host, "/") {
			sslMode = "disable"
		} else {
			sslMode = "require"
		}
	}

	connParts := []string{
		fmt.Sprintf("host=%s", host),
		fmt.Sprintf("port=%d", port),
		fmt.Sprintf("user=%s", dbUser),
		fmt.Sprintf("dbname=%s", dbName),
		fmt.Sprintf("sslmode=%s", sslMode),
	}
	if dbPassword != "" {
		connParts = append(connParts, fmt.Sprintf("password=%s", dbPassword))
	}

	return strings.Join(connParts, " "), nil
}

func parsePort(raw string) int {
	if raw == "" {
		return 5432
	}

	port, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || port <= 0 {
		return 5432
	}

	return port
}
