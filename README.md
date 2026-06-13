# GoTogether

GoTogether is a mobile-first group trip coordination app for friends, families, and travel groups. It helps a group create a trip, invite members, plan together, track the itinerary, share live trip context, split expenses, and complete the trip as a group.

The product is live on the Apple App Store. Android support is configured in the app and the project is planning for a Google Play Store launch.

## Product Status

- iOS: live on the Apple App Store.
- Android: configured with an Android package and production app bundle build, with Play Store launch planned.
- Backend: deployed to Google Cloud Run.
- Primary API: `https://gotogether-backend-501556960072.us-central1.run.app`.
- Primary app link domain: `https://gotogether.app`.

## Repository Structure

```text
.
|-- mobile-app/        Expo React Native app used for the production mobile app
|-- backend/           Go API service for auth, trips, invites, media, expenses, and notifications
|-- src/               Older Vite/React prototype and UI reference surface
|-- public/            Static assets for the Vite prototype
|-- PROJECT_STATE.md   Older project state snapshot
`-- README.md          Project documentation
```

## Tech Stack

### Mobile App

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript
- React Navigation with native stack and bottom tabs
- Zustand for app state
- Firebase Authentication through React Native Firebase
- Expo Notifications for push notifications
- Expo Contacts, Location, Image Picker, Haptics, Font, and Device APIs
- React Native Maps
- EAS Build and Submit

### Backend

- Go 1.25
- Gin HTTP framework
- PostgreSQL
- Firebase Admin SDK for ID token verification
- Google Cloud Run for hosting
- Google Cloud Build and Artifact Registry for container deployment
- Google Cloud Storage for uploaded profile, trip cover, and trip photo files
- Twilio integration for SMS invites
- OpenAI integration for itinerary and destination/media assistance
- Google Places/OpenStreetMap support for destination and place search workflows

### Prototype Web Surface

- Vite
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui and Radix UI components
- React Router
- TanStack Query
- Vitest and Playwright configuration

## Core Features

- Firebase sign-in and backend-authenticated sessions.
- User profile setup, profile editing, profile image upload, and account deletion.
- Trip creation with name, destination, dates, members, cover image, and setup status.
- Group trip member management with both manual add and reusable invite-link flows.
- Deep links for trip invites using `gotogether://trip-invite/:token` and `https://gotogether.app/trip-invite/:token`.
- Shared trip editing for members, with destructive actions such as trip deletion and member removal kept creator-only.
- Trip setup workflow for availability, destination voting, and trip lead selection.
- Trip overview with crew, readiness, permissions, itinerary, expense, live, and completion context.
- Itinerary planning with days, events, event reorder, mapped locations, event completion, and undo-completion.
- AI-assisted itinerary draft generation.
- Expense groups, expense creation, editing, deletion, split previews, payer selection, and itinerary-event linking.
- Live trip location updates and crew location fetching.
- Trip completion workflow with confirmation tracking.
- Notifications, recent activity, read/clear actions, and action acceptance.
- Contacts sync, friend discovery, and SMS invite support.
- Destination cover image management, automatic destination cover lookup, and destination brief generation.
- Trip photo upload, retrieval, and deletion.
- Reporting and blocking tools for trust and safety.
- Push token registration and unregistering for mobile notifications.

## Mobile App Navigation

Main tabs:

- Home
- Trips
- Live
- Expenses
- Profile

Stack screens:

- Onboarding
- Login
- CompleteProfile
- PermissionsSetup
- CreateGroup
- TripCreate
- TripOverview
- TripInvite
- TripSetup
- Itinerary
- AddExpense
- TripCompletion
- Settings
- Notifications

## Backend API Areas

The backend exposes authenticated `/api` routes plus a public health check.

- `GET /health`
- User profile: `/api/me`, profile images, push tokens
- Social graph: contacts sync, friends, SMS invites
- Notifications and recent activity
- Reports, blocks, and unblocks
- Trips: create, list, detail, update, delete, completion
- Trip invites and members
- Trip setup status
- Itinerary days and events
- Expenses and expense groups
- Live locations
- Trip covers, destination briefs, and trip photos

