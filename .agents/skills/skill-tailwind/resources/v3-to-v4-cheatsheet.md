# v3 → v4 cheatsheet

A flat table of Tailwind CSS **v3 → v4** migration changes. The left column shows
**before** (anti-pattern, do not use in new code), the middle one — **after** (v4 canon),
and the right one — a short note. All "before" entries are provided **only** for recognition during migration.

> Checked against the official Tailwind v4 documentation. Where it matters, give a "before → after" pair
> right in the edits.

## Setup and configuration

| v3 (before / anti-pattern) | v4 (after) | Note |
| --- | --- | --- |
| `@tailwind base;` `@tailwind components;` `@tailwind utilities;` | `@import "tailwindcss";` | A single import expands into the layers `theme → base → utilities` (+ the reserved `components`). The `@tailwind` directives are removed entirely. |
| `tailwind.config.js` with `theme.extend` | `@theme { --color-*: …; }` in CSS | CSS-first. The JS config is no longer needed in a typical project. |
| `tailwind.config.ts` as the primary mechanism | CSS `@theme` + `@config "…"` when dynamic | The JS config is only a compatibility layer, plugged in via `@config`. |
| `module.exports = { important: true }` | `@import "tailwindcss" important;` | Global important moved into the import line. ⚠️ This is NOT the same as the class suffix `bg-red-500!` — those are different things. |
| `module.exports = { prefix: 'tw' }` | `@import "tailwindcss" prefix(tw);` | Classes are written as `tw:bg-red-500` (prefix at the start). |
| `theme: { colors: {...} }` (override) | `@theme { --color-*: … }` (extend by default) | In v4 `@theme` extends rather than truncates the scale; to reset a namespace — `--color-*: initial;`. |
| `darkMode: 'class'` in the JS config | `@custom-variant dark (&:where(.dark, .dark *));` | Class-based dark mode is described in CSS as a custom variant. By default `dark` = `@media (prefers-color-scheme: dark)`. |

## PostCSS / tooling

| v3 (before) | v4 (after) | Note |
| --- | --- | --- |
| `plugins: { 'postcss-import': {}, tailwindcss: {}, autoprefixer: {} }` | `plugins: { '@tailwindcss/postcss': {} }` | In v4 `postcss-import` and `autoprefixer` are built in — don't add them separately. |
| `tailwindcss` plugin in PostCSS | `@tailwindcss/postcss` plugin | The package name changed. |
| `npx tailwindcss` (CLI from the main package) | `npx @tailwindcss/cli` | The CLI was moved into a separate package `@tailwindcss/cli`. |
| Vite via PostCSS | `@tailwindcss/vite` plugin | The recommended path for most bundler setups. ⚠️ Caveat for SFC frameworks: the Vite plugin only transforms ids matching `\.css$` / `&lang.css` / inline styles, so it **silently skips** single-file-component `<style lang="scss">` (id contains `&lang.scss`) and ships raw `@apply`/`@reference` with no error. If Approach B (`@apply` in a preprocessor `<style lang="scss">`) is used, switch to `@tailwindcss/postcss` (it runs after the preprocessor on every CSS module). |

## Custom utilities, variants, tokens

| v3 (before) | v4 (after) | Note |
| --- | --- | --- |
| `@layer utilities { .content-auto { … } }` | `@utility content-auto { … }` | Custom utilities are declared with the `@utility` directive. |
| `@layer components { .btn { … } }` for your own utilities | `@utility …` / `@layer components` (native CSS layer) | `@layer` in v4 is a standard CSS cascade layer, not a pseudo-directive. |
| JS plugin `addVariant('hocus', …)` | `@custom-variant hocus (&:hover, &:focus);` | Custom variants go in CSS. The form with a body and `@slot` is also available. |
| `@screen md { … }` (apply a breakpoint inside CSS) | `@variant md { @apply …; }` — or the codemod's `@media (width >= theme(--breakpoint-md)) { … }` | **`@screen` is removed in v4.** It is not an error: the compiler passes it through unrecognized and the wrapped rules are **silently dropped**. Inside a component class / `@apply` block use `@variant <bp> { … }` (it expands to `@media (width >= 48rem) { … }` and accepts `@apply`); the official upgrade codemod emits the plain `@media (... theme(--breakpoint-*))` form. |
| `theme.extend.colors.brand` in JS | `@theme { --color-brand: …; }` | A theme token → automatically the utilities `bg-brand`, `text-brand`, `ring-brand`. |
| a static spacing scale in the config | a single token `--spacing: 0.25rem` | The entire numeric scale (`p-4`, `mt-2`) is computed dynamically as `calc(var(--spacing) * N)`. |
| `safelist: [...]` in the JS config | `@source inline("…")` | The class safelist goes in CSS, with brace-expansion. |
| `content: [...]` in the JS config | auto-detection (respects `.gitignore`) + `@source "…"` | Sources are found automatically; `@source` adds non-standard paths, `@source not "…"` excludes them. |

## Color, opacity, gradients

| v3 (before) | v4 (after) | Note |
| --- | --- | --- |
| `bg-opacity-50`, `text-opacity-75` | `bg-black/50`, `text-foreground/75` | The `*-opacity-*` utilities are removed. Use the slash modifier everywhere. |
| `border-opacity-*`, `placeholder-opacity-*`, `ring-opacity-*` | the slash on the class itself: `border-border/50`, `ring-ring/30` | The same rule for all "opacity" families. |
| `bg-gradient-to-r` | `bg-linear-to-r` | Renamed. Added `bg-conic-*`, `bg-radial-*`. |
| `bg-[#3b82f6]` (arbitrary hex as the norm) | a token in `@theme` → `bg-primary` | An arbitrary color is a rare exception, not the basis. |
| `bg-[--brand]` (arbitrary CSS variable) | `bg-(--brand)` | New syntax for arbitrary CSS variables: parentheses, not brackets. |
| border/ring without an explicit color was drawn gray (`gray-200`) | border/ring default to `currentColor` | Because of preflight `border: 0 solid`. The border color inherits `currentColor` — set it explicitly. |

