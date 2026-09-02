# Workflow — Tailwind v3 → v4 migration (step-by-step playbook)

> Purpose: an agent-executable workflow for migrating a project from Tailwind **v3 to v4 (CSS-first)**.
> The steps are numbered and run in execution order; each one has **what to look for** (detecting v3 habits) and
> **how to fix** (the v4 canon). This is an implementation layer in CSS, not a visual redesign: external tokens/
> the design system are **mapped** into `@theme`, not redefined; values are placeholders,
> names are stable.
>
> This file is an orchestrator. It does **not** duplicate the tables: cross-check every rule against
> `references/v4-rules.md` (Wrong→Correct→Why triples) and `resources/v3-to-v4-cheatsheet.md`
> (a flat "before → after" map). Subtle "silent" breakages are in `references/gotchas.md` /
> `resources/gotchas-list.md`. Ready-made entry points are in `templates/` (`entry.css`, `theme.css`).
>
> There is also a codemod upgrader: `npx @tailwindcss/upgrade` (Node 20+) automates most of the
> mechanical edits below. This playbook describes the **manual/verification** path — use it
> both as a review after the codemod and when the upgrader is unavailable.

---

## Step 0 — Browser baseline and compatibility (gate)

**Why first:** v4 relies on native CSS features (cascade layers, `@property`, `color-mix()`,
`oklch()`, container queries) and does **not** polyfill them. If the project must support old
browsers — migration is not possible; this is a product-level constraint, not a Tailwind setting.

**What to look for:**
- the target baseline in `browserslist` / `.browserslistrc` / `package.json`, requirements for IE11 or
  old Safari;
- use of Sass/Less/Stylus as a preprocessor (v4 is itself your preprocessor; pairing it with Sass is not
  supported — see the official Tailwind documentation).

**How to fix / decision:**
- check the minimum: **Safari 16.4+, Chrome 111+, Firefox 128+**. Below that — stop, do not start the migration.
- if the project uses Sass/Less for nesting/variables — in v4 these are covered by native CSS nesting
  (via Lightning CSS) and CSS variables; the plan is to extract the logic into `@theme`/native CSS.

Baseline details and related mechanisms — `references/gotchas.md` §10.

---

## Step 1 — Tooling and dependencies (PostCSS / Vite / CLI)

**What to look for** (in `postcss.config.*`, the bundler config, `package.json`):
- the `tailwindcss` plugin in the list of PostCSS plugins;
- neighboring `postcss-import` and/or `autoprefixer`;
- `npx tailwindcss` calls from the main package.

**How to fix:**
- PostCSS pipeline: replace the `tailwindcss` plugin with the separate package **`@tailwindcss/postcss`**.
  The `tailwindcss` package is **no** longer a PostCSS plugin.
- **Remove** `postcss-import` and `autoprefixer` — in v4 import bundling and vendor prefixes are built in;
  keeping them is harmful.
- if the build is not on PostCSS: for the bundler — the **`@tailwindcss/vite`** plugin (the recommended path for
  plain CSS entry points), for scripts/CLI — the **`@tailwindcss/cli`** package (`npx @tailwindcss/cli`).

⚠️ **SFC-preprocessor caveat (Approach B in component frameworks).** `@tailwindcss/vite` only transforms modules
whose id ends in `.css` (or contains `&lang.css`). If you author BEM+`@apply` in a single-file component's
**preprocessed** scoped block (a `<style lang="scss">` whose id ends in `&lang.scss`), the Vite plugin **skips it
entirely** and ships `@apply`/`@reference` to the browser **raw and unexpanded — with no build error**, so every
such component renders unstyled. Two safe paths:
- **Recommended:** run **`@tailwindcss/postcss`** (it runs after the Sass step on every CSS module, including
  preprocessed scoped styles, so `@apply` expands). This is what lets you keep `<style lang="scss">` (so `&-`/`&_`
  nesting works).
