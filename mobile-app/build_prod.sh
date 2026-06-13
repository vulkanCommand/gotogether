#!/usr/bin/env bash
set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_JSON="${MOBILE_DIR}/app.json"

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

echo "==> Incrementing iOS build number"
node - "${APP_JSON}" <<'NODE'
const fs = require('fs');

const appJsonPath = process.argv[2];
const raw = fs.readFileSync(appJsonPath, 'utf8');
const data = JSON.parse(raw);

if (!data.expo) {
  throw new Error('app.json is missing expo config');
}

data.expo.ios = data.expo.ios || {};

const previousValue = data.expo.ios.buildNumber;
const previousNumber = Number.parseInt(String(previousValue || '0'), 10);

if (!Number.isFinite(previousNumber)) {
  throw new Error(`expo.ios.buildNumber must be numeric, found: ${previousValue}`);
}

const nextNumber = previousNumber + 1;
data.expo.ios.buildNumber = String(nextNumber);

fs.writeFileSync(appJsonPath, `${JSON.stringify(data, null, 2)}\n`);

console.log(`iOS buildNumber: ${previousValue || '0'} -> ${nextNumber}`);
console.log(`Public app version unchanged: ${data.expo.version}`);
NODE

echo "==> Building iOS production build and auto-submitting to App Store Connect"
npx eas build --profile production --platform ios --auto-submit-with-profile production
