# Tailwind v4 review — reviewer reference

This file is a practical set of lists for reviewing and refactoring Tailwind code in a v4 project
(CSS-first). It answers the question "what exactly to look at in the diff", not "how it looks" —
the visual direction is set by the project's design layer, while the skill checks **the technical
correctness of the wiring in Tailwind**. Token names in the examples are the canonical semantic ones
(`bg-primary`, `border-border`, `text-muted-foreground`, …); values are design-system placeholders.

Related references: subtle engine gotchas — `references/gotchas.md`; choosing "utility vs BEM+@apply"
and the abstraction ladder — `references/approaches.md`; the canonical `@theme` — `templates/theme.css`.

---

## 1. Review checklist (go top to bottom)

Every item is a "yes/no" against the diff. "No" is a reason to leave a comment or request a change.

1. **v4 syntax, not v3.** Import via `@import "tailwindcss"` (not `@tailwind base/components/utilities`).
   Config is CSS-first in `@theme`; a JS config only via `@config "…"` and only for real dynamic needs.
   Custom utilities are `@utility name { … }` (not `@layer utilities`), variants are `@custom-variant`/`@variant`.
   No v3 forms: `bg-opacity-*` (→ slash `bg-primary/90`), `bg-gradient-to-r` (→ `bg-linear-to-r`),
   `shadow-sm`/`rounded-sm` in their old meaning (see renames: `shadow-sm→shadow-xs`,
   `shadow→shadow-sm`, `rounded-sm→rounded-xs`, `blur-sm→blur-xs`).
2. **All classes are detected.** Every class is present in the source as a **full literal**. No names
   assembled via concatenation/interpolation (`text-{tone}-foreground`, `'bg-' + color`). If a class comes
   from data/CMS — it is mapped to full strings, and the `@source inline(...)` safelist is used as a last
   resort, not by default. See `gotchas.md` §9.
3. **No dynamic class names.** Confirmation of item 2 from the code-generator side: a value →
   a ready class string, not a template. Partial literals (`hover:`, `text-`) don't create classes.
4. **Third-party / CMS / generated DOM is scoped, not styled globally.** Uncontrolled markup
   (rich text, widgets, CMS output) is wrapped in a scope (a `.richText` wrapper or the Typography plugin), not
   patched globally on `h1/p/ul/table` across the whole project. If JS swaps the DOM (`<i>`→`<svg>`, injects wrappers)
   — the selectors must hit the **final** DOM, not the placeholder.
5. **Promote on repeat — tokens, and `@utility` for repeated patterns.** A repeating `[#hex]`, `[1.5rem]`,
   `[0_2px_8px_…]` is a candidate for a `@theme` token or a `@utility`. A one-off exception in arbitrary is acceptable;
   accumulated repetition is not. System-level colors/radii/shadows/spacing — via semantic names, not literals.
   Promotion is **not** limited to arbitrary values: a focus-ring / transition / state pattern built from **plain
   utilities** (e.g. `outline-2 outline-offset-2 outline-ring`, or a shared `transition-colors duration-150`) that
   repeats on 3+ interactive elements is a custom-`@utility` candidate too.
6. **The external design system is mapped, not redefined.** If the project has a design system/`DESIGN.md`/
   ready tokens — their values are **propagated into `@theme`** (names stay stable), not invented from scratch. The skill
   is responsible for the wiring, the design for the values (see §3, layer audit).
7. **Correct `@apply` grouping (for approach B).** Declarations are grouped by property category in the canonical
   property-order: layout → sizing → spacing → background/borders/shape → typography → effects/motion →
   interaction, then states and modifiers. One `@apply` line per group, and the groups appear in that canonical
   order — the line order conveys the grouping, so do **not** add per-group label comments. No nested `@apply`
   and no "dump" of all utilities into one line. Details — §2 and §4.
