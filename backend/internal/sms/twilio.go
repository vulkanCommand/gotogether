package sms

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"gotogether-backend/internal/config"
)

type Sender interface {
	SendSMS(to string, body string) (string, error)
}

type TwilioSender struct {
	accountSID string
	authToken  string
	fromNumber string
	client     *http.Client
}

func NewTwilioSender(cfg config.AppConfig) (*TwilioSender, error) {
	if !cfg.TwilioEnabled() {
		return nil, fmt.Errorf("twilio is not configured")
	}

	return &TwilioSender{
		accountSID: cfg.TwilioAccountSID,
		authToken:  cfg.TwilioAuthToken,
		fromNumber: cfg.TwilioFromNumber,
		client: &http.Client{
			Timeout: 20 * time.Second,
		},
	}, nil
}

func (sender *TwilioSender) SendSMS(to string, body string) (string, error) {
	form := url.Values{}
	form.Set("To", strings.TrimSpace(to))
	form.Set("From", strings.TrimSpace(sender.fromNumber))
	form.Set("Body", strings.TrimSpace(body))

	endpoint := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", sender.accountSID)
	req, err := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}

	req.SetBasicAuth(sender.accountSID, sender.authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := sender.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("twilio send failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("twilio send failed with status %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
	}

	sid := extractJSONField(string(bodyBytes), `"sid":"`)
	if sid == "" {
		sid = "sent"
	}

	return sid, nil
}

func extractJSONField(payload string, prefix string) string {
	index := strings.Index(payload, prefix)
	if index < 0 {
		return ""
	}

	start := index + len(prefix)
	end := strings.Index(payload[start:], `"`)
	if end < 0 {
		return ""
	}

	return payload[start : start+end]
}
