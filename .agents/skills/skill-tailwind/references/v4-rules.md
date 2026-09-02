# v4-rules — reference of v3 → v4 rules (Wrong → Correct → Why)

> Purpose: systematically fix v3 habits that the model reproduces out of inertia.
> Each rule is a triple: **Wrong (what the model does) → Correct → Why**.
> The source of truth for behavior is the official Tailwind v4 documentation. Reference version: 4.x.
>
> The skill is the **CSS implementation layer**. Token values in the examples are placeholders; only the
> **names** are stable. The v3 syntax below is shown solely as "before/anti-pattern".
>
> All examples are framework-agnostic: plain HTML + CSS/SCSS. The semantic tokens are canonical
> (`bg-background`, `text-foreground`, `bg-primary`, `border-border`, `rounded-md`, …); their full
> set is in `templates/theme.css`.

---

## 1. Entry point: `@tailwind` directives → `@import "tailwindcss"`

**Wrong (what the model does):**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Correct:**

```css
@import "tailwindcss";
```

**Why:** In v4, `@tailwind base/components/utilities` are removed entirely. The entry point is a
plain CSS `@import`. It expands into the cascade layers `theme → base → utilities`
(plus the reserved `components`): the layer order defines the cascade. It is a single entry file,
not three directives.

---

## 2. Config: `tailwind.config.js` → `@theme` (CSS-first)

