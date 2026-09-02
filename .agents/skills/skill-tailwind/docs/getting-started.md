<!-- getting-started.md — "first 5 minutes" quick start for Tailwind CSS v4 (CSS-first):
     wire up the core, set up tokens, write the first component in both approaches, choose an approach. -->

# Quick start: the first 5 minutes (Tailwind v4)

> A minimal, framework-agnostic path from zero to a working component on **Tailwind CSS v4
> (CSS-first)** — plain HTML + CSS/SCSS, no JS framework. Five steps: wire up the core → set up
> tokens → render the component in Approach **A** (utilities) → the same component in Approach **B**
> (BEM + `@apply`) → choose what to use when. Anything deeper is in the links at the bottom.
>
> Token values everywhere are **placeholders for the project's design system**; only the **names** are
> stable. If the project already has a design system / `DESIGN.md` / ready-made tokens — we don't
> override them, we **map** them in `@theme` (see step 2 and `references/tokens.md` §5).

---

## Step 1 · Wire up Tailwind v4 — `@import "tailwindcss"`

In v4 the config is **CSS, not JS**. The entry point is a single line `@import "tailwindcss";` (it
expands into the cascade layers `theme → base → utilities`, plus the reserved `components`). The v3 anti-pattern
`@tailwind base/components/utilities;` is **dead**.

The canonical skeleton is two files: `entry.css` (the build entry point) and `theme.css` (tokens).

**`entry.css`** — the single entry point you wire into the build (PostCSS / Lightning CSS
/ `@tailwindcss` CLI):

```css
/* entry.css — the single entry point for the project's styles */
@import "tailwindcss";   /* core: expands the layers theme → base → utilities */
@import "./theme.css";   /* project tokens and dark overrides (see step 2) */

/* below the imports — as needed:
   @custom-variant hocus (&:hover, &:focus);
   @utility content-grid { display: grid; }
   @source inline("bg-primary bg-danger");   // safelist for dynamically built names */
```

Order matters (this is the ordinary CSS cascade): **first** the core, **then** the tokens, **then**
your custom variants/utilities/safelist. The fully commented template is `templates/entry.css`; the
mental model of "what `@import` expands into" is in `docs/css-first-config.md` §2.

> **NEVER** `@tailwind base/components/utilities;` — only `@import "tailwindcss";`.
> **NEVER** set up `tailwind.config.js` without real JS dynamics — tokens live in `@theme` (step 2).
> A JS config is loaded **only** by an explicit `@config "..."` directive; there is no auto-pickup.

---

## Step 2 · Set up tokens via `@theme`

`@theme` declares design tokens **as CSS variables**. The token name = the utility name: by declaring
`--color-primary` you get `bg-primary`, `text-primary`, `border-primary`,
`ring-primary` and slash-opacity `bg-primary/90` for free. We keep the names **canonical and
semantic** — all of the skill's examples rely on them.

**`theme.css`** — the minimally sufficient slice (the full canon is `templates/theme.css`):

