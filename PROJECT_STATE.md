# GoTogether — Project State (Final Frontend MVP)

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
- State Management: **Zustand (global store implemented)**  
- Status: **Fully connected frontend MVP (state-driven)**  

---

### Frontend Web Reference
- Framework: Vite + React + Tailwind + shadcn  
- Purpose: UI/UX reference only  

---

### Backend (Next Phase)
- Platform: Google Cloud + Firebase  
- Will handle:
  - Auth  
  - Users / Groups  
  - Trips  
  - Voting sync  
  - Itinerary persistence  
  - Expenses engine  
  - Live location  
  - Notifications  

---

## 📱 App Structure

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

## 🔁 Final Working Flow

CreateGroup  
→ TripCreate  
→ TripOverview  
→ Itinerary  
→ AddExpense  
→ TripCompletion  

👉 Flow is now:
- **Fully connected**
- **State-driven (Zustand)**
- **No data loss between screens**

---

## 🧠 Global State (NEW — CRITICAL)

All data now lives in a single Zustand store.

### Stored Data
- Crew  
- Selected dates  
- Best match range  
- Destination options + votes  
- Selected destination  
- Trip lead  
- Itinerary (days + events)  
- Expenses  

---

### Derived Data (Computed)
- Selected destination  
- Total plans  
- Confirmed plans  
- Next upcoming event  
- Total expense amount  

---

### Key Outcome

👉 No more local state fragmentation  
👉 Backend integration will be plug-and-play  
👉 Entire app behaves like a real product  

---

## 🧩 Screens Status

### ✅ CreateGroupScreen
- Connected to store  
- Crew persists across flow  

---

### ✅ TripCreateScreen
- Dates → stored globally  
- Destination voting → stored globally  
- Trip lead → stored globally  
- Fully persistent  

---

### ✅ TripOverviewScreen
- Reads from global store  
- Stable and locked  

---

### ✅ ItineraryScreen
- Fully store-driven  
- Add day + events persist  
- Next-up auto-calculated  
- Summary auto-updates  

---

### ✅ AddExpenseScreen
- Expenses stored globally  
- Split preview working  
- Total updates live  

---

### ✅ TripCompletionScreen
- Reads full trip data from store  
- Shows real summary  
- Reset flow implemented  

---

## 🎨 Design System

- Swiss layout  
- Clean grid  
- High contrast  
- Minimal clutter  
- Premium feel (Apple / Airbnb / Notion)

---

## ⚠️ What’s NOT Done (Next Phase)

- Backend integration  
- Real-time multi-user sync  
- Authentication  
- Persistent DB storage  
- Expense calculation logic  
- Live location tracking  

---

## 🧠 Current State (Real Truth)

You now have:

- A **complete frontend product (not prototype)**  
- Full end-to-end user journey  
- Shared global state across entire app  
- Backend-ready architecture  
- Clean separation of UI vs logic  

👉 This is the correct point to start backend  

---

## 🚀 Next Step

👉 Backend Integration (Phase 2)

Start with:
1. Auth (Firebase)  
2. Trip creation API  
3. Itinerary persistence  
4. Expense storage  

---

## ⚠️ Working Rules

- No UI polish now  
- No refactors  
- No redesign  
- Move forward only  
- Backend first  

---

## 🎯 Next Chat Start

Use:

**"Continue from PROJECT_STATE — start backend integration (auth + trip APIs)"**