- **Alternative:** drop the preprocessor and write flat literal BEM selectors in a plain `.css`/`&lang.css` scoped
  block — those `@tailwindcss/vite` does handle.
Don't claim both as the chosen state, and make sure your project's setup docs name the **actually-configured**
plugin. ⚠️ Don't trust "build passed" for Approach B: verify by scanning the **compiled** CSS for leftover
`@apply`/`@reference`, not just the build exit code.

The canonical PostCSS config (Wrong→Correct) — `references/v4-rules.md` §4; the package map (CLI/Vite/
PostCSS) — `resources/v3-to-v4-cheatsheet.md`, the "PostCSS / tooling" section. The `@apply`-in-isolated-styles /
`@reference` mechanics — Step 5.6 and `references/gotchas.md` §6.

---

## Step 2 — Entry point: `@tailwind` → `@import "tailwindcss"`

**What to look for** in the entry CSS:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

These directives are **completely removed** in v4.

**How to fix:** replace all three with a single import:

```css
@import "tailwindcss";
```

It expands into the cascade layers `theme → base → utilities` (+ the reserved `components`);
the layer order sets the cascade. A ready entry-point skeleton with all sections (variants, utilities,
`@source`) — `templates/entry.css`; a set of semantic tokens — `templates/theme.css`.

Rationale — `references/v4-rules.md` §1.

---

## Step 3 — JS config → `@theme` (what to move, what to keep in `@config`)

**What to look for:** `tailwind.config.{js,ts,cjs,mjs}` and reliance on its **auto-pickup** — in v4
there is **no** auto-pickup, the file is not read on its own.

**How to fix — split the config's contents between two destinations:**

**A. Move into `@theme` (CSS-first) — the bulk of it:**
- `theme.extend.colors.*` → `--color-*` (`brand` → `--color-brand`; the name generates `bg-brand`,
  `text-brand`, `border-brand`, `ring-brand` and slash-opacity `bg-brand/90`);
- `borderRadius` → `--radius-*`; `fontFamily` → `--font-*`; `fontSize` → `--text-*`
  (+ the paired `--text-*--line-height`); `boxShadow` → `--shadow-*`; `screens` → `--breakpoint-*`
  (values in **rem**, not px); `keyframes`/`animation` → `@keyframes` + `--animate-*`.
- **Spacing:** do NOT rewrite the static `spacing` scale as a list — in v4 it is a single token
  `--spacing` (the entire numeric scale is computed via `calc(var(--spacing) * N)`).
- global options: `important: true` → `@import "tailwindcss" important;`;
  `prefix: 'tw'` → `@import "tailwindcss" prefix(tw);` (classes become `tw:bg-primary`);
  `darkMode: 'class'` → `@custom-variant dark (&:where(.dark, .dark *));`.
- `safelist: [...]` → `@source inline("...")`; `content: [...]` is usually **not needed**
  (automatic source detection, respects `.gitignore`); non-standard paths — `@source "..."`.

Important: `@theme` accepts **only** top-level `--variables` and `@keyframes` — no
nested selectors/`@media`/`.dark` inside (dark overrides and media — as regular selectors
**outside** `@theme`). If values come from an external design system/`DESIGN.md` — **map**
them into `@theme` under canonical names, do not redefine them.

**B. Keep in the JS config and wire in via `@config` — only genuine dynamics:**
- JS plugins (`@plugin "@tailwindcss/typography"`), a programmatically computed theme, complex JS logic
  that cannot be expressed in CSS. Wiring is **explicit**:

```css
@import "tailwindcss";
@config "../tailwind.config.js";
@plugin "@tailwindcss/typography";
```

If there is no such dynamics — **delete** `tailwind.config.js` (NEVER keep it "just in case").

Wrong→Correct→Why triples — `references/v4-rules.md` §2 (`@theme`), §3 (`@config`), §13a
(global important); the options map (`important`/`prefix`/`darkMode`/`safelist`/`content`) —
`resources/v3-to-v4-cheatsheet.md`, the "Setup and configuration" and "Custom utilities…" sections.