**Wrong (what the model does):**

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: { primary: "#2563eb" },
      borderRadius: { md: "0.375rem" },
    },
  },
};
```

**Correct:**

```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(52% 0.12 255);          /* value is a placeholder */
  --color-primary-foreground: oklch(99% 0 0);
  --radius-md: 0.375rem;
}
```

**Why:** In v4 the config lives in CSS via `@theme`. The theme is CSS custom properties in
namespaces (`--color-*`, `--radius-*`, `--spacing`, `--font-*`, …), not a JS object. A token
name in `@theme` automatically generates utilities and variants: `--color-primary` →
`bg-primary` / `text-primary` / `border-primary` / `ring-primary` and slash opacity
`bg-primary/90`. `tailwind.config.js` is not needed for most projects.

> Subtlety: `@theme` accepts **only** `--custom-properties` (and `@keyframes`). Variables
> must be **top-level** — do not nest them under a selector/`@media`. If a variable should not
> generate Tailwind utilities (a regular CSS variable), put it in `:root`, not in
> `@theme`. If the project has a design system / ready-made tokens — **map** them into `@theme`,
> do not redefine them.

---

## 3. JS config with dynamics: `tailwind.config.js` (silently) → `@config "..."`

**Wrong (what the model does):** silently relies on auto-loading of `tailwind.config.js`,
as in v3.

```js
// tailwind.config.js — in v4 it is NOT picked up on its own
module.exports = { theme: { extend: { /* ... */ } } };
```

**Correct:** if a JS config really is needed (dynamics, JS plugins), include it explicitly:

```css
@import "tailwindcss";
@config "../tailwind.config.js";
@plugin "@tailwindcss/typography";
```

**Why:** In v4 there is no auto-loading of `tailwind.config.js`. The JS config is a compatibility
layer, included via the `@config "..."` directive, and plugins via `@plugin "..."`. It is a
fallback path for dynamics; the primary way is CSS-first `@theme`.

---

## 4. PostCSS: `tailwindcss` + `postcss-import` + `autoprefixer` → `@tailwindcss/postcss`

**Wrong (what the model does):**

```js
// postcss.config.mjs
export default {
  plugins: {
    "postcss-import": {},
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Correct:**

```js
// postcss.config.mjs
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

**Why:** The plugin moved to a separate package `@tailwindcss/postcss` (the `tailwindcss` package
is no longer a PostCSS plugin). `postcss-import` and `autoprefixer` are built in and are no longer
needed — adding them manually is redundant and harmful. (If the build is not on PostCSS — for the CLI use the
`@tailwindcss/cli` package.)

---

## 5. Opacity: `bg-opacity-*` / `text-opacity-*` → slash modifier

**Wrong (what the model does):**

```html
<div class="bg-primary bg-opacity-50">
  <span class="text-foreground text-opacity-75"></span>
</div>
```

**Correct:**

```html
<div class="bg-primary/50">
  <span class="text-foreground/75"></span>
</div>
```

**Why:** The utilities `bg-opacity-*`, `text-opacity-*`, `border-opacity-*`,
`placeholder-opacity-*`, `ring-opacity-*` are removed. Opacity is set with a slash modifier
directly on the color utility: `bg-primary/50`, `text-foreground/75`, `border-border/60`.
It also works with arbitrary values (`bg-primary/[0.55]`).

---

## 6. Arbitrary color: `bg-[#hex]` → token in `@theme`

**Wrong (what the model does):**

```html
<div class="bg-[#2563eb] text-[#ffffff] border-[#e5e7eb]"></div>
```

**Correct:**

```css
@theme {
  --color-primary: oklch(52% 0.12 255);
  --color-primary-foreground: oklch(99% 0 0);
  --color-border: oklch(92% 0.004 255);
}
```

```html
<div class="bg-primary text-primary-foreground border border-border"></div>
```

**Why:** Hardcoding `bg-[#hex]` scatters the design system across the markup: the value is not
reused, not themeable, does not reach dark mode. Define the color once with a
semantic token in `@theme` — and you get utilities, slash opacity, and a single dark override.
Arbitrary values are acceptable as a deliberate exception (a one-off case meaningless to the
system), not as a way to set a brand color.

> If the value comes from a runtime variable — use a CSS variable inside the arbitrary
> value (see rule 14), not a hardcoded hex.

---

## 7. Custom utilities: `@layer utilities` → `@utility`

**Wrong (what the model does):**

```css
@layer utilities {
  .content-auto {
    content-visibility: auto;
  }
}
```

**Correct:**

```css
@utility content-auto {
  content-visibility: auto;
}
```

**Why:** In v4 custom utilities are declared with the `@utility` directive — then the engine sorts
them correctly in the cascade and supports variants (`hover:content-auto`). `@layer utilities`
is no longer used for your own utilities. A functional (value-taking) utility must
end with `-*`:

```css
@utility tab-* {
  tab-size: --value(integer);
}
```

> Do not confuse this with `@layer components`: for class components in the BEM + @apply approach the
> `@layer components` layer is appropriate; for single utilities — `@utility`.

---

## 8. Gradients: `bg-gradient-to-*` → `bg-linear-to-*`

**Wrong (what the model does):**

```html
<div class="bg-gradient-to-r from-muted to-background"></div>
```

**Correct:**

```html
<div class="bg-linear-to-r from-muted to-background"></div>
```

**Why:** `bg-gradient-to-*` was renamed to `bg-linear-to-*`. Other types also appeared:
`bg-radial-*`, `bg-conic-*`, as well as interpolation in color spaces
(`bg-linear-to-r/oklch`). The old name `bg-gradient-*` does not work in v4.

> Design note: neutral token gradients (`from-muted to-background`) are fine; we avoid loud
> "purple-blue" gradients in the examples.

---

## 9. Container queries: viewport breakpoints → `@container` + `@md:`

**Wrong (what the model does):** the component is adapted only by viewport width, even
when it should react to the width of its **parent** (in a sidebar, in a grid, in a modal).

```html
<div class="flex flex-col md:flex-row"></div>
```

**Correct:**

```html
<div class="@container">
  <div class="flex flex-col @md:flex-row">
    <!-- reacts to the container width, not the viewport -->
  </div>
</div>
```

**Why:** In v4 container queries are built in without a plugin. On the parent — `@container`, on
the children — `@sm:` / `@md:` / `@lg:`. This is exactly component-level responsiveness: one component
behaves correctly in any container. You can name containers
(`@container/sidebar` → `@md/sidebar:`) and set arbitrary thresholds (`@min-[30rem]:`).
Viewport breakpoints (`md:`) remain for page layout — both mechanisms coexist.

---

## 10. Negative state: duplicating classes → the `not-*` variant

**Wrong (what the model does):** there is no way to target the "NOT state", so it
spawns manual wrappers or repeats.

```html
<div class="opacity-100 hover:opacity-100"></div>
```

**Correct:**

```html
<button class="opacity-100 not-hover:opacity-75 transition-opacity"></button>
```

**Why:** v4 added the `not-*` variant — styling elements that do **not** satisfy
a condition: `not-hover:`, `not-focus:`, `not-disabled:`, `not-first:`. Under the hood — `:not(...)`.
It combines with media/feature variants (`not-supports-[...]:`).

---

## 11. Enter animations: JS classes `.open` → `starting:` (`@starting-style`)

**Wrong (what the model does):**

```css
.modal {
  opacity: 0;
  transition: opacity 0.3s;
}
.modal.is-open {
  opacity: 1;
}
```

**Correct:**

```html
<div
  class="opacity-100 transition-opacity duration-300 starting:opacity-0"
></div>
```

**Why:** v4 supports CSS `@starting-style` through the `starting:` variant — it sets property
values at the moment the element **appears** in the DOM (including `display:none → block` and `popover`/
`<dialog>`). An enter animation without JS toggle classes. Used with `transition-*` and
a pair "initial (`starting:`) → final" values.

---

## 12. Scale renames: `shadow/blur/rounded -sm` → `-xs` (shift by one step)

**Wrong (what the model does):** uses v3 names, thinking that `-sm` = "the
smallest".

```html
<div class="shadow-sm rounded-sm blur-sm"></div>
```

**Correct:**

```html
<div class="shadow-xs rounded-xs blur-xs"></div>
```

**Why:** In v4 the scale shifted by one step — the "bare" name became `-sm`, and the former `-sm` became
`-xs`. Rename map:

| v3 (Wrong now) | v4 (Correct) |
| --- | --- |
| `shadow-sm` | `shadow-xs` |
| `shadow`    | `shadow-sm` |
| `blur-sm`   | `blur-xs`   |
| `blur`      | `blur-sm`   |
| `rounded-sm`| `rounded-xs`|
| `rounded`   | `rounded-sm`|
| `drop-shadow-sm` | `drop-shadow-xs` |
| `drop-shadow`    | `drop-shadow-sm` |

That is, `shadow-sm`/`rounded-sm` in v4 are **valid, but mean something else** (one step larger) — this is
more dangerous than an obvious error: the appearance changes silently. In the skill's semantics we use the radius tokens
`rounded-sm/md/lg/xl` (`--radius-*`) — the names are stable, the values are placeholders.

> Distinguish two different things: this rule is about the v3 → v4 **rename** (the same class name now points one
> step up the scale). Separately, **overriding** a built-in scale token in `@theme` (e.g. redefining `--radius-md`
> or `--shadow-*`) silently reinterprets **every** `rounded-*`/`shadow-*` utility globally — a deliberate
> site-wide decision. If you only need one extra size, add a **new** named token (`--radius-blocky` → `rounded-blocky`)
> instead of shrinking the standard steps.

---

## 13. Important — config → import, and the DISAMBIGUATION of the two "important"s

These are **two different things** that the model confuses.

### 13a. Global important: `config.important` → `@import "tailwindcss" important;`

**Wrong (what the model does):**

```js
// tailwind.config.js
module.exports = { important: true };
```

**Correct:**

```css
@import "tailwindcss" important;
```

**Why:** The `important` option moved from the JS config to the CSS import. `@import "tailwindcss"
important;` marks **all** Tailwind utilities as `!important` globally — this is the "nuclear" option
for fighting third-party styles. Use rarely.

### 13b. Targeted important: the class suffix `bg-danger!`

**Wrong (what the model does):** drags in the v3 prefix `!bg-danger`.

```html
<div class="!bg-danger"></div>     <!-- v3: prefix -->
```

**Correct:**

```html
<div class="bg-danger!"></div>     <!-- v4: suffix -->
```

**Why:** Targeted important in v4 is a **suffix** `!` at the end of the class name (not a prefix, as
in v3): `bg-danger!`, `mt-0!`, `hover:underline!`.

### Disambiguation (do not mix)

| What | Syntax | Scope |
| --- | --- | --- |
| Global important on all utilities | `@import "tailwindcss" important;` (in the CSS entry) | the whole project |
| Targeted important on one utility | suffix `!` on the class: `bg-danger!` | one class on one element |

`@import "tailwindcss" important;` ≠ `bg-danger!`. The first is a global flag for the entire utilities layer;
the second is local on a specific class. Do not confuse them with each other, nor with the v3 prefix
`!class`.

> Do not confuse `important` and `prefix`: the prefix is `@import "tailwindcss" prefix(tw);`, after
> which classes are written as `tw:bg-primary`. Different directives — different effects.

---

## Additional v4 rules (gotchas that break the build or the appearance)

### 14. CSS variable in an arbitrary value: `bg-[--var]` → `bg-(--var)`

**Wrong:**

```html
<div class="bg-[--brand] text-[--ink]"></div>
```

**Correct:**

```html
<div class="bg-(--brand) text-(--ink)"></div>
```

**Why:** To substitute a CSS variable into an arbitrary value the syntax is parentheses
`bg-(--brand)`. The form `bg-[--brand]` is interpreted differently in v4 and does not give the expected
result. A fallback is allowed: `bg-(--brand,var(--color-muted))`. This is the correct path for **runtime**
values (instead of a hardcoded hex from rule 6).

### 15. `@apply` in `<style>`/CSS modules requires `@reference`

**Wrong:**

```css
/* a separate module / scoped block — the theme is unavailable, the build fails */
.cardList-item { @apply rounded-md bg-card; }
```

**Correct:**

```css
@reference "../app.css";   /* path to the entry file with @import "tailwindcss" */
.cardList-item { @apply rounded-md bg-card; }
```

**Why:** In separate CSS modules and component `<style>` blocks the theme and utilities are "not visible"
by default. `@reference "..."` brings in the theme context **without** duplicating the CSS output.
Without it, `@apply` to tokens/utilities fails with an unknown-class error. This is the key
gotcha of the BEM + @apply approach, when styles live in isolated modules.

### 16. `border`/`ring` default to `currentColor`, ring width = 1px

**Wrong (the model expects v3 defaults):**

```html
<div class="border"></div>     <!-- expects a gray-200 border (v3) -->
<button class="ring"></button> <!-- expects a 3px blue ring (v3) -->
```

**Correct:**

```html
<div class="border border-border"></div>          <!-- set the color explicitly -->
<button class="ring-2 ring-ring outline-ring"></button>
```

**Why:** In v4 the default border and ring color is `currentColor` (not `gray-200`/`blue`
from v3), and the default `ring` width is **1px** (was 3px). So always set the color
explicitly (`border-border`, `ring-ring`) and the width when needed (`ring-2`). A "bare" `border`
is drawn in the current text color, not in a neutral gray.

### 17. Class detection is literal: dynamic names are not found

**Wrong:**

```html
<!-- the class is assembled by concatenation → the scanner does not see a literal → no CSS is generated -->
<div class="text-{{ color }}-500 bg-{{ tone }}"></div>
```

**Correct:**

```html
<!-- full class literals; the choice is made via ready-made strings -->
<div class="text-danger"></div>     <!-- a variant = a whole class -->
```

```css
/* if the dynamics cannot be removed — a targeted safelist: */
@source inline("text-danger text-success text-warning");
```

**Why:** The class scanner looks for **literal** substrings in the sources, it does not execute code.
Concatenation (`text-${color}-500`, `bg-` + variable) never yields a full literal — the class
is not extracted, no CSS appears. The fix: write full class names in full (map
variants to whole strings) or force-safelist via `@source inline("...")`
(supports brace-expansion). `@source "..."` is for non-standard scanning paths,
`@source not "..."` is for exclusions.

### 18. The variant stack is applied left-to-right

**Wrong (v3 thinking, right-to-left):**

```html
<!-- expectation: "in dark mode on hover" in the order as in v3 -->
<div class="dark:hover:bg-muted"></div>
```

**Correct (understand the left-to-right reading order):**

```html
<div class="dark:hover:bg-muted"></div>
<!-- reads: dark -> then hover; the stack is applied in the written order -->
```

**Why:** In v4 the variant stack is applied **left-to-right** (the reverse of v3). For most
combinations the result is the same, but in order-sensitive cases (nested `group-*`/`peer-*`,
`*`/`**`, arbitrary selectors) the written order determines the resulting selector. Write variants
in logical reading order.

### 19. Resetting ONE transform axis: `transform-none` (wipes all) → `scale-none`/`rotate-none`/`translate-none`

**Wrong:**

```html
<div class="rotate-3 hover:transform-none"></div>   <!-- v3 habit: nukes the WHOLE transform to drop one axis -->
```

**Correct:**

```html
<div class="rotate-3 hover:rotate-none"></div>      <!-- clears only the rotation, keeps scale/translate -->
```

**Why:** In v4 transforms are composed from separate variables (`--tw-rotate`, `--tw-scale-*`, `--tw-translate-*`).
`transform-none` still exists and outputs `transform: none`, resetting the **whole** composed transform at once — use it
when that is what you want. To clear a **single** axis without wiping its neighbors, use the targeted resets
`scale-none` / `rotate-none` / `translate-none`.

### 20. `space-*` / `divide-*` changed their selector — when the layout breaks, use `gap`

**Wrong (blind v3 port):**

```html
<div class="space-y-4"><!-- complex nesting breaks --></div>
```

**Correct:**

```html
<div class="flex flex-col gap-4"><!-- reliable --></div>
```

**Why:** The internal selector of `space-*`/`divide-*` changed in v4; on non-trivial markup
(wrappers, fragments, changed order) the spacing can "drift". Where possible, use
flex/grid + `gap` — it is more robust and matches the "layout" group in the `@apply` order.
`space-*` remains acceptable for simple flat lists.

---

## `@apply` grouping order (for Approach B — BEM + @apply)

When declarations are assembled via `@apply` in SCSS, we group them by meaning (following the engine's
canonical property order) — one `@apply` line per group in the fixed order, **without** per-group label
comments (the line order alone conveys the grouping):

```scss
@reference "../app.css";

.cardList-item {
  @apply relative flex flex-col gap-2;
  @apply w-full max-w-sm;
  @apply p-4;
  @apply bg-card border border-border rounded-md shadow-xs;
  @apply text-card-foreground text-sm leading-normal;
  @apply transition-shadow duration-150 ease-out;
  @apply cursor-pointer select-none;

  &:hover            { @apply shadow-sm; }
  &:focus-visible    { @apply outline-ring; }
  &_active           { @apply border-primary; }   /* element modifier */
}
```

Group order: **1)** layout/position → **2)** size → **3)** spacing →
**4)** background/borders/shape → **5)** typography → **6)** effects/motion →
**7)** interaction; then nested states (`&:hover`, `&:focus-visible`, `&:active`,
`&:disabled`) and modifiers (`&_active`). Default BEM: block `cardList`, element
`cardList-item` (element via `-`), element modifier `cardList-item_active` (modifier via `_`),
multi-word parts camelCase lowercase-first. This is the default; if the project already declares
another scheme, follow that instead — consistency wins.

