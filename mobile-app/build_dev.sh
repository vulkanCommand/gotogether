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

GIT_BASH_EXE="${GIT_BASH_EXE:-C:\\Program Files\\Git\\bin\\bash.exe}"

if ! command -v cmd.exe >/dev/null 2>&1; then
  echo "cmd.exe is required to open a duplicate Git Bash window on Windows." >&2
  exit 1
fi

if command -v cygpath >/dev/null 2>&1; then
  MOBILE_DIR_FOR_BASH="$(cygpath -u "${MOBILE_DIR}")"
else
  MOBILE_DIR_FOR_BASH="${MOBILE_DIR}"
fi

echo "==> Opening Expo dev server in a new Git Bash window"
cmd.exe /c start "GoTogether Expo Dev Server" "${GIT_BASH_EXE}" -lc "cd '${MOBILE_DIR_FOR_BASH}' && npm run start:tunnel; exec bash"

cd "${MOBILE_DIR}"

echo "==> Starting iOS EAS development build"
npx eas build --profile development --platform ios