---

## Step 4 — Utility and custom-utility renames

**What to look for and how to fix** (mechanical replacements across all markup/CSS):

1. **Opacity** `bg-opacity-*`, `text-opacity-*`, `border-opacity-*`, `ring-opacity-*`,
   `placeholder-opacity-*` (removed) → the slash modifier on the class itself: `bg-primary/50`,
   `text-foreground/75`, `border-border/60`, `ring-ring/30`.
2. **Gradients** `bg-gradient-to-*` → `bg-linear-to-*` (plus the new `bg-radial-*`, `bg-conic-*`).
3. **Shift of the size scale by one step** — the trickiest item (silently changes the look, does not fail):
   - `shadow-sm` → `shadow-xs`, bare `shadow` → `shadow-sm`;
   - `rounded-sm` → `rounded-xs`, bare `rounded` → `rounded-sm`;
   - `blur-sm` → `blur-xs`, bare `blur` → `blur-sm`;
   - `drop-shadow-sm` → `drop-shadow-xs`.
   The former `-sm` now means "one step larger", so `shadow-sm`/`rounded-sm` are **valid, but
   mean something else** — check every occurrence, not just "build errors". In the skill's semantics
   we use the radius tokens `rounded-sm/md/lg/xl` (`--radius-*`).
4. **Resetting transforms:** `transform-none` → targeted `scale-none` / `rotate-none` /
   `translate-none`.
5. **`outline-none`:** if the goal is to visually remove the outline, in v4 that is `outline-hidden` (preserves
   accessible focus in forced-colors); `outline-none` now = real `outline-style: none`.
6. **Custom utilities** `@layer utilities { .x { ... } }` → `@utility x { ... }` (a functional one
   with a value must end in `-*`: `@utility tab-* { tab-size: --value(integer); }`).
   Component classes of the BEM+`@apply` approach are `@layer components`, which we do **not** touch.
7. **CSS functions in arbitrary values:** `theme('colors.red.500')` → `--theme(--color-red-500)`;
   manual `rgb(var(--x) / <alpha>)` → `--alpha(var(--x) / 50%)`.

Each rename with rationale — `references/v4-rules.md` §5 (opacity), §7 (`@utility`),
§8 (gradient), §12 (scale shift, table), §19 (`transform-none`); the full flat map —
`resources/v3-to-v4-cheatsheet.md`, the "Color, opacity, gradients" and "Renamed
values" sections.

---

## Step 5 — Syntax changes that break the build or the look "silently"

These edits are not covered by a simple find-replace on names — check them specifically.

1. **A CSS variable in an arbitrary value:** `bg-[--brand]` (v3) → `bg-(--brand)` (v4, round
   parentheses). Square brackets remain only for **literal** values (`top-[117px]`,
   `[mask-type:luminance]`). With a fallback — `bg-(--brand,var(--color-muted))`. This is the correct path
   for runtime values instead of hardcoding hex.
2. **Two "importants" — do not mix them:** the global `@import "tailwindcss" important;` (a flag on the whole
   utilities layer) ≠ the targeted suffix on a class `bg-danger!`. And both ≠ the **v3 prefix** `!bg-danger` —
   in v4 important is a **suffix** `!` at the end of the class (`mt-0!`, `hover:underline!`). Replace all
   v3 prefixes `!class` with the suffix `class!`.
3. **The variant stack reads left-to-right** (the inverse of v3). For simple pairs the result is the same, but
   in nested `group-*`/`peer-*`/`*`/`**` and pseudo-elements (`before:hover:` vs `hover:before:`) the
   write order changes the resulting selector. If an effect "got lost" after migration — first
   reverse the order in the stack.