8. **BEM convention is followed (for approach B).** Default scheme: element via `-` (`cardList-item`), modifier
   via `_` (`cardList_compact`, `cardList-item_active`, key-value `cardList_size_lg`), multi-word parts camelCase
   lowercase-first. This is the **default** — if the project already declares another scheme (classic
   `block__elem_mod`, Two-Dashes, React, or its own), follow it (consistency beats the default). Regardless of
   scheme, enforce the hard rules: names must be programmatically separable into block/element/modifier; a
   modifier never stands alone (`cardList cardList_compact`, never bare `cardList_compact`); one block per
   component; elements always flat from the block, no `cardList-a-b` chains. Every **emitted** modifier class
   has a matching `&-`/`&_` rule, and every rule a corresponding emitted class — map a default value to no class
   OR define its rule (a class that styles nothing, e.g. a default `size` modifier with no `&_size_md` rule, is
   dead). **Watch the default-value modifier specifically:** a key-value modifier for the *default* of an axis
   (`button_size_md`, `card_tone_default`) whose entire `@apply` set just **repeats what the base already
   applies** is a **dead modifier** even though it has a rule — it overrides nothing and is emitted on every
   instance. Fix it by making the base size-neutral (geometry moves into the modifiers) OR by declaring the
   bare block the default and emitting **no** class for it (only `button_size_lg`/`button_size_sm`). See §3.5.
