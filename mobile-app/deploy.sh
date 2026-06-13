#!/usr/bin/env bash
set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${MOBILE_DIR}/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"

PROJECT_ID="${GCP_PROJECT_ID:-gotogether-783eb}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-gotogether-backend}"
ARTIFACT_REPO="${ARTIFACT_REPO:-gotogether-repo}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/gotogether-backend:latest"
HEALTH_URL="${CLOUD_RUN_HEALTH_URL:-https://gotogether-backend-501556960072.us-central1.run.app/health}"

MERGE_TO_MAIN=0
SKIP_ROOT_CHECKS=0
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
  ./deploy.sh [--merge-main] [--skip-root-checks] [-m "commit message"]

Run this from mobile-app/.

What it does:
  1. fetches + rebases the current branch on its upstream using autostash
  2. blocks obvious secret file changes from being committed
  3. checks whether local changes include backend/ files
  4. runs repo checks, including Go tests only when backend changed
  5. commits local changes if needed
  6. pushes the current branch
  7. optionally merges the current branch into main with a temporary worktree
  8. deploys the backend to Cloud Run only when backend/ changed
  9. checks backend health only after a backend deploy

Flags:
  --merge-main         Also merge the current branch into origin/main and push main.
  --skip-root-checks   Skip root web lint/test checks. Mobile/backend checks still run.
  -m, --message        Commit message to use when local changes need a commit.
  -h, --help           Show this help text.

Environment overrides:
  GCP_PROJECT_ID
  CLOUD_RUN_REGION
  CLOUD_RUN_SERVICE
  ARTIFACT_REPO
  CLOUD_RUN_HEALTH_URL
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --merge-main)
      MERGE_TO_MAIN=1
      shift
      ;;
    --skip-root-checks)
      SKIP_ROOT_CHECKS=1
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

  if ! npm --prefix "$dir" run "$script_name" --if-present; then
    fail "${label} failed"
  fi
}

for cmd in git npm; do
  require_command "$cmd"
done

cd "$ROOT_DIR"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "HEAD" ]]; then
  fail "Detached HEAD is not supported for deploys. Switch to a branch first."
fi

timestamp_message() {
  date +"Deploy sync %Y-%m-%d %H:%M:%S %Z"
}

COMMIT_MESSAGE="${COMMIT_MESSAGE:-$(timestamp_message)}"

collect_changed_files() {
  {
    git diff --name-only
    git diff --cached --name-only
    git ls-files --others --exclude-standard
  } | sed '/^$/d' | sort -u
}

has_backend_changes() {
  while IFS= read -r path; do
    case "$path" in
      backend/*)
        return 0
        ;;
    esac
  done < <(collect_changed_files)

  return 1
}

protect_sensitive_files() {
  local matched=0
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    case "$path" in
      .env|.env.*|backend/.env|backend/.env.*|backend/firebase-admin.json|*service-account*.json|*service_account*.json)
        warn "Refusing to deploy because a sensitive file is modified or untracked: $path"
        matched=1
        ;;
    esac
  done < <(collect_changed_files)

  if [[ $matched -ne 0 ]]; then
    fail "Move those secret/local changes out of the commit or add safer handling first."
  fi
}

run_checks() {
  local backend_changed="$1"

  scene "VERIFY WORKTREE"
  if [[ $SKIP_ROOT_CHECKS -eq 0 && -f "${ROOT_DIR}/package.json" ]]; then
    signal "CHECK" "root lint"
    run_npm_script_if_ready "$ROOT_DIR" "lint" "root lint"
    signal "CHECK" "root tests"
    run_npm_script_if_ready "$ROOT_DIR" "test" "root test"
  fi
  if [[ ! -d "${MOBILE_DIR}/node_modules" ]]; then
    fail "mobile-app/node_modules is missing. Run 'cd mobile-app && npm install' first."
  fi
  signal "CHECK" "mobile TypeScript"
  (cd "$MOBILE_DIR" && npm exec tsc -- --noEmit)

  if [[ "$backend_changed" -eq 1 ]]; then
    signal "CHECK" "backend Go tests"
    (cd "$BACKEND_DIR" && go test ./...)
  else
    signal "SKIP" "No backend changes detected; skipping Go tests"
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

push_branch() {
  scene "PUSH TO GITHUB"
  signal "PUSH" "${BRANCH}"
  if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    git push
  else
    git push -u origin "$BRANCH"
  fi
}

merge_branch_into_main() {
  if [[ $MERGE_TO_MAIN -ne 1 ]]; then
    return
  fi
  if [[ "$BRANCH" == "main" ]]; then
    signal "SKIP" "Already on main; skipping temporary merge worktree"
    return
  fi

  scene "MERGE TO MAIN"
  signal "WORKTREE" "Merging ${BRANCH} into origin/main"
  local merge_dir
  merge_dir="$(mktemp -d "${TMPDIR:-/tmp}/gotogether-main-merge.XXXXXX")"

  cleanup_merge_dir() {
    git -C "$ROOT_DIR" worktree remove "$merge_dir" --force >/dev/null 2>&1 || true
    rm -rf "$merge_dir" >/dev/null 2>&1 || true
  }
  trap cleanup_merge_dir RETURN

  git worktree add "$merge_dir" origin/main >/dev/null
  (
    cd "$merge_dir"
    git switch -c deploy-main origin/main >/dev/null 2>&1 || git switch deploy-main >/dev/null
    git merge --no-ff "origin/${BRANCH}" -m "Merge branch '${BRANCH}' into main"
    git push origin HEAD:main
  )
}

deploy_backend() {
  scene "CLOUD RUN DEPLOY"
  signal "PROJECT" "${PROJECT_ID}"
  gcloud config set project "$PROJECT_ID" >/dev/null

  signal "BUILD" "${IMAGE}"
  gcloud builds submit \
    --tag "$IMAGE" \
    --project "$PROJECT_ID" \
    "$BACKEND_DIR"

  signal "DEPLOY" "service=${SERVICE} region=${REGION}"
  gcloud run deploy "$SERVICE" \
    --image "$IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --project "$PROJECT_ID"

  signal "HEALTH" "${HEALTH_URL}"
  curl -fsS "$HEALTH_URL"
  echo
}

scene "GOTOGETHER DEPLOY SEQUENCE"
signal "BRANCH" "$BRANCH"
rebase_current_branch
scene "SECRET SCAN"
signal "SCAN" "Checking tracked and untracked changes"
protect_sensitive_files

BACKEND_CHANGED=0
if has_backend_changes; then
  BACKEND_CHANGED=1
  signal "TARGET" "Backend changes detected; Cloud Run deploy armed"
  for cmd in gcloud go curl; do
    require_command "$cmd"
  done
else
  signal "TARGET" "No backend changes detected; GitHub push only"
fi

run_checks "$BACKEND_CHANGED"
commit_local_changes_if_needed
push_branch
merge_branch_into_main

if [[ "$BACKEND_CHANGED" -eq 1 ]]; then
  deploy_backend
else
  scene "CLOUD RUN DEPLOY"
  signal "SKIP" "No backend changes detected; skipping Cloud Run deploy"
fi

scene "SEQUENCE COMPLETE"
signal "DONE" "Deploy flow complete"