## Database Areas

The backend manages schema migrations in `backend/internal/db/schema.go` and the initial SQL schema in `backend/db-schema/init.sql`.

Main data areas include:

- Users
- Trips
- Trip members
- Trip invites
- Destination votes
- Itinerary days and events
- Expense groups, expenses, and expense splits
- Trip photos and destination cover cache
- Friendships
- Live locations
- Member setup status
- Push tokens
- SMS invites
- Notifications
- Event and trip completion confirmations
- Reports
- User blocks

## Configuration

### Mobile App

The mobile app uses `mobile-app/src/config/api.ts`.

```text
EXPO_PUBLIC_API_BASE_URL
```

If unset, the app falls back to:

```text
https://gotogether-backend-501556960072.us-central1.run.app
```

Firebase client files are present in the mobile app:

- `mobile-app/GoogleService-Info.plist`
- `mobile-app/google-services.json`

### Backend

Common backend environment variables:

```text
PORT
DATABASE_URL
INSTANCE_CONNECTION_NAME
DB_SOCKET_DIR
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
DB_SSLMODE
FIREBASE_ADMIN_JSON
FIREBASE_ADMIN_JSON_PATH
GOOGLE_APPLICATION_CREDENTIALS
TRIP_PHOTOS_BUCKET
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
APP_INVITE_URL
OPENAI_API_KEY
OPENAI_TEXT_MODEL
OPENAI_IMAGE_MODEL
OPENAI_IMAGE_SIZE
OPENAI_IMAGE_QUALITY
GOOGLE_PLACES_API_KEY
PEXELS_API_KEY
UNSPLASH_ACCESS_KEY
ENABLE_OPENAI_DESTINATION_COVER_FALLBACK
```

`APP_INVITE_URL` defaults to `https://gotogether.app` when unset.

## Local Development

### Mobile App

```bash
cd mobile-app
npm install
npm run start
```

Useful commands:

```bash
npm run ios
npm run android
npm run web
npm run start:tunnel
```

### Backend

```bash
cd backend
go mod download
go run ./cmd/server
```

The server listens on `PORT` or `8080` by default.

### Prototype Web Surface

```bash
npm install
npm run dev
```

## Validation

Recommended checks before deployment:

```bash
cd backend
go test ./...
```

```bash
cd mobile-app
npx tsc --noEmit
```

For the older Vite prototype:

```bash
npm run lint
npm run test
npm run build
```

## Build And Release

### iOS

The app is configured for iOS with:

- Bundle identifier: `com.gdkalyan.gotogether`
- App version: `1.0.1`
- Build number: `16`
- EAS `testflight` profile configured for store distribution

### Android

The app is configured for Android with:

- Package: `com.vulkancommander.gotogether`
- Version code: `2`
- Production build type: Android App Bundle (`app-bundle`)
- Play Store launch planned

### Backend Deployment

The backend Dockerfile builds the Go API and exposes port `8080`.

The currently preferred deploy helper is:

```bash
cd mobile-app
./deploy.sh
```

On Windows, use Git Bash explicitly if PowerShell resolves `bash` to WSL:

```powershell
& "C:\Program Files\Git\bin\bash.exe" mobile-app/deploy.sh
```

The deploy helper runs checks, commits local changes if needed, pushes the branch, builds the backend image, deploys to Cloud Run, and checks `/health`.

## Important Product Rules

- Trip invite links are reusable.
- Trip invite links do not expire for now.
- Members can edit and add trip content after joining a trip.
- Delete and remove actions are reserved for the trip creator.
- Manual member add and share-link onboarding are both supported.

## Notes For Future Work

- Keep the mobile app as the production surface.
- Treat the Vite app as a prototype/reference unless it is intentionally revived.
- Keep backend route changes aligned with both `backend/internal/db/schema.go` and `backend/db-schema/init.sql` when schema changes are needed.
- Preserve the App Store release status and Play Store launch planning in release documentation.
