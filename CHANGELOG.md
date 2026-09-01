# Changelog

All notable changes to the NotesChatAI codebase are documented in this file.

## 2026-09-01

### Fixed — Authentication & Session Persistence
- Migrated auth from in-memory dev-store to production **D1-backed session store** (`src/lib/db-auth.ts`). Sessions now survive Worker cold starts. Applies to Google/GitHub OAuth callbacks, login, signup, signout, and session endpoints.

### Fixed — Fonts (404s)
- Removed `@import '@fontsource/geist'` CSS imports that 404'd, replaced with explicit JS font imports in `Layout.astro` and `AppLayout.astro` (Geist 400/500/600/700 + Geist Mono 400). Font files now served correctly from `/_astro/`.

### Fixed — Routing & Access
- **Middleware public-path bug**: `/about`, `/terms`, `/privacy`, `/contact`, `/status` (and `/docs`) were being redirected to `/auth/login` for unauthenticated visitors. Added them to the public path whitelist so public/legal pages are reachable and crawlable.

### Fixed — Sitemap
- Excluded authenticated/private routes (`/app/*`, `/auth/*`, `/api/*`) from the sitemap.
- Blog post pages now have `export const prerender = true` so all blog articles are included in `sitemap-0.xml`.

### Fixed — SEO & Content
- Removed keyword stuffing from the homepage SEO section (rewrote to read naturally).
- Fixed broken internal links: `/signup` → `/auth/signup` (blog posts, free-beta), `/docs` link on about page → `/free-beta`, removed dead `/cookies` footer link.
- Removed duplicate "Blog" footer link.
- Fixed broken/nonexistent blog hero images (`/blog/launch-hero.png`, `/blog/comparison-hero.png`) → empty string.
- Fixed duplicate `<h1>` in blog posts (converted body `#` heading to `##`).
- Added descriptive `alt` text to blog hero images.
- Aligned contradictory product claims to the product's own "coming soon" reality:
  - API/platform claims (REST/GraphQL/webhooks/SDKs, embeddings API) — now "coming soon" on homepage, features page, pricing page, settings page copy, and blog posts.
  - Storage limits standardized (1 GB Free / 50 GB Pro).
  - Max file size corrected to 100 MB (matches the app's actual upload limit).
  - Model choice corrected to Gemini-only (Claude/GPT marked as roadmap).
  - OCR marked as "Planned" (not claimable as a shipped feature).
  - Audio playback speed corrected to 0.5x–2x (matches actual app).
  - Export format lists standardized across pages.
- Fixed stale "Beta Timeline" dates in free-beta docs (Q2/Q3 2025 → neutral roadmap language).
- Added `updatedDate` to blog posts whose product claims were revised.

### Fixed — Contact Form
- Contact form was fake (client-side "Message Sent!" with no actual submission). Added a real `POST /api/contact` endpoint and wired the form to submit it, with proper success/error state and `aria-live` status reporting.

### Fixed — Accessibility (WCAG 2.1 AA)
- **Color contrast** — dark-mode tokens corrected to pass AA on their surfaces:
  - `--color-mute`: `#666666` → `#969696` (6.4:1 on `#111111`, 5.9:1 on `#1a1a1a`).
  - `--color-violet-soft`: → `#d8ccf1` (11.5:1 on `#1a1a1a`).
  - `--color-cyan-soft`: → `#aaffec` (15.6:1 on `#171717`); `--color-cyan`: → `#79e0c9`.
  - `--color-violet` kept at `#7928ca` (white-on-`bg-violet` = 5.6:1), but **links/eyebrow labels that previously used it as text** now use readable violet text tokens:
    - New `--color-violet-bright` (`#aa7bd9`, 5.4:1 on dark) for "Read →" blog card links.
    - 6 eyebrow labels switched `text-violet` → `text-violet-soft` (home, features, pricing, about, blog, apps).
- **Features page**: `text-error/60` error-state captions in the NotebookLM-silo comparison mockup were 3.0:1 → now full `text-error` (6.1:1).
- **`.btn-primary`**: lightened the dark-on-dark reliance by adding a visible `border-hairline-strong` boundary + `shadow-level-2` so primary CTA buttons are distinguishable from surrounding text blocks (axe `link-in-text-block`).
- **Axe audit result**: all 11 public pages pass axe-core WCAG 2.1 A/AA with **0 violations**.

### Fixed — Accessibility (Light-Mode Contrast + Theme Consistency)
The site defaults to **light** theme, so the token set in `@theme` (the default/light values) had to pass AA on light (`#fff`/`#fafafa`) surfaces, while `.dark` overrides kept the (previously-verified) dark-passing values.
- **Light-mode tokens darkened** in `@theme` of `src/styles/global.css` to pass 4.5:1 on light surfaces:
  - `--color-mute`: `#6f6f6f` (4.81:1); `--color-link`: `#005fc2` (5.89:1); `--color-success`: `#005fd4`; `--color-error`: `#c50000` (5.32:1 on `#fbe9ea`).
  - `--color-violet-soft`/`--color-violet-bright`: `#7652cd`/`#7c4fd0`; `--color-cyan-soft`: `#c4f0e5`; `--color-cyan-deep`: `#0c7560`; `--color-highlight-pink`: `#c40060` (5.72:1 on white).
  - New `.dark` overrides for `--color-cyan-deep` (`#29bc9b`, 7.26:1) and `--color-highlight-pink` (`#ff6baa`, 7.14:1) so dark mode is not regressed.
- **Always-dark showcase bands**: homepage `showcase-band-dark` / `ShowcaseBandDark` bands keep a dark `#171717` background in both themes, but accent tokens resolve to the (now darker) light-mode values in light mode → 4 contrast violations (Step 2/3 labels, banner "Why switch"/"FAQ" eyebrows). Scoped the band to re-declare dark-readable accent values (`violet-soft`, `cyan-soft`, `cyan`, `highlight-pink`, `violet-deep`, `cyan-deep`) on `.showcase-band-dark`.
- **`dark:` variant now follows the class toggle, not the OS**: the theme is class-based (`.dark` on `<html>`), but the `body` tag used Tailwind's `dark:bg-[#111111]` variant which defaults to the OS `prefers-color-scheme` media query. On a dark-OS machine, toggling to light left the body `#111111`, breaking `.prose` blog content contrast (25 nodes on `introducing-noteschatai`, up to 23 on other posts). Added `@custom-variant dark (&:where(.dark, .dark *))` so `dark:` utilities follow the `.dark` class.
- **Axe audit result**: all 15 pages (10 public + 5 blog posts) pass color-contrast in **both** light and dark mode (0 violations), plus WCAG 2.1 A/AA (0 violations) and WCAG 2.2 `target-size` on key public pages.

### Fixed — SEO (og:image)
- Blog posts with no `heroImage` produced `og:image` = `https://noteschatai.com/` (the site root) because the layout's `new URL(ogImage, site)` fell back to the site root when passed an empty string.
- Added `ogImage={post.data.heroImage || '/og-image.png'}` in `src/pages/blog/[...slug]/index.astro` so posts without a hero use the branded fallback.
- **Created `public/og-image.png`** (1200×630 branded social-share image). Previously `/og-image.png` (referenced by every page's open-graph tags) did not exist and 302'd — every share/OG image was broken. Now served with `image/png` (200).

### Security Notes
- Credentials/API secrets shared in chat are being rotated by stakeholders. Verify token/secret rotation is complete before production promotions.