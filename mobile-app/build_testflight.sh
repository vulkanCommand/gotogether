#!/usr/bin/env bash
set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    exit 1
  fi
}

for cmd in node npm npx git; do
  require_command "$cmd"
done

if [[ ! -d "${MOBILE_DIR}/node_modules" ]]; then
  echo "mobile-app/node_modules is missing. Run 'cd mobile-app && npm install' first." >&2
  exit 1
fi

cd "${MOBILE_DIR}"

echo "==> Running TypeScript check"
npm exec tsc -- --noEmit

echo "==> Building iOS TestFlight build and auto-submitting to App Store Connect"
npx eas build --profile testflight --platform ios --auto-submit-with-profile production
