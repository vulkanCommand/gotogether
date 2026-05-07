package db

import (
	"database/sql"
	"fmt"
)

var schemaStatements = []string{
	`CREATE TABLE IF NOT EXISTS users (
		id SERIAL PRIMARY KEY,
		firebase_uid TEXT UNIQUE NOT NULL,
		email TEXT,
		name TEXT,
		phone TEXT,
		username TEXT,
		home_city TEXT,
		bio TEXT,
		profile_image_url TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`,
	`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`,
	`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT`,
	`ALTER TABLE users ADD COLUMN IF NOT EXISTS home_city TEXT`,
	`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`,
	`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT`,
	`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
	`CREATE TABLE IF NOT EXISTS trips (
		id SERIAL PRIMARY KEY,
		name TEXT NOT NULL,
		destination TEXT NOT NULL,
		start_date DATE NOT NULL,
		end_date DATE NOT NULL,
		image_url TEXT,
		completed_at TIMESTAMP,
		completed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
		created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`,
	`ALTER TABLE trips ADD COLUMN IF NOT EXISTS image_url TEXT`,
	`ALTER TABLE trips ADD COLUMN IF NOT EXISTS cover_photo_source TEXT`,
	`ALTER TABLE trips ADD COLUMN IF NOT EXISTS google_place_id TEXT`,
	`ALTER TABLE trips ADD COLUMN IF NOT EXISTS google_photo_name TEXT`,
	`ALTER TABLE trips ADD COLUMN IF NOT EXISTS cover_updated_at TIMESTAMP`,
	`ALTER TABLE trips ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`,
	`ALTER TABLE trips ADD COLUMN IF NOT EXISTS completed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
	`CREATE TABLE IF NOT EXISTS destination_cover_cache (
		id SERIAL PRIMARY KEY,
		destination_key TEXT NOT NULL UNIQUE,
		destination_label TEXT NOT NULL,
		image_url TEXT NOT NULL,
		source TEXT NOT NULL,
		google_place_id TEXT,
		google_photo_name TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`,
	`ALTER TABLE destination_cover_cache ADD COLUMN IF NOT EXISTS google_place_id TEXT`,
	`ALTER TABLE destination_cover_cache ADD COLUMN IF NOT EXISTS google_photo_name TEXT`,
	`CREATE TABLE IF NOT EXISTS trip_members (
		id SERIAL PRIMARY KEY,
		trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		role TEXT NOT NULL DEFAULT 'member',
		joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (trip_id, user_id)
	)`,
	`CREATE TABLE IF NOT EXISTS trip_destination_votes (
		id SERIAL PRIMARY KEY,
		trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
		destination_id TEXT NOT NULL,
		destination_name TEXT NOT NULL,
		destination_country TEXT,
		destination_emoji TEXT,
		voted_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE TABLE IF NOT EXISTS itinerary_days (
		id SERIAL PRIMARY KEY,
		trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		date_label TEXT NOT NULL,
		day_order INTEGER NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE TABLE IF NOT EXISTS itinerary_events (
		id SERIAL PRIMARY KEY,
		itinerary_day_id INTEGER NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		time_label TEXT NOT NULL,
		location TEXT NOT NULL,
		location_is_mapped BOOLEAN NOT NULL DEFAULT FALSE,
		notes TEXT,
		status TEXT NOT NULL DEFAULT 'upcoming',
		is_completed BOOLEAN NOT NULL DEFAULT FALSE,
		attendee_summary TEXT,
		event_order INTEGER NOT NULL,
		completed_at TIMESTAMP,
		completed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`,
	`ALTER TABLE itinerary_events ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT FALSE`,
	`UPDATE itinerary_events SET is_completed = TRUE WHERE completed_at IS NOT NULL`,
	`ALTER TABLE itinerary_events ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`,
	`ALTER TABLE itinerary_events ADD COLUMN IF NOT EXISTS completed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
	`ALTER TABLE itinerary_events ADD COLUMN IF NOT EXISTS location_is_mapped BOOLEAN NOT NULL DEFAULT FALSE`,
	`CREATE TABLE IF NOT EXISTS expense_groups (
		id SERIAL PRIMARY KEY,
		trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (trip_id, name)
	)`,
	`CREATE TABLE IF NOT EXISTS expenses (
		id SERIAL PRIMARY KEY,
		trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
		expense_group_id INTEGER REFERENCES expense_groups(id) ON DELETE SET NULL,
		itinerary_event_id INTEGER REFERENCES itinerary_events(id) ON DELETE SET NULL,
		title TEXT NOT NULL,
		amount NUMERIC(10,2) NOT NULL,
		paid_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
		split_method TEXT NOT NULL DEFAULT 'equal',
		notes TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`,
	`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_group_id INTEGER REFERENCES expense_groups(id) ON DELETE SET NULL`,
	`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS itinerary_event_id INTEGER REFERENCES itinerary_events(id) ON DELETE SET NULL`,
	`CREATE TABLE IF NOT EXISTS expense_splits (
		id SERIAL PRIMARY KEY,
		expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		amount NUMERIC(10,2) NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE TABLE IF NOT EXISTS trip_photos (
		id SERIAL PRIMARY KEY,
		trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
		image_url TEXT NOT NULL,
		caption TEXT,
		uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
		sort_order INTEGER NOT NULL DEFAULT 0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE TABLE IF NOT EXISTS friendships (
		id SERIAL PRIMARY KEY,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		friend_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (user_id, friend_user_id)
	)`,
	`CREATE TABLE IF NOT EXISTS trip_live_locations (
		id SERIAL PRIMARY KEY,
		trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		latitude DOUBLE PRECISION NOT NULL,
		longitude DOUBLE PRECISION NOT NULL,
		accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (trip_id, user_id)
	)`,
	`CREATE TABLE IF NOT EXISTS trip_member_setup (
		id SERIAL PRIMARY KEY,
		trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		available_dates TEXT NOT NULL DEFAULT '',
		lead_vote_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
		completed_at TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (trip_id, user_id)
	)`,
	`CREATE TABLE IF NOT EXISTS user_push_tokens (
		id SERIAL PRIMARY KEY,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		expo_push_token TEXT NOT NULL UNIQUE,
		platform TEXT NOT NULL DEFAULT 'expo',
		device_id TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`,
	`ALTER TABLE user_push_tokens ADD COLUMN IF NOT EXISTS device_id TEXT`,
	`CREATE TABLE IF NOT EXISTS sms_invites (
		id SERIAL PRIMARY KEY,
		sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		recipient_phone TEXT NOT NULL,
		recipient_name TEXT,
		provider TEXT NOT NULL DEFAULT 'twilio',
		provider_message_sid TEXT,
		status TEXT NOT NULL DEFAULT 'queued',
		invite_context TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`,
	`CREATE TABLE IF NOT EXISTS notifications (
		id SERIAL PRIMARY KEY,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		body TEXT NOT NULL,
		type TEXT NOT NULL DEFAULT 'activity',
		kind TEXT NOT NULL DEFAULT 'activity',
		requires_action BOOLEAN NOT NULL DEFAULT FALSE,
		action_type TEXT,
		target_id INTEGER,
		actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
		data JSONB,
		read_at TIMESTAMP,
		action_completed_at TIMESTAMP,
		cleared_at TIMESTAMP,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	)`,
	`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'activity'`,
	`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_type TEXT`,
	`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_id INTEGER`,
	`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
	`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB`,
	`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP`,
	`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_completed_at TIMESTAMP`,
	`UPDATE notifications SET type = COALESCE(NULLIF(type, ''), kind, 'activity')`,
	`CREATE TABLE IF NOT EXISTS event_completion_confirmations (
		id SERIAL PRIMARY KEY,
		trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
		event_id INTEGER NOT NULL REFERENCES itinerary_events(id) ON DELETE CASCADE,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (event_id, user_id)
	)`,
	`CREATE TABLE IF NOT EXISTS trip_completion_confirmations (
		id SERIAL PRIMARY KEY,
		trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (trip_id, user_id)
	)`,
	`CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users ((LOWER(email)))`,
	`CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone)`,
	`CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships (user_id)`,
	`CREATE INDEX IF NOT EXISTS idx_trip_live_locations_trip_id ON trip_live_locations (trip_id)`,
	`CREATE INDEX IF NOT EXISTS idx_expense_groups_trip_id ON expense_groups (trip_id)`,
	`CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON expenses (expense_group_id)`,
	`CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits (expense_id)`,
	`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id, cleared_at, created_at)`,
	`CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens (user_id)`,
	`CREATE INDEX IF NOT EXISTS idx_sms_invites_sender_phone_time ON sms_invites (sender_user_id, recipient_phone, created_at DESC)`,
	`CREATE INDEX IF NOT EXISTS idx_event_completion_confirmations_event ON event_completion_confirmations (event_id)`,
	`CREATE INDEX IF NOT EXISTS idx_trip_completion_confirmations_trip ON trip_completion_confirmations (trip_id)`,
	`CREATE INDEX IF NOT EXISTS idx_trip_member_setup_trip_user ON trip_member_setup (trip_id, user_id)`,
	`CREATE INDEX IF NOT EXISTS idx_destination_cover_cache_key ON destination_cover_cache (destination_key)`,
}

func ensureSchema(db *sql.DB) error {
	for _, statement := range schemaStatements {
		if _, err := db.Exec(statement); err != nil {
			return fmt.Errorf("schema migration failed: %w", err)
		}
	}

	return nil
}
