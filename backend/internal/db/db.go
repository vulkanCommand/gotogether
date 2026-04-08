package db

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func InitDB() {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		log.Println("DATABASE_URL not set, skipping database connection")
		return
	}

	var err error
	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Println("Failed to open DB connection:", err)
		DB = nil
		return
	}

	err = DB.Ping()
	if err != nil {
		log.Println("DB not reachable, continuing without database:", err)
		DB = nil
		return
	}

	log.Println("Database connected")
}
