package config

import "os"

type AppConfig struct {
	TwilioAccountSID string
	TwilioAuthToken  string
	TwilioFromNumber string
	AppInviteURL     string
}

func Load() AppConfig {
	return AppConfig{
		TwilioAccountSID: os.Getenv("TWILIO_ACCOUNT_SID"),
		TwilioAuthToken:  os.Getenv("TWILIO_AUTH_TOKEN"),
		TwilioFromNumber: os.Getenv("TWILIO_FROM_NUMBER"),
		AppInviteURL:     firstNonEmpty(os.Getenv("APP_INVITE_URL"), "https://gotogether.app"),
	}
}

func (cfg AppConfig) TwilioEnabled() bool {
	return cfg.TwilioAccountSID != "" && cfg.TwilioAuthToken != "" && cfg.TwilioFromNumber != ""
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
