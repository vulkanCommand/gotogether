## GoTogether Marketing Website — Plan

Transform the current prototype (13 in-app screens) into a single polished marketing landing page. The mobile app UI code and routes will be removed — this site's only job is to explain GoTogether and drive iOS downloads.

### Visual identity (reuses existing tokens)

- Keep the current `index.css` HSL tokens and `tailwind.config.ts` as-is — they already define the exact palette (Deep Indigo, Electric Blue `#3A86FF`, Soft Violet `#7B61FF`, Off-white bg, Emerald/Amber/Red). Only additions:
  - A darker hero-gradient token (indigo → electric blue) matching uploaded screenshot 1.
  - A subtle "aurora" radial-gradient utility for background blobs seen in the mockups.
- Typography: Inter (already loaded). Large tight-tracking display headings, medium body, Swiss-style generous whitespace.
- Motion: lightweight CSS + Tailwind (`animate-fade-in`, `animate-slide-up`, existing `animate-pulse-soft`) plus scroll-triggered reveal via IntersectionObserver — no framer-motion needed.

### Assets

- Import the 9 uploaded App Store screenshots (`user-uploads://1.png … 10.png` minus 9) as Lovable Assets via the `lovable-assets` CLI so they aren't copied into the repo. Each becomes an `*.asset.json` pointer under `src/assets/screenshots/`.
- Use `user-uploads://icon.png` as the GoTogether app icon (nav logo mark + hero badge + favicon).
- Delete the now-unused prototype images (`trip-hero.jpg`, `destination-*.jpg`, `onboarding-illustration.png`).

### Page structure (single route `/`)

1. **Sticky glass navbar** — icon + "GoTogether" wordmark left, anchor links (Features, How It Works, Screenshots, Download) center, `Download on iOS` gradient button right. Mobile: hamburger → sheet.
2. **Hero** — Two-column on desktop, stacked on mobile.
   - Left: eyebrow badge "Now live on the iOS App Store", H1 "Plan trips together. Remember them forever.", subtext, App Store black button + muted "Google Play — coming soon" chip.
   - Right: hero phone (screenshot 1 — onboarding) tilted slightly, with soft indigo→violet aurora blobs behind it (matching the uploaded marketing frames).
3. **Announcement strip** — thin full-width band: "🎉 Now live on the App Store · Android in testing".
4. **Features grid** — 6 cards (Plan trips, Add people, Organize plans, Track expenses, Keep memories, Group coordination), lucide icons, hover lift, gradient icon backgrounds.
5. **How It Works** — 3 numbered steps in a horizontal connected timeline (desktop) / vertical (mobile): Create a trip → Invite your friends → Plan, split, enjoy.
6. **Screenshots showcase** — horizontal scroll / grid of 6 phone mockups using the uploaded screenshots (Home, Trips, Trip Overview, Itinerary, Live, Expenses) with captions.
7. **Travel + Memories** — warm emotional section with the Trip Completion screenshot (10.png) beside copy about "before, during, and after the journey" and a soft gradient background.
8. **Final CTA** — full-bleed gradient panel: "Ready to plan your next trip together?" + App Store button + coming-soon Play chip.
9. **Footer** — logo + tagline "Group trip planning made simple." + App Store / Play Store (disabled) links + © 2026 GoTogether.

### Reusable components (new)

- `src/components/site/Navbar.tsx`
- `src/components/site/Hero.tsx`
- `src/components/site/AnnouncementStrip.tsx`
- `src/components/site/Features.tsx`
- `src/components/site/HowItWorks.tsx`
- `src/components/site/Screenshots.tsx`
- `src/components/site/MemoriesSection.tsx`
- `src/components/site/DownloadCTA.tsx`
- `src/components/site/Footer.tsx`
- `src/components/site/PhoneFrame.tsx` — reusable rounded device frame with notch, subtle bezel shadow, accepts an image src.
- `src/components/site/AppStoreButton.tsx` — official-style black pill with Apple glyph.
- `src/components/site/PlayComingSoonBadge.tsx` — muted disabled variant.

### File changes

- **Rewrite `src/App.tsx`** — remove `BrowserRouter`, all app routes, `BottomNav`, `AppShell`. Render a single `<LandingPage />` inside `TooltipProvider` + toasters.
- **Rewrite `src/pages/Index.tsx`** as the landing page composition (Navbar + sections + Footer). Route it as `/` via a minimal `Routes` (kept only so `NotFound` still works and the SPA fallback stays sane).
- **Delete** all `src/pages/*Screen.tsx` files (13 files), `src/components/BottomNav.tsx`, `src/components/AppShell.tsx`, `src/components/NavLink.tsx`, plus stale `src/App.css`.
- **`index.html`** — update `<title>` to "GoTogether – Trip Planner for Friends", meta description, `og:title`, `og:description`, `og:type=website`, `twitter:card=summary_large_image`. Update favicon to the uploaded icon (converted to a small asset). Add Organization JSON-LD.
- **`src/index.css`** — add hero-gradient + aurora utilities alongside existing tokens (no color changes).
- **`README.md`** — leave untouched (it's the real project README).

### Out of scope

- No routing beyond `/` and `*` (NotFound). No auth, no forms, no backend, no Lovable Cloud.
- The `mobile-app/` and `backend/` folders are the real product — untouched.
- No og:image generated (per head-metadata guidance); Lovable hosting will inject one.

### Deliverable

A single-scroll marketing site at `/` that looks and feels like the uploaded App Store marketing frames — same palette, same phone-mockup vibe, Swiss spacing — with a clear iOS download path and a "Play Store coming soon" secondary state throughout.
