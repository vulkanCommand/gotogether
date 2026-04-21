package auth

import (
	"encoding/base64"
	"testing"
)

func TestNormalizeCredentialsJSONReturnsRawJSON(t *testing.T) {
	raw := `{"type":"service_account"}`
	got := normalizeCredentialsJSON(raw)

	if string(got) != raw {
		t.Fatalf("expected raw json back, got %s", string(got))
	}
}

func TestNormalizeCredentialsJSONDecodesBase64(t *testing.T) {
	raw := `{"type":"service_account"}`
	encoded := base64.StdEncoding.EncodeToString([]byte(raw))

	got := normalizeCredentialsJSON(encoded)
	if string(got) != raw {
		t.Fatalf("expected decoded json back, got %s", string(got))
	}
}
