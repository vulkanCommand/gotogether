#!/usr/bin/env bash
set -euo pipefail

PROJECT="gotogether-783eb"
REGION="us-central1"
SERVICE="gotogether-backend"
REPO="gotogether-repo"
IMAGE="us-central1-docker.pkg.dev/${PROJECT}/${REPO}/gotogether-backend:latest"
SERVICE_URL="https://gotogether-backend-501556960072.us-central1.run.app"

: "${INSTANCE_CONNECTION_NAME:?Set INSTANCE_CONNECTION_NAME before running deploy.sh}"
: "${DB_USER:?Set DB_USER before running deploy.sh}"
: "${DB_PASSWORD:?Set DB_PASSWORD before running deploy.sh}"
: "${DB_NAME:?Set DB_NAME before running deploy.sh}"
: "${FIREBASE_ADMIN_JSON:?Set FIREBASE_ADMIN_JSON before running deploy.sh}"

echo "==> Setting gcloud project"
gcloud config set project "${PROJECT}" >/dev/null

echo "==> Syncing Go modules"
go mod tidy
go mod download
go mod verify

echo "==> Building image in Cloud Build"
gcloud builds submit \
  --tag "${IMAGE}" \
  --project "${PROJECT}"

echo "==> Deploying image to Cloud Run"
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances "${INSTANCE_CONNECTION_NAME}" \
  --project "${PROJECT}"

echo "==> Applying runtime environment safely"
gcloud run services update "${SERVICE}" \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --remove-env-vars "DATABASE_URL" \
  --update-env-vars "INSTANCE_CONNECTION_NAME=${INSTANCE_CONNECTION_NAME},DB_USER=${DB_USER},DB_PASSWORD=${DB_PASSWORD},DB_NAME=${DB_NAME},DB_SSLMODE=disable,FIREBASE_ADMIN_JSON=${FIREBASE_ADMIN_JSON}"

echo "==> Health check"
curl -sS "${SERVICE_URL}/health"
echo

echo "==> Recent logs"
gcloud run services logs read "${SERVICE}" \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --limit 20

echo "Done: backend modules synced, built, deployed, Cloud SQL socket attached, env updated."