---

## NEVER (v4 list of prohibitions)

- NEVER use `@tailwind base/components/utilities` — only `@import "tailwindcss"`.
- NEVER create a `tailwind.config.js` unless you specifically need JS dynamics; the config is `@theme`
  in CSS. If a JS config is still needed — include it explicitly via `@config "..."`.
- NEVER add `postcss-import` or `autoprefixer` alongside v4 — they are built in; the plugin is
  `@tailwindcss/postcss`, not `tailwindcss`.
- NEVER use `bg-opacity-*`, `text-opacity-*`, `border-opacity-*` — only the
  slash modifier (`bg-primary/50`).
- NEVER hardcode a brand color via `bg-[#hex]` — define a semantic token in `@theme`.
- NEVER wrap custom utilities in `@layer utilities` — use `@utility`.
- NEVER use `@screen md { @apply … }` — `@screen` was removed in v4. The compiler passes it through
  unrecognized and the wrapped rules are **silently dropped** (no error, no styles). To apply a breakpoint
  inside CSS in Approach B use `@variant md { @apply … }` (it compiles to
  `@media (width >= theme(--breakpoint-md)) { … }`), or write that `@media (width >= theme(--breakpoint-*))`
  form directly.
- NEVER use `bg-gradient-to-*` — only `bg-linear-to-*` (and `bg-radial-*`/`bg-conic-*`).
- NEVER write `bg-[--var]` for a CSS variable — the syntax is `bg-(--var)`.
- NEVER apply `@apply` to tokens in `<style>`/a CSS module without `@reference "..."`.
- NEVER rely on the v3 defaults for borders/rings: the color is `currentColor`, the `ring` width is 1px;
  set `border-border` and `ring-ring`/the width explicitly.
- NEVER assemble class names by concatenation (`text-${c}-500`) — the literal scanner does not
  see them; use full strings or `@source inline(...)`.
- NEVER confuse `shadow-sm`/`rounded-sm` with "the smallest" — now they are one step larger;
  the smallest is `-xs`.
- NEVER confuse the two importants: the global `@import "tailwindcss" important;` ≠ the class suffix
  `bg-danger!`; and both ≠ the v3 prefix `!class`.
- NEVER use the v3 important prefix `!bg-x` — in v4 it is the suffix `bg-x!`.
- NEVER confuse `important` and `prefix`: the prefix is `@import "tailwindcss" prefix(tw);` → `tw:bg-x`.
- NEVER use `transform-none` to reset — `scale-none`/`rotate-none`/`translate-none`.