```css
@import "tailwindcss";

/* class-based dark mode: declare the dark variant (instead of v3 darkMode: "class") */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* values are PLACEHOLDERS for the design system; the NAMES are stable. Colors are oklch. */
  --color-background: oklch(99% 0 0);
  --color-foreground: oklch(21% 0.01 255);

  --color-muted: oklch(96% 0.004 255);
  --color-muted-foreground: oklch(52% 0.01 255);

  --color-card: oklch(100% 0 0);
  --color-card-foreground: oklch(21% 0.01 255);

  --color-border: oklch(92% 0.004 255);
  --color-input: oklch(92% 0.004 255);
  --color-ring: oklch(62% 0.02 255);

  --color-primary: oklch(52% 0.12 255);
  --color-primary-foreground: oklch(99% 0 0);

  --color-danger: oklch(58% 0.18 27);
  --color-danger-foreground: oklch(99% 0 0);

  /* Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
}

/* dark mode — THE SAME names, different values; the markup does not change */
.dark {
  --color-background: oklch(18% 0.01 255);
  --color-foreground: oklch(96% 0.004 255);
  --color-card: oklch(21% 0.01 255);
  --color-card-foreground: oklch(96% 0.004 255);
  --color-border: oklch(30% 0.01 255);
  --color-primary: oklch(70% 0.12 255);
  --color-primary-foreground: oklch(18% 0.01 255);
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

Things to remember about tokens:

- **The `*-foreground` pair.** Every surface (`bg-card`) comes with the text color on top of it
  (`text-card-foreground`) — contrast is "baked into" the theme through any swap of values.
- **Translucency is a slash modifier**, not a separate token: `bg-primary/90`, `bg-foreground/50`.
  **NEVER** `bg-opacity-*` and **NEVER** `--color-primary-90`.
- **Dark mode** is the same names with different values inside `.dark`; the same `bg-card` picks up
  a different value by context. These are two independent steps: `@custom-variant dark` (the variant) and
  `.dark { ... }` (the values).
- **Already have a design system?** Don't hardcode — **map**: `--color-primary: var(--ds-action);`.
  Full breakdown — `references/tokens.md` §5.

The canonical set of names is in `templates/theme.css` and `resources/tokens-table.md`; the concept is in
`docs/design-tokens.md`.

---

## Step 3 · The first component — Approach A (utilities in the markup)

Approach A: the style is composed from ready-made classes **right in the HTML** (co-location, a thin
bundle, no "stale" overrides). This is the starting point for everything.

A button with a **full set of states** — it is mandatory for interactive components:

```html
<button
  type="button"
  class="inline-flex items-center justify-center gap-2
         h-10 px-4
         rounded-md bg-primary text-primary-foreground
         text-sm font-medium
         transition-colors duration-150 motion-reduce:transition-none
         hover:bg-primary/90
         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
         active:bg-primary/80
         disabled:opacity-50 disabled:pointer-events-none
         cursor-pointer select-none">
  Continue
</button>
```

What matters here (these are the skill's requirements, not decorations):

- **Semantics** — the action goes on `<button type="button">`, not on a `<div>`.
- **Visible focus** via `focus-visible:` (not `focus:`) and `outline-ring` — we draw the ring with
  `outline`, so it doesn't shift the layout. **NEVER** `outline-none` without a replacement.
- **Full set of states** — `hover` / `focus-visible` / `active` / `disabled`.
- **Semantic tokens only** — `bg-primary`, `text-primary-foreground`, no brand colors
  and no arbitrary values.
- **Mobile-first.** Base classes = mobile; breakpoints **add** changes upward
  (`md:flex-row`). States are variant prefixes, read left to right (`dark:hover:`).

> Markup repeats? First climb to "rung 2" — extract the **markup** into a reusable
> fragment (partial / include / component) while staying fully utility-first. This eliminates the
> duplication without a CSS abstraction. The abstraction ladder and states — `references/approaches.md`, `docs/variants-and-states.md`.

---

## Step 4 · The same component — Approach B (BEM + `@apply`)

Approach B: the markup carries **semantic BEM classes**, while the look is assembled from utilities via `@apply` in
SCSS, **grouped by property types**. It's the same button, the same UI — a different way of organizing it.

Markup:

```html
<button type="button" class="button button_primary">Continue</button>
```

SCSS:

```scss
/* @reference is needed ONLY if this SCSS is compiled separately from the entry CSS
   (CSS module / scoped <style>): @reference "../entry.css"; otherwise @apply can't see the tokens.
   In a shared components.scss after @import "tailwindcss" this line is NOT needed. */