9. **Full set of states, visible focus, reduced motion.** Interactive elements carry `hover` / `focus-visible` /
   `active` / `disabled` (not only `hover` — hover doesn't fire on touch, `gotchas.md` §8). Visible
   `focus-visible` is mandatory; don't kill outline without replacing it with `ring`/`outline-ring`. States and motion
   are consistent across similar components. **The visible-focus technique is ONE canonical pattern across the whole
   site — not re-authored per component.** Pick a single focus primitive (the skill's canonical form is
   `outline-2 outline-offset-2 outline-ring`) and apply the *same* one everywhere; when it lands on 3+ interactive
   elements, promote it to a custom `@utility focus-ring { … }` and `@apply focus-ring` in every `:focus-visible`
   (see item 5). **Flag mixed focus techniques on sibling controls** — e.g. one button drawn with `ring-2 ring-ring
   ring-offset-*` while the neighbouring controls use `outline-2 outline-offset-2 outline-ring`. Two adjacent
   controls showing different keyboard-focus visuals (a box-shadow ring with a gap vs a solid outline) is a defect,
   even though each form is individually valid; unify them to the one promoted pattern. Every transform/opacity
   transition and every `animate-*` carries a reduced-motion alternative — in markup the utility
   `motion-reduce:transition-none` / `motion-reduce:animate-none`, and in approach B the SCSS
   `@media (prefers-reduced-motion: reduce) { @apply transition-none; }`.
10. **Contrast and accessibility.** Token pairs are used together (`bg-primary` + `text-primary-foreground`,
    `bg-muted` + `text-muted-foreground`) — this guarantees readability. Don't put `text-foreground` on
    `bg-primary`. States (disabled, hover) don't drop contrast below threshold. Semantic markup
    (`<button>`, `<dialog>`, `<label for>`), not a `<div>` with a handler.
11. **Mobile-first and deliberate responsiveness.** The base is without a prefix, changes go on larger breakpoints
    progressively (`md:`, `lg:`). Don't use breakpoints removed from the project. **The decisive criterion:** a grid
    whose **cells are reusable components** (the same card primitive rendered N times) → **container query**
    (`@container` on the grid + `@sm:`/`@md:` column switches), because a reusable component must reflow by the width
    it actually gets, not by the viewport. A **one-off page section's own internal layout** (a hero, a two-column
    about-block, a footer's column split — markup that exists once and is not a reusable cell) → **viewport
    breakpoints** (`md:`, `lg:`), because it occupies a known slot in the page and there is nothing to make
    container-relative. So **flag** viewport-only column switches (`sm:grid-cols-2 lg:grid-cols-3`) on a grid that
    wraps a **reusable** card and steer it to `@container` + `@sm:`/`@md:`; but do **not** flag viewport breakpoints
    on a one-off page section — that is the correct tool there. The ambiguous middle case — a reusable card grid that
    happens to live inside an Approach-A page layout — is decided by the **cells**, not by where the grid sits: the
    cells are reusable, so it is a container-query candidate. See `examples/responsive-grid/`.
12. **No AI slop.** No purple-blue gradients, "glass"/glassmorphism cards, excessive rounding,
    decorative "blobs", random shadows. No translucent surface (`bg-*/<alpha>`) + `backdrop-blur` for visual
    effect on **any** chrome (sticky headers/navbars/overlays, not just cards). The resting surface of page-level
    chrome that content scrolls through uses the **opaque** token (`bg-background`, `bg-card`), not an alpha like
    `bg-background/95`. Examples/new code are neutral and skeletal; visual decisions come from the design system,
    not from "make it pretty" defaults. See §5.
13. **Accessible name + ARIA-state parity.** Every interactive control has an accessible name (visible text OR
    `aria-label`) AND the ARIA state attribute its kind needs: `aria-expanded` (+ `aria-controls`) for
    disclosures/menus, `aria-pressed` for toggle buttons, `aria-current` for the active nav item. A control whose
    visible label changes (e.g. a theme toggle) still needs a stable programmatic state via `aria-pressed`. **A
    control that acts on a specific nearby value** (a copy-to-clipboard button next to the code/IP it copies, a
    "reset"/"clear" button for an adjacent field) **references that value via `aria-describedby`**: give the value
    node an `id` and point the control's `aria-describedby` at it, so the value becomes part of the control's
    accessible description (the screen reader announces *which* value the action targets, not just the generic
    label). Flag a copy/act-on-value control whose name is generic ("Copy IP address") with no `aria-describedby`
    linking the value sitting right beside it. Verify consistency across variants — the A and B implementations of
    one component must match.

### Quick form (copy into the review comment)

- [ ] v4 syntax (no `@tailwind`, `bg-opacity-*`, `bg-gradient-to-*`, old `shadow/rounded`)
- [ ] all classes are full literals, detected
- [ ] no dynamically assembled class names
- [ ] third-party/CMS/generated DOM is scoped, not global
- [ ] promote on repeat: tokens for arbitrary, `@utility` for a pattern repeated on 3+ elements
- [ ] external design system propagated into `@theme`, not redefined
- [ ] `@apply` grouped by property category in the canonical order (no label comments), one line per group, no nesting; breakpoints inline or via `@variant`, not pushed wholesale into SCSS
- [ ] BEM: element `-`, modifier `_`, camelCase (default; follow the project's scheme if it declares one); every emitted modifier class has a matching rule
- [ ] full set of states + visible `focus-visible` + reduced-motion alternative (`motion-reduce:` / `@media (prefers-reduced-motion: reduce)`)
- [ ] focus-ring is ONE canonical promoted pattern site-wide (not re-authored per component); no mixed `outline-*`/`ring-*` focus on sibling controls
- [ ] contrast token pairs (`*` + `*-foreground`)
- [ ] a control acting on a nearby value links it via `aria-describedby` (value `id` → trigger)
- [ ] font tokens use ROLE names (`--font-heading`/`--font-body`/`--font-mono`), never `--font-display` (shadows the `@font-face` descriptor)
- [ ] mobile-first responsiveness; a grid of **reusable cells** uses `@container` (not viewport-only `sm:`/`lg:` columns), a **one-off page section** correctly uses viewport breakpoints
- [ ] no AI slop (gradients/glass/blobs/excess rounding); translucent+blur or resting alpha on chrome
- [ ] accessible name + ARIA state parity (`aria-expanded`/`aria-pressed`/`aria-current`); A and B match
- [ ] approach B verified by SCANNING the compiled CSS for unexpanded `@apply`, not just a green build

---

## 2. `@apply` grouping — how to read the diff (approach B)

In approach B (BEM + `@apply` in SCSS) declarations are grouped by property category in property-order.
In review we check the **group order** (the canonical category order, conveyed by the line order itself), not
personal taste — there are no per-group label comments to verify.

The canonical group order (each on its own `@apply` line):

1. Layout/position: `position`, `inset/top/right/bottom/left`, `z`, `display` (flex/grid/block), `flex/grid-*`, `place-*`, `gap`
2. Sizing: `w`, `h`, `min-*`, `max-*`, `aspect`
3. Spacing: `m*`, `p*`, `space-*`
4. Background/borders/shape: `bg-*`, `border*`, `rounded*`, `ring*`, `shadow*`, `outline*`
5. Typography: `font-*`, `text-<size>`, `text-<color>`, `leading`, `tracking`, `whitespace`, `truncate`
6. Effects/motion: `opacity`, `transition*`, `duration`, `ease`, `transform`, `scale/rotate/translate`, `filter`
7. Other interaction: `cursor`, `select-none`, `pointer-events`, `overflow`

Then — nested states (`&:hover`, `&:focus-visible`, `&:active`, `&:disabled`) and modifiers (`&_primary`).

```scss
/* In a scoped/CSS module first: @reference "../app.css";  (see gotchas.md §6) */
.button {
  @apply inline-flex items-center justify-center gap-2;
  @apply h-10 min-w-24;
  @apply px-4 py-2;
  @apply bg-primary rounded-md ring-1 ring-transparent;
  @apply text-sm font-medium text-primary-foreground;
  @apply transition-colors duration-150;
  @apply cursor-pointer select-none;

  &:hover { @apply bg-primary/90; }
  &:focus-visible { @apply outline-none ring-ring; }
  &:active { @apply bg-primary/80; }
  &:disabled { @apply opacity-50 pointer-events-none; }

  &_danger { @apply bg-danger text-danger-foreground; }
}
```

**Leave a comment in review** if: groups are mixed; everything is in one `@apply` line without splitting; the groups
are not in the canonical category order; states are scattered above the declarations; a modifier redefines half of
the base instead of a pointed change of tone/intent; a modifier whose entire `@apply` set equals the base (it styles
nothing — it's dead).

**Breakpoints in approach B (inline vs `@variant`).** A breakpoint flip of 1-2 utilities is fine inline on its
group line (`@apply hidden md:flex`). When one element accumulates **many** same-prefix breakpoint utilities
(> ~2-4), or one breakpoint flips several property groups, grouping them into a single `@variant <bp> { @apply …; }`
block reads better — keep the prefix-less mobile base on the normal grouped lines and put only the overrides inside:

```scss
&-menu {
  @apply hidden flex-col gap-3;
  @apply pb-3;
  @variant md { @apply flex flex-1 flex-row items-center gap-4 pb-0; }
}
```

`@variant md { … }` compiles to `@media (width >= 48rem) { … }` and `@apply` works inside it; the codemod form
`@media (width >= theme(--breakpoint-md)) { @apply …; }` is equivalent. Both are correct — flag only the
group-purity break (a layout `md:` stranded on the spacing-group line) and any wholesale push of viewport
responsiveness into SCSS (a smell in itself). Note: v3 `@screen md { … }` is **removed** in v4 — it passes through
unrecognized and the wrapped rules are silently dropped; flag any `@screen` as a defect.

---

## 3. Refactoring "smells"

Not every smell requires a change — but each requires an explanation of "why it's this way". An anti-pattern is best
shown as a **before → after** pair.

### 3.1 Utility soup without reuse

A long identical wall of classes copied into N places of the markup. The utility-first approach (A) itself is
the norm; the smell is precisely **duplication without extraction**. Treatment via the abstraction ladder: first extract
the **markup** into a reusable block/partial; add a CSS abstraction only if there is little markup repetition
but it's exactly the set of styles that repeats.

```html
<!-- before: the same set in a dozen places -->
<div class="rounded-md border border-border bg-card p-4 text-card-foreground shadow-sm">…</div>
<div class="rounded-md border border-border bg-card p-4 text-card-foreground shadow-sm">…</div>

<!-- after (A): extracted the markup into a reusable block -->
<!-- after (B): a .card component class in @layer components + @apply (see §2) -->
```

### 3.2 `@apply` hiding everything

`@apply` used to "hide all utilities in CSS" / create a giant semantic wrapper
that is harder to read than the original markup. This is a bad use of `@apply` (the good ones are third-party/
generated markup, small repeating patterns, token-oriented CSS).

```scss
/* smell: a page-specific wrapper pulling in dozens of unrelated utilities */
.heroSectionWrapperInner { @apply flex flex-col items-center gap-6 px-8 py-16 …; }
```

→ If `@apply` is mass-shortening templates — step back to the abstraction ladder: you probably need to extract
the **markup**, not hide styles. Keep component classes small, stable, and easy to
override.

### 3.3 Nested `@apply`

`@apply` of one component class inside another (`@apply .button;`) is a smell: it forms a hidden chain
of dependencies and a fragile cascade coupling. `@apply` is meant for **utilities**, not for your own
component classes. Also, `@apply` is forbidden inside `@keyframes`, and you can't mix mixins and
utilities in one `@apply`.

```scss
/* bad */
.iconButton { @apply button; @apply h-8 w-8; }
/* better: a shared base set of utilities, or a shared class in the markup/partial */
```

### 3.4 Arbitrary instead of a token

A repeating arbitrary value (`p-[18px]`, `bg-[#1f6feb]`, `shadow-[0_2px_8px_rgba(0,0,0,.08)]`)
instead of a name from the system. A one-off is OK; repetition/product meaning/the desire to edit centrally is a reason
for a token.

```html
<!-- before: the same hex and radius all over the code -->
<button class="bg-[#1f6feb] rounded-[10px]">…</button>
<!-- after: a name from @theme (value is a design-system placeholder) -->
<button class="bg-primary rounded-lg">…</button>
```

### 3.5 Other common smells (short list)

- Several versions of the same button/card with diverging styles — merge into one affordance.
- **Duplicated affordance across blocks.** The same control (copy button, IP/code chip, tag/badge) recurs as a
  `_copy`/`_chip`-style element inside several different blocks, often with diverging sizes/colors per page.
  Extract **one** reusable block that owns all its shared behavior and reuse it; if it must sit inside a parent
  block, position it with the parent element's external geometry while the reusable block keeps its own internal,
  margin-free styling (two BEM entities on one node — see `references/approaches.md`).
- **Dead (no-op) modifier.** A modifier whose entire `@apply` set equals what the base already applies styles
  nothing — drop it, or move the default tone into it so the base stays purely structural. **The most common case
  is the *default-value* modifier:** an axis's default key-value modifier (`button_size_md`, `card_tone_default`)
  that simply re-applies the geometry/tone the base already hardcodes. Because it is the default, it is emitted on
  **every** instance yet overrides nothing — it is dead. Either make the base size/tone-neutral and let each
  modifier carry its own geometry (so `button_size_md` is the real carrier of the `md` look), or declare the bare
  block the default and emit **no** class for it (markup adds only `button_size_lg`/`button_size_sm`). A base that
  hardcodes the default size while also shipping a `_size_md` modifier that repeats it is the contradiction to
  catch: the base is not actually size-neutral and the modifier is redundant.
- **Focus-ring re-authored per component.** The same visible-focus affordance written two ways across the site
  (`ring-2 ring-ring ring-offset-*` on one control, `outline-2 outline-offset-2 outline-ring` on its siblings) —
  unify to ONE canonical pattern and, on 3+ controls, promote it to `@utility focus-ring`. See §1 item 9.
- The same hover/transition implemented differently in different places — unify.
- State logic split between a shared class and a page-specific one-off — collect into the shared class.
- A component class that is in fact a fragment of a specific page. Return the structure to the markup.
- Global styling of all `h1/p/ul` for the sake of one content block — scope it (see §1 item 4).
- `border` without `border-<color>` counting on a "gray border" from v3 — there isn't one (`gotchas.md` §5).

---

## 4. Layer audit (separation of concerns, SKILL.md §3A)

The skill is the **implementation layer in CSS**, not the visual design layer. In review we separately check that the code
doesn't encroach on someone else's layer and doesn't dictate direction.

- **Don't dictate the visual direction.** Comment if new code introduces a specific palette/font
  pair/rounding as the "right" one instead of placeholders. Values come from the design system; the code sets
  the **method** (how to set up and use a token), not taste.
- **Map the external design system, don't redefine it.** If the project has a design system/`DESIGN.md`/
  ready tokens — their values are propagated into `@theme` under stable names. The flow: *design system →
  `@theme` tokens → utilities / BEM+@apply*. You can't hardcode values bypassing tokens or rewrite
  the existing palette "to your liking".
- **On conflict, the design system wins.** If a "general styling rule" diverges from the brand/
  design system of the project — the design system wins; the skill only insists on the correctness of Tailwind v4.
- **Respect the repository's conventions.** If the repo already adopted approach A or B — follow it, don't impose
  the other one. The choice of presentation is an adaptation to the project, not dogma.
- **No references to third-party skills.** In code and comments there are no mentions of other skills by name, brands,
  project names, or technologies outside the Tailwind ecosystem (HTML/CSS/SCSS/PostCSS/Lightning CSS/`@apply`/BEM/
  tokens — allowed). JS glue (`cn()`, clsx, tailwind-merge, CVA) — only as an explicitly optional aside
  "if you're in a JS framework", not as the foundation.
- **Reinforcing shared values is safe.** CSS variables for repetition (= `@theme` tokens), accessibility
  (visible focus, full set of states), responsiveness, motion via `transform`/`opacity`, semantic
  markup. Here the layers coincide — require it boldly.

---

## 5. Debranding / anti-slop checklist (when porting third-party code)

Apply when a snippet comes from third-party/human code (production code is **not the reference standard**): it
must be "stripped down" and checked against the sources, not copied as is.

**Debranding:**

- [ ] Removed mentions of brands, project names, domains, product names (in classes, comments, alt/aria).
- [ ] Removed the framework glue: `<template>`, `<script>`, `<style lang="scss">`, directives, props/computed —
      leaving clean HTML markup + CSS/SCSS.
- [ ] No forbidden technologies in the body of the example (Vue/Nuxt/React/JSX/Svelte/Pinia/Vite). JS helpers — only
      as an optional aside.
- [ ] BEM renamed to the project's scheme — default: element `-`, modifier `_`, key-value `_`, camelCase
      lowercase-first (`cardList-item`, `cardList_compact`, `cardList-item_active`). Third-party projects often use
      a different scheme; rename to match the project (or to this default if none is declared).
- [ ] Token values replaced with placeholders marked "replaced under the design system"; only token NAMES
      are stable.

**Anti-slop (visual neutrality):**

- [ ] No purple-blue (or any random "pretty") gradients; a decorative `bg-linear-*` without justification is removed.
- [ ] No glassmorphism on **any** chrome, not just cards: a translucent surface (`bg-*/<alpha>`) + `backdrop-blur`
      used for visual effect is slop wherever it appears — cards, sticky headers/navbars, overlays. Replace with a
      solid token + a real boundary (`bg-background border-b border-border`). Narrow exception: a modal scrim may use
      a translucent background — but do **not** add `backdrop-blur` to it; the blur is the slop signal.
- [ ] No resting alpha on **structural** chrome. The base/scroll surface of page-level chrome (sticky
      header/footer/sidebar) that content scrolls through uses the **opaque** semantic token (`bg-background`,
      `bg-card`); a resting alpha like `bg-background/95` lets content bleed through. Reserve alpha for
      interaction-state tweaks (`hover:bg-primary/90`), intentional scrims/overlays, or translucent tint layers
      stacked over a parent surface (zebra `even:bg-muted/40`, a `tfoot` `bg-muted/30`) — these are legitimate.
- [ ] No excessive rounding (a bloated `rounded-[…]`/`rounded-full` out of place) — radii from the `rounded-sm/md/lg/xl` scale.
- [ ] No decorative "blobs", random shadows, or extra animation "for the wow".
- [ ] The example is skeletal and neutral: it shows **structure and wiring**, not "design".

**Checking against the sources (mandatory before it lands in the code):**

- [ ] Syntax checked against v4 (no leaked v3); behavior and official positions — against the official Tailwind v4 documentation.
- [ ] An anti-pattern from third-party code, if instructive, is presented as a **before → after** pair, not introduced as the "reference standard".

---

## 6. Order of refactoring actions (once you've decided to fix it)

To avoid multiplying abstractions, go in order of decreasing "cheapness" of the edit:

1. Delete dead CSS before adding new.
2. Remove redundant/duplicate utilities before extracting abstractions.
3. Normalize the obvious repeating primitives (radii, shadows, spacing) into tokens.
4. Keep the number of component classes deliberately small.
5. Return the page structure to the markup if CSS started to "own" the layout.
6. Merge diverging implementations of one affordance into one.

The main default: **prefer removing complexity over introducing yet another clever abstraction.** First markup,
then markup reuse, then tokens, then utilities, and only then — semantic CSS.

---

## 7. Verifying approach B — "build passed" is not enough

A green build is **not** proof that `@apply`/`@reference` expanded. Some pipelines pass `@apply` through as an
unrecognized at-rule with **no error**, shipping it raw to the browser so the component renders unstyled. When a
component uses `@apply` (especially in scoped/preprocessor styles), verify by **scanning the compiled CSS** for
unexpanded `@apply` / `@reference` — not just the exit code. The component is correct only when the post-build CSS
contains **zero** raw `@apply` and **zero** literal `@reference`.
