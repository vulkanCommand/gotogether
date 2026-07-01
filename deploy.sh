#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SKIP_CHECKS=0
COMMIT_MESSAGE=""

log_time() {
  date +"%H:%M:%S"
}

scene() {
  printf '\n[%s] ==== %s ====\n' "$(log_time)" "$1"
}

signal() {
  printf '[%s] %-12s %s\n' "$(log_time)" "$1" "$2"
}

warn() {
  printf '[%s] %-12s %s\n' "$(log_time)" "CAUTION" "$1" >&2
}

fail() {
  printf '[%s] %-12s %s\n' "$(log_time)" "ABORT" "$1" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage:
  ./deploy.sh [--skip-checks] [-m "commit message"]

Safely sync local changes to GitHub.

What it does:
  1. verifies required tools
  2. fetches + rebases the current branch on its upstream using autostash
  3. blocks obvious secret/local credential files from being committed
  4. runs available repo checks unless skipped
  5. commits local changes if needed
  6. pushes the current branch to GitHub

Flags:
  --skip-checks   Skip npm checks before commit/push.
  -m, --message   Commit message to use when local changes need a commit.
  -h, --help      Show this help text.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-checks)
      SKIP_CHECKS=1
      shift
      ;;
    -m|--message)
      if [[ $# -lt 2 ]]; then
        fail "Missing value for $1"
      fi
      COMMIT_MESSAGE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      warn "Unknown argument: $1"
      usage >&2
      exit 1
      ;;
  esac
done

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Required command not found: $cmd"
  fi
}

for cmd in git npm; do
  require_command "$cmd"
done

cd "$ROOT_DIR"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "HEAD" ]]; then
  fail "Detached HEAD is not supported. Switch to a branch first."
fi

timestamp_message() {
  date +"Repo sync %Y-%m-%d %H:%M:%S %Z"
}

COMMIT_MESSAGE="${COMMIT_MESSAGE:-$(timestamp_message)}"

collect_changed_files() {
  {
    git diff --name-only
    git diff --cached --name-only
    git ls-files --others --exclude-standard
  } | sed '/^$/d' | sort -u
}

protect_sensitive_files() {
  local matched=0

  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    case "$path" in
      .env|.env.*|*/.env|*/.env.*|backend/firebase-admin.json|*firebase-admin*.json|*service-account*.json|*service_account*.json|*credentials*.json|*secret*.json)
        warn "Refusing to commit sensitive or local credential file: $path"
        matched=1
        ;;
    esac
  done < <(collect_changed_files)

  if [[ $matched -ne 0 ]]; then
    fail "Move secret/local credential changes out of the commit before pushing."
  fi
}

run_npm_script_if_ready() {
  local dir="$1"
  local script_name="$2"
  local label="$3"

  if [[ ! -f "${dir}/package.json" ]]; then
    signal "SKIP" "${label}: no package.json"
    return
  fi

  if [[ ! -d "${dir}/node_modules" ]]; then
    signal "SKIP" "${label}: node_modules is not installed in ${dir}"
    return
  fi

  signal "CHECK" "$label"
  npm --prefix "$dir" run "$script_name" --if-present
}

run_checks() {
  if [[ "$SKIP_CHECKS" -eq 1 ]]; then
    signal "SKIP" "Checks skipped by flag"
    return
  fi

  scene "VERIFY WORKTREE"
  run_npm_script_if_ready "$ROOT_DIR" "lint" "root lint"
  run_npm_script_if_ready "$ROOT_DIR" "test" "root tests"

  if [[ -d "${ROOT_DIR}/mobile-app/node_modules" ]]; then
    signal "CHECK" "mobile TypeScript"
    (cd "${ROOT_DIR}/mobile-app" && npm exec tsc -- --noEmit)
  else
    signal "SKIP" "mobile TypeScript: mobile-app/node_modules is not installed"
  fi
}

rebase_current_branch() {
  scene "SYNC WITH ORIGIN"
  signal "FETCH" "origin"
  git fetch origin

  if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    local upstream
    upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}')"
    signal "REBASE" "${BRANCH} onto ${upstream} with autostash"
    git rebase --autostash "$upstream"
  else
    signal "NOTICE" "No upstream configured for ${BRANCH}; will set it on push"
  fi
}

commit_local_changes_if_needed() {
  if [[ -z "$(collect_changed_files)" ]]; then
    signal "CLEAN" "No local changes to commit"
    return
  fi

  scene "CAPTURE CHANGES"
  signal "STAGE" "Adding safe local changes"
  git add -A

  if git diff --cached --quiet; then
    signal "CLEAN" "Nothing staged after add"
    return
  fi

  signal "COMMIT" "$COMMIT_MESSAGE"
  git commit -m "$COMMIT_MESSAGE"
}

push_branch() {
  scene "PUSH TO GITHUB"
  signal "PUSH" "$BRANCH"

  if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    git push
  else
    git push -u origin "$BRANCH"
  fi
}

scene "GOTOGETHER GITHUB SYNC"
signal "BRANCH" "$BRANCH"
rebase_current_branch

scene "SECRET SCAN"
signal "SCAN" "Checking tracked and untracked changes"
protect_sensitive_files

run_checks
commit_local_changes_if_needed
push_branch

scene "SEQUENCE COMPLETE"
signal "DONE" "GitHub sync complete"
