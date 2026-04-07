# GoTogether — Project State

## 🧭 Project Overview

GoTogether is a **mobile-first group trip coordination app**.

The goal is to help friend groups:

* match availability
* vote on destinations
* assign a trip lead
* manage itinerary
* track live location
* split expenses
* complete trips with confirmation

This is NOT a web-first app.
Web (Lovable) is only used for **UI reference and design inspiration**.

---

## 🏗️ Current Architecture

### Frontend (Mobile)

* Framework: Expo + React Native (TypeScript)
* Location: `/mobile-app`
* Navigation: React Navigation (stack + bottom tabs)
* Status: Base scaffold completed

### Frontend (Web - Lovable)

* Framework: Vite + React + Tailwind + shadcn
* Location: `/src`
* Purpose: UI/UX reference only (NOT production)

### Backend (Planned)

* Platform: Google Cloud + Firebase
* Responsibilities:

  * Auth
  * Users / Friends / Groups
  * Trips
  * Availability matching
  * Voting
  * Itinerary
  * Expenses
  * Live location
  * Notifications
  * Image uploads

---

## 📱 Mobile App Structure

### Tabs

* Home
* Trips
* Live
* Expenses
* Profile

### Stack Screens

* Onboarding
* Login
* CreateGroup
* TripCreate
* TripOverview
* Itinerary
* AddExpense
* TripCompletion

---

## 🎨 Design System

### Style Direction

* Swiss design
* Clean grid
* High contrast
* Minimal clutter
* Premium feel (Apple / Airbnb / Notion level)

### Colors

* Primary: #1A1A2E
* Accent: #3A86FF
* Secondary: #7B61FF
* Background: #F8FAFC
* Surface: #FFFFFF
* Text: #111827 / #6B7280

### Components

* AppCard
* PrimaryButton (gradient)
* Screen wrapper
* SectionTitle
* Bottom Tab Navigation

---

## 🔧 Current Progress

### Completed

* Repo initialized and pushed to GitHub
* Lovable UI generated and stored
* Expo mobile app scaffold created
* Navigation structure implemented
* Core screens created (basic versions)

### Not Completed

* Pixel-perfect UI matching Lovable
* Backend integration
* State management
* Real data
* Live location
* Expense logic
* Authentication

---

## ⚠️ Important Rules

* DO NOT modify Lovable web files (`/src`)
* Mobile app (`/mobile-app`) is the real product
* Build mobile-first always
* Do NOT overbuild features before UI is stable
* Build screen-by-screen (no bulk generation)

---

## 🎯 Current Focus

Start rebuilding screens properly with production-level UI.

### First Target

👉 TripOverviewScreen

Reason:

* Core of the app
* Defines design system
* Connects all flows

---

## 🧠 Development Approach

For each screen:

1. Match Lovable UI visually
2. Improve spacing, typography, hierarchy
3. Use reusable components
4. Keep code clean and modular
5. Prepare for backend integration later

---

## 🚀 Next Step

Rebuild:
👉 TripOverviewScreen

Make it:

* visually premium
* structured properly
* reusable
* production-ready

---

## 📌 Notes

* Lovable = design reference
* Expo app = real product
* ChatGPT = code generator + architect

---

END OF FILE