.button {
  @apply inline-flex items-center justify-center gap-2;
  @apply h-10;
  @apply px-4;
  @apply rounded-md border border-transparent;
  @apply text-sm font-medium;
  @apply transition-colors duration-150 motion-reduce:transition-none;
  @apply cursor-pointer select-none;

  &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
  &:disabled      { @apply opacity-50 pointer-events-none; }

  /* block modifier: tone/intent separate from the neutral base */
  &_primary {
    @apply bg-primary text-primary-foreground;
    &:hover  { @apply bg-primary/90; }   /* v4 slash-opacity */
    &:active { @apply bg-primary/80; }
  }
}
```

The skill's default BEM convention (multi-word parts in `camelCase`, lowercase first letter):

- block — `button`; block modifier — `button_primary` (underscore);
- element — `button-icon` (hyphen); element modifier — `button-icon_loading` (underscore);
- key-value modifier — `button_size_lg` (underscore).
- One block per component; elements always **from the block**, no `-a-b` chains.
- This convention is **configurable**: if a project already declares another scheme, follow it.
  The hard rules always hold — names stay programmatically separable, a modifier never appears
  alone (`button button_primary`, never `button_primary` by itself), and elements never nest.

Group `@apply` by property category, **one line per group**, in the fixed canonical order:
**layout → sizing → spacing → background/borders/shape → typography → effects → interaction**, then states,
then modifiers. Do **not** add per-group label comments — the line order itself conveys the grouping.
The order inside `@apply` does not affect the cascade (the engine re-sorts it) — it's a matter of
**readability**. The base stays **neutral** (layout, spacing, behavior), and color/intent is moved out into
modifiers. In detail — `resources/apply-grouping.md`, `templates/component.bem.scss`.

> **NEVER** hide a "soup" of dozens of utilities in a single class for the sake of "clean markup" — that's bad
> `@apply`. **NEVER** `@apply` inside `@keyframes` or in a `<style>`/CSS module without `@reference`.

---

## Step 5 · Which approach to choose

Both approaches are **equal** — the choice is driven by context, not by a hierarchy of value:

```
Markup third-party/generated (CMS, third-party widget, DOM rewritten by a script)?
├── Yes → B: you need a real CSS class, @apply adapts the utilities, you don't touch the markup.
└── No → Is one of the approaches already adopted in the repository?
    ├── Yes → follow the adopted one (consistency beats taste).
    └── No → Does the markup repeat and CANNOT be extracted into a partial/fragment?
        ├── Yes → B (BEM + @apply as a single source of style).
        └── No → Many states/variants, and is "readability at a glance" important?
            ├── Yes → B (BEM + @apply, grouped).
            └── No → A (utilities in the markup; repeated markup is solved by extracting a fragment).
```

- **A** — co-location, a thin bundle, no override-rot. Lives on rungs 1–3 of the abstraction ladder.
- **B** — readable markup, "clear at a glance", convenient with many states. A deliberate
  choice of rungs 4–6 (not a "failure" of the utility-first approach).

The tree, the abstraction ladder, and the "good/bad `@apply`" rule — `references/approaches.md`.

---

## Minimal "done" checklist

- [ ] Entry — `@import "tailwindcss";` (not `@tailwind ...`); no `tailwind.config.js` without JS dynamics.
- [ ] Tokens in `@theme` by **canonical** names; values are placeholders; `*-foreground` pairs.
- [ ] Translucency is a slash (`bg-primary/90`), not `bg-opacity-*`. Gradient — `bg-linear-to-r`.
- [ ] Interactive: `hover` / `focus-visible` / `active` / `disabled`; visible focus via `outline-ring`.
- [ ] Tag semantics; `<label for>` ↔ `<input id>`; for form validation — `user-invalid:` (not `invalid:`).
- [ ] Approach B: strict BEM; `@apply` grouped; `@reference` in isolated CSS.
- [ ] No AI-slop (purple-blue gradients, glass, excessive rounding, blobs).

---

## Where to go next

| Topic | File |
| --- | --- |
| CSS-first config (what `@import`, `@theme`, `@config` expand into) | `docs/css-first-config.md` |
| Design tokens (the semantic set, `.dark`, mapping a third-party system) | `references/tokens.md`, `docs/design-tokens.md` |
| The two approaches: abstraction ladder, decision tree, `@apply` grouping | `references/approaches.md`, `resources/apply-grouping.md` |
| Variants and states (`hover`/`focus-visible`/`active`/`disabled`, `not-*`, stack) | `docs/variants-and-states.md` |
| Dark mode (class-based `@custom-variant`, `.dark` overrides) | `docs/dark-mode.md` |
| Responsive and container queries (`@container`, `@md:`) | `docs/responsive-and-container-queries.md` |
| Migration v3 → v4 | `workflows/migrate-v3-to-v4.md`, `resources/v3-to-v4-cheatsheet.md` |
| Ready-made skeletons | `templates/entry.css`, `templates/theme.css`, `templates/component.bem.scss` |
| Components in both implementations (A + B) | `examples/` (`button`, `card`, `input-field`, …) |
