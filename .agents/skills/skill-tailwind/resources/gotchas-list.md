# Gotchas list — Tailwind v4 gotchas (quick glance)

A single scannable list of subtle v4 gotchas — one line per item. For depth, see `docs/`,
`references/`.

## Setup and config

- The entry point is `@import "tailwindcss";`, not `@tailwind base/components/utilities`.
- Global important is `@import "tailwindcss" important;`; this is NOT the same as the class suffix `bg-red-500!`.
- The important suffix goes at the END of the class: `bg-red-500!` (not `!bg-red-500`).
- A prefix is set as `@import "tailwindcss" prefix(tw);`, and classes are written `tw:bg-red-500`.
- A JS config is loaded only via `@config "…"`; a typical project does not need it.
- The PostCSS plugin is now `@tailwindcss/postcss`; `postcss-import` and `autoprefixer` are built in — do not add them.
- The CLI is moved out to `@tailwindcss/cli`; for bundlers the `@tailwindcss/vite` plugin is recommended — EXCEPT for component-framework scoped styles in a preprocessor (`<style lang="scss">`).
- `@tailwindcss/vite` only transforms ids ending in `.css` (or `&lang.css`); a preprocessed scoped style (id with `&lang.scss`) is skipped silently — `@apply`/`@reference` ship raw with NO error. For Approach B in such files use `@tailwindcss/postcss` (it runs after the preprocessor).

## `@theme` and tokens

- `@theme` is for tokens that MUST generate utilities/variants; for "regular" CSS variables use `:root`.
- `@theme` variables must be top-level — do not nest them under selectors or media queries.
- The `@theme` body accepts only `--custom-properties` and `@keyframes`; anything else is an error.
- `@theme inline` substitutes the value DIRECTLY into utilities (no `var(…)`, cannot be overridden at runtime).
- `@theme reference` registers a token but does NOT emit a CSS variable into `:root`.
- To reset a default namespace use `--color-*: initial;` (a full replacement of the scale instead of extending it).
- The spacing scale is computed from a single `--spacing` (`calc(var(--spacing) * N)`), not stored as a list.
- Breakpoints are in `rem`, not `px`: `sm 40rem, md 48rem, lg 64rem, xl 80rem, 2xl 96rem`.

## Color, border, ring

- The default border and ring color is `currentColor` (not `gray-200`); set the color explicitly.
- The default ring width is 1px (in v3 it was 3px); for the previous look use `ring-3`.
- Opacity is only the slash modifier (`bg-primary/90`); `bg-opacity-*` and similar are removed.
- `border` without a width draws nothing: preflight sets `border: 0 solid` — you need both a width and a color.
- Default colors are in `oklch`, not hex/rgb.

## Utilities, variants, syntax

- Custom utilities are `@utility name { … }`, not `@layer utilities`/`@layer components`.
- Custom variants are `@custom-variant` / `@variant` (the form with `@slot` for the body), not JS plugins.
- The variant stack is applied LEFT-TO-RIGHT (reversed from v3); order affects the result.
- `@screen md { … }` is REMOVED in v4 — the engine passes it through unrecognized and the wrapped rules are silently dropped; use `@variant md { @apply … }` (or `@media (width >= theme(--breakpoint-md)) { … }`).
- An arbitrary CSS variable is `bg-(--brand)`, not `bg-[--brand]`.
- Reset a SINGLE transform axis with `scale-none`/`rotate-none`/`translate-none`; `transform-none` still exists and clears the whole transform at once.
- `hover:` applies only on devices that support hover (`@media (hover: hover)`); override it when needed.
- Gradients are `bg-linear-to-r` (plus `bg-conic-*`, `bg-radial-*`), not `bg-gradient-to-*`.
- Value renames: `shadow-sm→shadow-xs`, `shadow→shadow-sm`, `rounded-sm→rounded-xs`, `blur-sm→blur-xs`.
- Enter animations without JS — the `starting:` variant (`@starting-style`).
- Component-level responsiveness — `@container` on the parent + `@sm:/@md:` on children (by parent width, not viewport).

## `@apply`

- In CSS modules and isolated `<style>` blocks you need `@reference "…"`, otherwise the theme is unavailable.
- `@apply` works with variants (`@apply hover:underline` is valid).
- `@apply` is forbidden inside `@keyframes`.
- You cannot mix CSS mixins (a dashed ident) and utilities in a single `@apply`.
- Circular dependencies between `@apply`/`@utility` produce a "Circular dependency detected" error.

## Class detection (scanner)

- The scanner looks for LITERAL class substrings — dynamics break: `text-${color}-500`, `'bg-'+name` are not found.
- The cure for dynamics is full class names in one piece; a safelist via `@source inline("…")`.
- Auto-detection of sources respects `.gitignore` and excludes `node_modules`, `.git`, binaries.
- Add non-standard paths with `@source "…"`; exclude with `@source not "…"`; paths are always in quotes.

## Preflight (reset)

- `h1…h6` are reset to `font-size: inherit; font-weight: inherit` — headings with no sizes.
- `ul/ol/menu` come with `list-style: none` — bring back markers explicitly.
- `img, svg, video…` become `display: block` with `max-width: 100%; height: auto`.
- Forms (`button/input/select/textarea`) inherit font/color, the background is transparent, `border-radius: 0`.

## Environment compatibility

- Modern browsers only: Safari 16.4+, Chrome 111+, Firefox 128+.
- `space-*`/`divide-*` changed their selectors; if the layout "drifted", switch to `flex`/`grid` + `gap`.