## Renamed values (size suffixes have shifted)

| v3 (before) | v4 (after) | Note |
| --- | --- | --- |
| `shadow-sm` | `shadow-xs` | The old `-sm` became `-xs`. |
| `shadow` (default) | `shadow-sm` | The former default gained the `-sm` suffix. |
| `rounded-sm` | `rounded-xs` | The same shift logic. |
| `rounded` (default) | `rounded-sm` | — |
| `blur-sm` | `blur-xs` | — |
| `blur` (default) | `blur-sm` | — |
| `drop-shadow-sm` | `drop-shadow-xs` | The shadow family shifted as a whole. |
| `outline-none` | `outline-hidden` (visually remove) / `outline-none` (actually `outline-style: none`) | In v4 the semantics are split: `outline-hidden` keeps an accessible focus ring in forced-colors. |
| `ring` (3px by default) | `ring` = 1px | The default ring width is now 1px; for the old look — `ring-3`. |
| `transform-none` (reset) | `scale-none`, `rotate-none`, `translate-none` | The transform reset is split by axes/types. |

## Layout and utilities that changed behavior

| v3 (before) | v4 (after) | Note |
| --- | --- | --- |
| `space-x-*` / `divide-*` (old selectors) | the same classes, but the selector changed | If the layout "broke" — switch to `flex`/`grid` + `gap`. |
| variant stack right-to-left | variant stack **left-to-right** | `first:hover:` and `hover:first:` now read differently; the application order is the reverse of v3. |
| `hover:` always active | `hover:` only on devices that support hover | Wrapped in `@media (hover: hover)`. Override when needed. |
| manual CSS for enter animations | the `starting:` variant (`@starting-style`) | A CSS-only enter without JS: `starting:opacity-0 opacity-100 transition`. |
| viewport-only breakpoints for "component" adaptivity | `@container` + `@sm:/@md:` on children | Container queries are built in: adaptivity by the parent's width, not the viewport's. |
| `@media (min-width: …)` by hand | breakpoints in `rem`: `sm 40rem, md 48rem, lg 64rem, xl 80rem, 2xl 96rem` | Values in `rem`, not `px`. |

## Headings, forms, reset (preflight)

| v3 (before) | v4 (after) | Note |
| --- | --- | --- |
| `h1…h6` had inherited/partial browser styles | `h1…h6`: `font-size: inherit; font-weight: inherit` | Headings without sizes — set them with utilities/`@apply`. |
| `ul/ol` with a list marker | `list-style: none` by default | Markers are brought back explicitly. |
| `img` inline | `img, svg, video…`: `display: block; max-width: 100%; height: auto` | Media are block-level and responsive by default. |
| `border` drew a gray line | `border: 0 solid` → needs both width AND color | `border` without a width draws nothing; the color is `currentColor`. |

## `@apply` and CSS functions

| v3 (before) | v4 (after) | Note |
| --- | --- | --- |
| `@apply` worked "out of the box" in any `<style>` | in CSS modules / isolated `<style>` you need `@reference "…"` | Without `@reference` the theme is unavailable → an error about an unknown class. |
| `@apply` inside `@keyframes` (sometimes worked) | forbidden inside `@keyframes` | An explicit engine error. |
| `theme('colors.red.500')` in arbitrary values | the CSS function `--theme(--color-red-500)` | New functions: `--theme()`, `--alpha(color / pct)`, `--spacing(n)`. |
| `rgb(var(--x) / <alpha>)` by hand | `--alpha(var(--x) / 50%)` | A more convenient way to build the alpha variant of a token. |

## Class detection (a common migration gotcha)

| v3 (before) | v4 (after) | Note |
| --- | --- | --- |
| hoping the `content` glob would "reach" dynamic values | the scanner looks for **literal** substrings | `text-${color}-500`, `'bg-' + name` are NOT detected — the class won't be generated. |
| `safelist` in the JS config | `@source inline("bg-{red,green,blue}-500")` | Full class names in their entirety; map dynamics onto ready-made strings. |

---

### A "NEVER" memo for migration

- NEVER `@tailwind base/components/utilities` — only `@import "tailwindcss";`.
- NEVER `tailwind.config.js` without a real need for JS dynamics.
- NEVER `bg-opacity-*` / `text-opacity-*` — use the slash modifier.
- NEVER `@layer utilities { … }` for your own utilities — use `@utility …`.
- NEVER `@screen md { @apply … }` (v3, removed in v4 → silently dropped) — use `@variant md { @apply … }` (or `@media (width >= theme(--breakpoint-md)) { … }`).
- NEVER `bg-gradient-to-*` — use `bg-linear-to-*`.
- NEVER `postcss-import` / `autoprefixer` with v4 — they are built in.
- NEVER `shadow-sm` to mean "the smallest shadow" — that's now `shadow-xs`.
- NEVER `bg-[--var]` — write `bg-(--var)`.
- NEVER confuse `@import "tailwindcss" important;` (global) with the suffix `bg-red-500!` (on the class).
