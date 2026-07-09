
## 1. Branding & metadata cleanup

The current `index.html` already uses GoTogether title, description, canonical, OG, Twitter, and JSON-LD tags — no Lovable strings remain in user-facing code. Remaining branding gaps to close:

- Generate a branded **1200×630 Open Graph image** (deep-indigo gradient with GoTogether wordmark + app icon) and add it to `public/og-image.png`.
- Reference it in `index.html` as `og:image` and `twitter:image` using a relative `/og-image.png` path. Note the caveat: social crawlers need an absolute URL, so the preview image only fully works once the site is published on a real domain (Lovable hosting also auto-injects an OG image at serve time as a fallback). I'll call this out to you in chat, not in the tags.
- Add **`apple-touch-icon`** (180×180) generated from the app icon → `public/apple-touch-icon.png`.
- Add **`<meta name="theme-color">`** matching the deep-indigo brand.
- Add a small `<meta name="apple-mobile-web-app-title" content="GoTogether">`.
- Confirm no Lovable strings remain anywhere in `src/`, `index.html`, or `public/` (already verified — only infra references in `bun.lock` which are internal).

## 2. Mobile & tablet performance

Focused, low-risk optimizations — no layout redesign.

- **Images**
  - Add explicit `width`/`height` to `PhoneFrame` `<img>` to prevent CLS.
  - Add `decoding="async"` everywhere and keep `loading="lazy"` for below-the-fold screenshots; hero screenshots stay `eager` with `fetchpriority="high"` on the primary one.
  - Preload the primary hero screenshot in `index.html` (`<link rel="preload" as="image">`).
- **Hero on small screens**
  - Secondary tilted phone is already `hidden lg:block` — keep.
  - Reduce aurora blob count/size below `md` (they trigger large paint work on mobile GPUs); scope the existing blobs with `hidden md:block` on the two heaviest and keep one lighter blob on mobile.
- **CSS**
  - Add `content-visibility: auto` + `contain-intrinsic-size` to `Features`, `HowItWorks`, `Screenshots`, `MemoriesSection`, `DownloadCTA` sections so offscreen content is skipped during initial paint on mobile.
  - Respect `prefers-reduced-motion` for the `Reveal` component and the aurora animation.
- **Fonts**
  - Verify Inter is loaded with `display=swap` and only the weights actually used (400/500/600/700). Trim if extra weights are pulled.
- **Tap targets & safe areas**
  - Ensure buttons and nav links are ≥44px tall on mobile; add `padding-bottom: env(safe-area-inset-bottom)` to the sticky footer/CTA if needed.
- **Viewport**
  - Update viewport meta to `width=device-width, initial-scale=1, viewport-fit=cover` for iOS notch safe areas.

## Out of scope

- No new sections, copy changes, or restructuring.
- No route changes, backend, or Lovable Cloud.
- No changes to `mobile-app/` or `backend/` folders.

## Technical notes

- OG image generated with `imagegen` (premium tier for legible wordmark), saved directly to `public/og-image.png` (kept in-repo because it must be served at a stable, non-CDN path for og tags and is small).
- Apple touch icon derived from the existing `gotogether-icon` asset via `imagegen` at 180×180, saved to `public/apple-touch-icon.png`.
- All image tweaks are prop-level; no component API changes.
- CSS additions live in `src/index.css` under a new `@layer utilities` block; existing tokens untouched.

## Files to change

- `index.html` — add og:image, twitter:image, apple-touch-icon, theme-color, updated viewport, hero image preload.
- `public/og-image.png` — new.
- `public/apple-touch-icon.png` — new.
- `src/index.css` — reduced-motion rules, `content-visibility` utility, mobile-scoped aurora tweaks.
- `src/components/site/PhoneFrame.tsx` — width/height, decoding, fetchpriority prop.
- `src/components/site/Hero.tsx` — mark primary phone high priority, hide heavy blobs below md.
- `src/components/site/Screenshots.tsx`, `Features.tsx`, `HowItWorks.tsx`, `MemoriesSection.tsx`, `DownloadCTA.tsx` — add `content-visibility` class to section wrappers.
- `src/components/site/Reveal.tsx` — respect reduced motion.