4. **`border`/`ring` default to `currentColor`, and the `ring` width is 1px** (was `gray-200`/`blue`,
   3px). A bare `border` is drawn in the current text color (and with `border: 0 solid` — without an explicit width
   nothing at all). Set color and width explicitly: `border border-border`, `ring-2 ring-ring`. The former
   ring look — `ring-3`. A single default border color can be baked in once: `@layer base { * { @apply
   border-border; } }`.
5. **`space-*` / `divide-*` changed their internal selector:** with non-trivial nesting the spacing
   may "drift" — where possible, switch to `flex`/`grid` + `gap` (more robust and matches the
   "layout" group). For flat lists `space-*` remains acceptable.
6. **`@apply` in isolated styles requires `@reference`:** in CSS modules and component
   `<style>` blocks the theme is not visible — without `@reference "path-to-entry.css"` `@apply` to tokens fails.
   In a single entry CSS (which already has `@import "tailwindcss"`) `@reference` is not needed. `@apply` inside
   `@keyframes` is forbidden; mixing CSS mixins and utilities in one `@apply` is not allowed.
7. **`@screen` is removed — and fails silently:** the v3 `@screen md { … }` directive (and the `screen()` helper)
   no longer exist in v4. The compiler does **not** error; it passes the unknown at-rule through verbatim, the
   browser ignores it, and the wrapped rules are **silently dropped**. To apply a breakpoint **inside** custom
   CSS / a component class (Approach B), use the `@variant` shorthand or a token-driven media query:

   ```css
   /* WRONG (v3, silently dropped in v4): */
   @screen md { .cardGrid { @apply grid-cols-2; } }

   /* CORRECT — @variant shorthand (compiles to @media (width >= 48rem)): */
   @variant md { @apply grid-cols-2; }

   /* CORRECT — what the codemod emits (token-driven media query): */
   @media (width >= theme(--breakpoint-md)) { @apply grid-cols-2; }
   ```

   `@apply` works inside both forms. For breakpoint utilities **in markup**, use variants directly (`md:flex`).
   When one element accumulates many same-prefix breakpoint utilities in `@apply`, grouping them into a single
   `@variant <bp> { @apply … }` block (mobile base on the normal grouped lines) reads better — but this is an
   optional readability choice, not a mandate; don't push viewport responsiveness wholesale into SCSS.

Detailed triples — `references/v4-rules.md` §13 (important/disambiguation), §14 (`bg-(--var)`),
§15 (`@reference`), §16 (currentColor/ring), §18 (left-to-right stack), §20 (`space`/`divide`);
the "silent" breakages in full — `references/gotchas.md` §1, §3, §5, §6; a quick check — `resources/gotchas-list.md`.
Breakpoints inside CSS via `@variant` — `docs/custom-utilities-and-layers.md` §4 and
`docs/responsive-and-container-queries.md` §5.

---

## Step 6 — Class detection and sources (`@source`)

**What to look for:** in v3 you relied on `content` globs and `safelist`; a typical landmine is **dynamically
assembled class names**. The v4 scanner looks for **literal** substrings as plain text, it does not execute
code — concatenation (`text-${color}-500`, `'bg-' + name`, `text-{{ tone }}-foreground`) does not
produce a complete literal, and CSS for it is **not generated** (the class "silently" does not work).

**How to fix (in order of preference):**
1. Map a value → the **full class name** (whole strings, statically visible: `text-danger`,
   `text-success`), rather than gluing it from pieces.
2. List the variants in full somewhere in the template/markup.
3. As a last resort — safelist via `@source inline("...")` (supports brace expansion:
   `@source inline("{bg,text,border}-{primary,danger,success}")`). It inflates the output — only when a
   literal is truly impossible (data/CMS/runtime).

**Scanning sources:** `content: [...]` from the JS config is usually removed — automatic detection walks
the tree, **respecting `.gitignore`** and excluding `node_modules`/`.git`/binaries/lock files. Non-standard
paths (for example, third-party markup in `node_modules`) are added via `@source "..."`; exclusions —
`@source not "..."`. The `@source` section is present in the `templates/entry.css` skeleton.

