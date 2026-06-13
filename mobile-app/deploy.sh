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
        echo "Missing value for $1" >&2
        exit 1
      fi
      COMMIT_MESSAGE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    exit 1
  fi
}

run_npm_script_if_ready() {
  local dir="$1"
  local script_name="$2"
  local label="$3"

  if [[ ! -f "${dir}/package.json" ]]; then
    echo "==> Skipping ${label}: no package.json"
    return
  fi

  if [[ ! -d "${dir}/node_modules" ]]; then
    echo "==> Skipping ${label}: node_modules is not installed in ${dir}"
    return
  fi

  if ! npm --prefix "$dir" run "$script_name" --if-present; then
    echo "==> ${label} failed" >&2
    exit 1
  fi
}

for cmd in git npm; do
  require_command "$cmd"
done

cd "$ROOT_DIR"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "HEAD" ]]; then
  echo "Detached HEAD is not supported for deploys. Switch to a branch first." >&2
  exit 1
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
        echo "Refusing to deploy because a sensitive file is modified or untracked: $path" >&2
        matched=1
        ;;
    esac
  done < <(collect_changed_files)

  if [[ $matched -ne 0 ]]; then
    echo "Move those secret/local changes out of the commit or add safer handling first." >&2
    exit 1
  fi
}

run_checks() {
  local backend_changed="$1"

  echo "==> Running checks"
  if [[ $SKIP_ROOT_CHECKS -eq 0 && -f "${ROOT_DIR}/package.json" ]]; then
    run_npm_script_if_ready "$ROOT_DIR" "lint" "root lint"
    run_npm_script_if_ready "$ROOT_DIR" "test" "root test"
  fi
  if [[ ! -d "${MOBILE_DIR}/node_modules" ]]; then
    echo "mobile-app/node_modules is missing. Run 'cd mobile-app && npm install' first." >&2
    exit 1
  fi
  (cd "$MOBILE_DIR" && npm exec tsc -- --noEmit)

  if [[ "$backend_changed" -eq 1 ]]; then
    (cd "$BACKEND_DIR" && go test ./...)
  else
    echo "==> No backend changes detected; skipping Go tests"
  fi
}

commit_local_changes_if_needed() {
  if [[ -z "$(collect_changed_files)" ]]; then
    echo "==> No local changes to commit"
    return
  fi

  echo "==> Committing local changes"
  git add -A
  if git diff --cached --quiet; then
    echo "==> Nothing staged after add"
    return
  fi
  git commit -m "$COMMIT_MESSAGE"
}

rebase_current_branch() {
  echo "==> Fetching origin"
  git fetch origin

  if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    local upstream
    upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}')"
    echo "==> Rebasing ${BRANCH} onto ${upstream} with autostash"
    git rebase --autostash "$upstream"
  else
    echo "==> No upstream configured for ${BRANCH}; will set it on push"
  fi
}

push_branch() {
  echo "==> Pushing branch ${BRANCH}"
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
    echo "==> Already on main; skipping temporary merge worktree"
    return
  fi

  echo "==> Merging ${BRANCH} into origin/main with a temporary worktree"
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
  echo "==> Setting gcloud project to ${PROJECT_ID}"
  gcloud config set project "$PROJECT_ID" >/dev/null

  echo "==> Building backend image"
  gcloud builds submit \
    --tag "$IMAGE" \
    --project "$PROJECT_ID" \
    "$BACKEND_DIR"

  echo "==> Deploying Cloud Run service ${SERVICE}"
  gcloud run deploy "$SERVICE" \
    --image "$IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --project "$PROJECT_ID"

  echo "==> Backend health"
  curl -fsS "$HEALTH_URL"
  echo
}

echo "==> Branch: ${BRANCH}"
rebase_current_branch
protect_sensitive_files

BACKEND_CHANGED=0
if has_backend_changes; then
  BACKEND_CHANGED=1
  echo "==> Backend changes detected; Cloud Run deploy will run after push"
  for cmd in gcloud go curl; do
    require_command "$cmd"
  done
else
  echo "==> No backend changes detected; Cloud Run deploy will be skipped"
fi

run_checks "$BACKEND_CHANGED"
commit_local_changes_if_needed
push_branch
merge_branch_into_main

if [[ "$BACKEND_CHANGED" -eq 1 ]]; then
  deploy_backend
else
  echo "==> No backend changes detected; skipping Cloud Run deploy"
fi

echo "==> Deploy flow complete"
