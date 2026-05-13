package handlers

import (
	"regexp"
	"strings"
)

const friendlyTextValidationMessage = "Please edit this text before saving."

var blockedTextPatterns = []*regexp.Regexp{
	regexp.MustCompile(`\b(?:fuck|fucking|fucked)\b`),
	regexp.MustCompile(`\b(?:shit|shitty)\b`),
	regexp.MustCompile(`\b(?:bitch|bitches)\b`),
	regexp.MustCompile(`\basshole\b`),
	regexp.MustCompile(`\bcunt\b`),
	regexp.MustCompile(`\b(?:fag|faggot)\b`),
	regexp.MustCompile(`\b(?:nigger|nigga)\b`),
}

type textValidationOptions struct {
	Required  bool
	MaxLength int
}

type textValidationResult struct {
	Value   string
	Empty   bool
	TooLong bool
	Unsafe  bool
}

func validateUserText(value string, options textValidationOptions) textValidationResult {
	cleanedValue := strings.TrimSpace(value)
	result := textValidationResult{Value: cleanedValue}

	if options.Required && cleanedValue == "" {
		result.Empty = true
		return result
	}

	if options.MaxLength > 0 && len(cleanedValue) > options.MaxLength {
		result.TooLong = true
		return result
	}

	for _, pattern := range blockedTextPatterns {
		if pattern.MatchString(cleanedValue) {
			result.Unsafe = true
			return result
		}
	}

	return result
}