A full breakdown — `references/v4-rules.md` §17, `references/gotchas.md` §7 and §9;
the `safelist`/`content` → `@source` map — `resources/v3-to-v4-cheatsheet.md`, the "Class detection" section.

---

## Step 7 — Verification and review

**What to look for (a pass over the project):**
- the build passes with no warnings about unknown classes/directives;
- no v3 literals remain: `@tailwind`, `@screen`/`screen(`, `*-opacity-*`, `bg-gradient-to-`, `bg-[--`, the prefix
  `!class`, `transform-none`, `@layer utilities { .` for your own utilities, `postcss-import`/
  `autoprefixer`, mentions of `tailwind.config.js` auto-pickup;
- visual regression from the scale shift: spot-check `shadow-*`/`rounded-*`/`blur-*` and `ring`;
- borders/rings have an explicit color (`border-border`, `ring-ring`), visible `focus-visible`;
- in scoped/`<style>`/CSS modules, `@reference` precedes `@apply`.

**How to fix:** run the full review checklist — `references/review.md` (12 items: class detection,
tokens vs arbitrary, the full set of states, correct `@apply` grouping, v4 syntax,
dark mode, etc.); the step-by-step review workflow — `workflows/review-tailwind.md`. Reference
working components (an A-utility / B-BEM pair for each) — in `examples/` (`examples/button/*`,
`examples/card/*`, etc.) and `examples/README.md`.

---

## Migration checklist (final self-check)

- [ ] **0.** Baseline Safari 16.4+ / Chrome 111+ / Firefox 128+ confirmed; Sass/Less removed from
  the pipeline.
- [ ] **1.** PostCSS plugin — `@tailwindcss/postcss` (not `tailwindcss`); `postcss-import` and
  `autoprefixer` removed; bundler/CLI — `@tailwindcss/vite` / `@tailwindcss/cli`. For Approach B in a component
  framework with **preprocessed** scoped styles (`<style lang="scss">`): use `@tailwindcss/postcss` (the Vite
  plugin skips `&lang.scss` ids) and confirm the compiled CSS has no leftover `@apply`/`@reference`.
- [ ] **2.** The three `@tailwind` directives replaced with a single `@import "tailwindcss"`.
- [ ] **3.** Theme moved into `@theme` (`--color-*`/`--radius-*`/`--text-*`/`--spacing`/
  `--breakpoint-*`); `important`/`prefix`/`darkMode`/`safelist` — in CSS form; JS config deleted
  **or** wired in explicitly via `@config`/`@plugin` only for genuine dynamics.
- [ ] **4.** `*-opacity-*` → slash; `bg-gradient-` → `bg-linear-`; the `-sm`→`-xs` shift checked
  element by element; `transform-none` → targeted resets; `@layer utilities` utilities → `@utility`.
- [ ] **5.** `bg-[--var]` → `bg-(--var)`; v3 prefix `!class` → suffix `class!`; the two "importants"
  not confused; variant stack left-to-right; `border-border`/`ring-ring` set explicitly;
  `@reference` in isolated styles; no v3 `@screen`/`screen()` left — breakpoints inside CSS via
  `@variant <bp> { @apply … }` (or `@media (width >= theme(--breakpoint-*))`).
- [ ] **6.** No dynamically assembled class names (only full literals); `content`/`safelist`
  converted to automatic detection + `@source` / `@source inline(...)`.
- [ ] **7.** Build clean; no leftover v3 literals; visual regression checked; passed
  `references/review.md`.

> When in doubt about a specific rule — the source of truth: the `references/v4-rules.md` triples, the flat
> `resources/v3-to-v4-cheatsheet.md` map, the "silent" breakages in `references/gotchas.md`. Engine
> behavior — the default behavior of the Tailwind v4 engine; official positions (incl. the `@tailwindcss/upgrade` codemod) —
> the official Tailwind documentation.
