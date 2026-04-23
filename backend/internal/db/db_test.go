package db

import (
	"os"
	"strings"
	"testing"
)

func TestResolveConnectionStringFromDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:pass@host:5432/db?sslmode=require")
	t.Setenv("DB_USER", "")
	t.Setenv("DB_NAME", "")

	connStr, err := resolveConnectionString()
	if err != nil {
		t.Fatalf("resolveConnectionString returned error: %v", err)
	}

	if connStr != "postgres://user:pass@host:5432/db?sslmode=require" {
		t.Fatalf("unexpected connection string: %s", connStr)
	}
}

func TestResolveConnectionStringFromCloudSQLSocketConfig(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("INSTANCE_CONNECTION_NAME", "project:region:instance")
	t.Setenv("DB_USER", "gotogether_user")
	t.Setenv("DB_PASSWORD", "secret")
	t.Setenv("DB_NAME", "gotogether")
	t.Setenv("DB_PORT", "")
	t.Setenv("DB_SSLMODE", "")

	connStr, err := resolveConnectionString()
	if err != nil {
		t.Fatalf("resolveConnectionString returned error: %v", err)
	}

	expectedParts := []string{
		"host=/cloudsql/project:region:instance",
		"port=5432",
		"user=gotogether_user",
		"password=secret",
		"dbname=gotogether",
		"sslmode=disable",
	}

	for _, expectedPart := range expectedParts {
		if !strings.Contains(connStr, expectedPart) {
			t.Fatalf("connection string %q missing %q", connStr, expectedPart)
		}
	}
}

func TestResolveConnectionStringRequiresConfig(t *testing.T) {
	for _, key := range []string{"DATABASE_URL", "INSTANCE_CONNECTION_NAME", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_PORT", "DB_SSLMODE"} {
		t.Setenv(key, "")
	}

	_, err := resolveConnectionString()
	if err == nil {
		t.Fatal("expected resolveConnectionString to fail when config is missing")
	}
}

func TestMain(m *testing.M) {
	os.Exit(m.Run())
}
