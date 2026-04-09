# GoTogether — Project State (Frontend + Backend v1)

## 🧭 Project Overview

GoTogether is a mobile-first group trip coordination app.

The goal is to help friend groups:
- match availability  
- vote on destinations  
- assign a trip lead  
- build and manage itinerary  
- track live location  
- split expenses  
- complete trips with confirmation  

This is NOT a web-first app.  
Web Lovable is only used for UI reference and design inspiration.

---

## 🏗️ Current Architecture

### Frontend Mobile
- Framework: Expo + React Native + TypeScript  
- Navigation: React Navigation (Stack + Bottom Tabs)  
- State Management: Zustand (global store implemented)  
- Status: Fully connected frontend MVP (state-driven)

---

### Backend (NEW — IMPLEMENTED)

- Language: Go  
- Framework: Gin  
- Auth: Firebase (ID Token based authentication)  
- Database: PostgreSQL (Google Cloud SQL)  
- Hosting Target: Google Cloud Run  
- Repo Structure: Monorepo (`mobile-app + backend`)

---

## 🔐 Authentication Flow (WORKING)

Flow:

Mobile App (later)  
→ Firebase login  
→ ID Token  
→ Backend (`Authorization: Bearer <token>`)  
→ Firebase Admin verification  
→ User synced into DB  

---

## 🗄️ Database (LIVE)

### users
- id (SERIAL)
- firebase_uid (UNIQUE)
- email
- name
- created_at

### trips
- id (SERIAL)
- name
- destination
- start_date
- end_date
- created_by (FK → users.id)
- created_at

---

## 🔌 Backend APIs (WORKING)

### Health
- `GET /health`

---

### Auth/User
- `GET /api/me`
  - verifies Firebase token
  - auto-creates user in DB
  - returns user object

---

### Trips

- `POST /api/trips`
  - creates trip
  - links to authenticated user

- `GET /api/trips`
  - returns all trips for logged-in user

---

## 🔁 Verified Backend Flow

- Firebase login → token generated  
- Backend verifies token  
- User auto-inserted into DB  
- Trip created via API  
- Trip fetched via API  

End-to-end backend flow is working

---

## 📱 App Structure (Frontend)

### Tabs
- Home  
- Trips  
- Live  
- Expenses  
- Profile  

---

### Stack Screens
- CreateGroup  
- TripCreate  
- TripOverview  
- Itinerary  
- AddExpense  
- TripCompletion  

---

## 🔁 Frontend Flow (CONNECTED)

CreateGroup  
→ TripCreate  
→ TripOverview  
→ Itinerary  
→ AddExpense  
→ TripCompletion  

- Fully state-driven (Zustand)  
- No data loss  

---

## 🧠 Global State (Frontend)

### Stored
- Crew  
- Dates  
- Destination votes  
- Selected destination  
- Trip lead  
- Itinerary  
- Expenses  

---

## 🎯 Current System State

You now have:

- Complete mobile frontend (production-like)  
- Working backend (auth + trips)  
- Real database persistence  
- Real authentication system  
- Clean API structure  
- Backend-ready frontend  

This is not a prototype anymore  
This is a working product foundation  

---

## ⚠️ What’s NOT Done

### Backend
- Trip details API (`GET /trips/:id`)
- Itinerary persistence
- Expenses persistence
- Multi-user trip sharing
- Role management (trip lead, members)

### Infra
- Cloud Run deployment
- Secret Manager integration
- Firebase config in mobile app

### Frontend
- API integration (currently Zustand only)
- Auth UI (login/signup)
- Replace mock data with backend calls

---

## 🚀 Next Phase

### Backend
- Trip details API
- Itinerary APIs
- Expense APIs

### Frontend Integration
- Connect Zustand → backend APIs
- Replace local state with server sync

---

## ⚠️ Working Rules

- No UI polish  
- No refactors  
- No redesign  
- Move forward only  
- Backend first, then integration  

---

## 🎯 Next Chat Start

**Continue from PROJECT_STATE — connect frontend to backend (trips API integration)**