## Goal

Bring the four legal/support pages currently hosted on durgakalyan.com into the GoTogether marketing site, using the site's existing Swiss/premium design system (deep indigo, electric blue, violet, Inter, off-white bg). The Support page acts as the hub and links to the other three.

## New routes

Added to `src/App.tsx` (BrowserRouter — Lovable hosting handles SPA fallback):

- `/support` → Support hub
- `/privacy` → Privacy Policy
- `/terms` → Terms of Service
- `/delete-account` → Account Deletion instructions

All four pages get proper `<title>`, meta description, canonical, and a single H1 via a small `SEO` helper (or inline `useEffect`) — no new dependency needed.

## Page structure (shared shell)

Each legal page reuses `Navbar` and `Footer` and wraps content in a shared `LegalLayout` component:

- Centered `max-w-3xl` article
- Page title (H1), "Last updated: May 2026" subline
- Prose content styled with existing tokens (no `prose` plugin needed — use Tailwind spacing + `text-muted-foreground` / `text-foreground`)
- Back-to-home link at bottom

Content is copied verbatim from the fetched pages but broken into readable paragraphs, short section headings, and bullet lists (the source is one giant paragraph — restructuring for readability, not rewording).

### Support (`/support`) — hub

- Intro line + contact email `gdkalyan2109@gmail.com` (mailto)
- "We can help with" bullet list (sign-in/OTP, trips, friends, itinerary, live updates, expenses, profile, deletion, bug reports)
- Response time note (24–48h)
- Card grid linking to the three other pages:
  - Privacy Policy → `/privacy`
  - Terms of Service → `/terms`
  - Delete your account → `/delete-account`

### Privacy (`/privacy`)

Sections: Overview · Information we collect · How we use it · Permissions · Sharing & service providers · Shared trip visibility · Account deletion · Contact · Updates.

### Terms (`/terms`)

Sections: Acceptable use · Your responsibility · Prohibited conduct · Permissions · Shared trip visibility · Changes to the service · Account deletion · Disclaimer & liability · Contact.

### Delete Account (`/delete-account`)

Sections: In-app steps (Profile/Settings → Delete Account) · What gets removed vs retained · Email fallback with `gdkalyan2109@gmail.com` and 24–48h response note.

## Footer & Navbar updates

- `Footer.tsx`: add a fourth column "Legal & Support" with links to `/support`, `/privacy`, `/terms`, `/delete-account`. Adjust grid to `sm:grid-cols-2 lg:grid-cols-4`.
- `Navbar.tsx`: no top-nav change (keeps landing focus). Add a subtle "Support" link inside the mobile menu only — optional, small.

## Files

New:
- `src/pages/Support.tsx`
- `src/pages/Privacy.tsx`
- `src/pages/Terms.tsx`
- `src/pages/DeleteAccount.tsx`
- `src/components/site/LegalLayout.tsx` (shared shell + SEO head handling)

Edited:
- `src/App.tsx` — register 4 new routes
- `src/components/site/Footer.tsx` — add Legal & Support column
- `src/components/site/Navbar.tsx` — optional mobile-menu "Support" link

## Out of scope

- No CMS, no backend, no forms (contact is a `mailto:` link — matches the source).
- No copy rewrites beyond restructuring the single-paragraph source into readable sections.
- No changes to the mobile app or backend folders.
