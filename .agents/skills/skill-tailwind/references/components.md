# Components — agnostic pattern reference

A reference of **component skeletons**, not ready-made examples (full implementations live in `examples/`).
Here: purpose, required states, accessibility, and how the component looks in **approach A**
(utilities in the markup) and **approach B** (BEM + `@apply` in SCSS). Both approaches are equal; the choice is
a matter of project convention (see `references/approaches.md`).

## Cross-cutting rules (read before the individual components)

These invariants are mandatory for **every** component below — we don't repeat them each time.

1. **Full set of states (SKILL.md "Approach A: utility-first"; `docs/variants-and-states.md`).** An interactive component must define `:hover`,
   `:focus-visible`, `:active`, `:disabled`. An input field adds validation via **`user-invalid:`**
   (and/or `[aria-invalid="true"]` for a server-side result) — **NOT** `:invalid`/`peer-invalid:`,
   which fire before input and would highlight an empty required field right on load. Missing any
   of these is a defect, not a "simplification".
2. **Visible focus.** Only `:focus-visible` (not `:focus`), so the ring isn't shown on a mouse click
   but is shown during keyboard navigation. Draw the ring with `outline` (doesn't shift the
   layout): `outline-2 outline-offset-2 outline-ring`. Never `outline-none` without a replacement.
3. **Markup semantics.** An action button is `<button type="button">`; a navigation link is `<a>`; a
   field is `<input>`/`<textarea>` with `<label for>`; a modal is the native `<dialog>`. Don't put a
   button role on a `<div>`.
4. **Contrast.** Use the semantic `text-*-foreground` pairs over `bg-*` — they're designed to be
   contrasting. Token values are **placeholders** for the project's design system (see `templates/theme.css`);
   the names are stable, the values are not.
5. **Motion — `transform`/`opacity`, 150–300ms, and `motion-reduce`.** Animate only cheap
   properties; respect `prefers-reduced-motion` (`motion-reduce:transition-none`).
6. **No AI slop.** No purple-blue gradients, "glass" cards, excessive rounding,
   decorative blobs. Examples are neutral and skeletal; the visual direction is set by the design layer,
   not this skill (SKILL.md §3A: the skill is the **implementation** layer, not the design one).
7. **`@apply` grouping (approach B).** Group declarations by meaning in this order:
   layout → sizing → spacing → background/borders/shape → typography → effects → interaction,
   then nested states and modifiers. Each property group is a separate `@apply` line; the line order
   conveys the grouping — do NOT add per-group label comments (only element/modifier or behavior
   comments). See `resources/apply-grouping.md`.
8. **`@reference` in isolated CSS.** If the SCSS compiles separately from the entry CSS
   (CSS modules / `<style>` blocks), the file needs a `@reference "...";` at the top, otherwise `@apply` can't see the
   utilities. In a regular shared `components.scss` imported after `@import "tailwindcss"`, this isn't needed.

BEM convention (canonical default): block `cardList`, element `cardList-item` (element separator `-`),
block modifier `cardList_compact` (modifier separator `_`), element modifier `cardList-item_active`,
key-value modifier `cardList_size_lg` — names are camelCase, lowercase-first. One block per component;
elements always derive from the block. This is configurable: if a project declares another scheme, follow
it. Hard rules either way — modifiers are programmatically separable, a modifier never stands alone
(`block block_mod`), and there are no elements of elements (`block-a-b` is forbidden).

**A block root sets no external geometry/positioning** (so it stays droppable anywhere): it should not set
centering (`mx-auto`), outer margins, or `position` on itself — defer those to an inner element
(`block-inner`) or to the parent that hosts the block via a BEM mix (see `references/approaches.md` §3, §7).
**Carve-out — singleton page chrome.** A non-reusable, one-per-page chrome block (a sticky header/footer,
a sidebar, the app shell) **MAY** own `position`/`sticky`/`z-index` on its root, because it is never reused
and has no "placed in many parents" concern; keep its inner element responsible for centering/width
(`block-inner` with `mx-auto max-w-*`). The prohibition targets **reusable** primitives whose placement
must stay external.

---

## button

**Purpose.** An action trigger. The base class owns layout/typography/states;
tone (primary/danger/…) and size are separate modifiers, so the base stays neutral
(the variant strategy from the playbook: the base doesn't hardcode color).

**Required states.** `:hover` (a slight background shift, e.g. `bg-primary/90`), `:focus-visible`
(ring), `:active` (press), `:disabled` (`opacity-50 cursor-not-allowed pointer-events-none`).

**Accessibility.** Always `<button type="button">` (or `type="submit"` in a form). Visible
`:focus-visible`. If the button is icon-only, an `aria-label` is required. Text contrasts against the background
via `*-foreground`. The "loading" state is `aria-busy="true"` + `disabled`.

**Approach A (utilities in the markup):**
```html
<button type="button"
  class="inline-flex items-center justify-center gap-2 h-9 px-4
         rounded-md bg-primary text-primary-foreground text-sm font-medium
         transition-colors duration-150 motion-reduce:transition-none
         hover:bg-primary/90
         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
         active:bg-primary/80
         disabled:opacity-50 disabled:pointer-events-none">
  Label
</button>
```
Variant/size — by swapping token classes in the markup (`bg-danger text-danger-foreground`, `h-8 px-3`).

**Approach B (BEM + `@apply`):**
```scss
.button {
  @apply inline-flex items-center justify-center gap-2;
  @apply h-9 px-4;
  @apply rounded-md bg-primary text-primary-foreground;
  @apply text-sm font-medium;
  @apply transition-colors duration-150 motion-reduce:transition-none;
  @apply cursor-pointer select-none;

  &:hover { @apply bg-primary/90; }
  &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
  &:active { @apply bg-primary/80; }
  &:disabled { @apply opacity-50 pointer-events-none; }

  &_danger { @apply bg-danger text-danger-foreground;
    &:hover { @apply bg-danger/90; } }
  &_sm { @apply h-8 px-3 text-xs; }
}
```
Markup: `<button type="button" class="button button_danger">…</button>`.

---

## card

**Purpose.** A surface container for grouped content (header, body, actions).
Usually **not interactive**; if the whole card is clickable, wrap it in `<a>`/`<button>`
and then the state rules from "button" apply.

**Required states.** A static card requires no states. A clickable one inherits
the full set (`:hover`, `:focus-visible`, `:active`); mark the link inside with a `focus-visible` ring.

**Accessibility.** A semantic container: `<article>`/`<section>` with a heading `<h2>/<h3>`. Don't create
"nested clickable areas" (a link inside a clickable card is a focus conflict). The border
`border-border` provides contrast between the surface and the background.

**Approach A:**
```html
<article class="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
  <div class="flex flex-col gap-1.5 p-6">
    <h3 class="text-base font-semibold">Title</h3>
    <p class="text-sm text-muted-foreground">Description</p>
  </div>
  <div class="p-6 pt-0">…content…</div>
</article>
```

**Approach B:**
```scss
.card {
  @apply flex flex-col;
  @apply rounded-lg border border-border bg-card text-card-foreground shadow-sm;

  &-header   { @apply flex flex-col gap-1.5; @apply p-6; }
  &-title    { @apply text-base font-semibold; }
  &-subtitle { @apply text-sm text-muted-foreground; }
  &-body     { @apply p-6 pt-0; }
}
```
Markup: `<article class="card"><div class="card-header"><h3 class="card-title">…`.

---

## input-field

**Purpose.** A text input field with a label and (optionally) an error message.

**Required states.** `:hover` (optional), `:focus-visible` (ring + border),
`:disabled` (`opacity-50 cursor-not-allowed`), **`user-invalid:` / `[aria-invalid="true"]`** (border and
`danger` ring). This is the only component where the error state is mandatory.

**Accessibility.** `<label for="id">` is tied to `<input id>`. Output the error as text and link it via
`aria-describedby`; on the field itself, `aria-invalid="true"`. Don't rely on border color alone —
duplicate it with a message. Placeholder ≠ label.

**Approach A:**
```html
<label for="email" class="text-sm font-medium">Email</label>
<input id="email" type="email" aria-describedby="email-err"
  class="h-9 w-full px-3
         rounded-md border border-input bg-input/0 text-sm
         placeholder:text-muted-foreground
         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
         disabled:opacity-50 disabled:cursor-not-allowed
         aria-[invalid=true]:border-danger aria-[invalid=true]:outline-danger">
<p id="email-err" class="text-xs text-danger">Error message</p>
```

**Approach B:**
```scss
.inputField {
  @apply flex flex-col gap-1.5;

  &-label   { @apply text-sm font-medium; }
  &-control {
    @apply relative flex items-center;
    @apply h-9 w-full;
    @apply rounded-md border border-input bg-input;

    &:has(:focus-visible) { @apply ring-2 ring-ring ring-offset-2; }
  }
  &-input {
    @apply h-full w-full;
    @apply px-3;
    @apply bg-transparent;
    @apply text-sm placeholder:text-muted-foreground;
    @apply outline-none;

    &:disabled { @apply opacity-50 cursor-not-allowed; }
  }
  &-hint  { @apply text-xs text-muted-foreground; }
  &-error { @apply text-xs font-medium text-danger; }

  /* block modifier: invalid field (paired with aria-invalid="true") */
  &_invalid {
    .inputField-control { @apply border-danger;
      &:has(:focus-visible) { @apply ring-danger; } }
  }
}
```

---

## badge

**Purpose.** A compact status/category label. Non-interactive (unless it's a link/filter).

**Required states.** A static badge — no states. A clickable/removable one inherits
the button states; the remove button inside is a separate focusable `<button aria-label>`.

**Accessibility.** If the badge carries status meaning not conveyed by the surrounding text, add
an `aria-label`/visually hidden text. Duplicate the tone color with a word; don't rely on the shade alone.

**Approach A:**
```html
<span class="inline-flex items-center gap-1 h-5 px-2
             rounded-sm bg-muted text-muted-foreground text-xs font-medium">
  Label
</span>
<!-- tone: bg-success/15 text-success | bg-danger/15 text-danger -->
```

**Approach B:**
```scss
.badge {
  @apply inline-flex items-center gap-1;
  @apply h-5 px-2;
  @apply rounded-sm bg-muted text-muted-foreground;
  @apply text-xs font-medium;

  &_success { @apply bg-success/15 text-success; }
  &_danger  { @apply bg-danger/15 text-danger; }
}
```

---

## alert

**Purpose.** A prominent page/section-level message (info/success/warning/danger).

**Required states.** Static. If there's a close button, it's interactive (button states).

**Accessibility.** `role="alert"` (or `role="status"` for non-urgent ones) — so the screen reader announces it.
Mark the status icon `aria-hidden="true"` (the text carries the meaning). The tone is duplicated by the heading/text,
not just the color. The close button is `<button aria-label="Dismiss">`.

**Approach A:**
```html
<div role="alert"
  class="flex items-start gap-3 p-4
         rounded-md border border-border bg-card text-card-foreground text-sm">
  <svg aria-hidden="true" class="size-5 shrink-0">…</svg>
  <div class="flex flex-col gap-1">
    <p class="font-medium">Title</p>
    <p class="text-muted-foreground">Description</p>
  </div>
</div>
<!-- danger tone: border-danger/30 bg-danger/10 text-danger-foreground -->
```

**Approach B:**
```scss
.alert {
  @apply flex items-start gap-3;
  @apply p-4;
  @apply rounded-md border border-border bg-card text-card-foreground;
  @apply text-sm;

  &-icon  { @apply size-5 shrink-0; }
  &-title { @apply font-medium; }
  &-body  { @apply text-muted-foreground; }

  &_danger  { @apply border-danger/30 bg-danger/10; }
  &_warning { @apply border-warning/30 bg-warning/10; }
}
```

---

## navbar

**Purpose.** A navigation header: brand area + a list of links, responsive (collapses on narrow widths).

**Required states (links).** `:hover`, `:focus-visible` (ring), the active item —
`aria-current="page"` + visual emphasis. The mobile menu button — button states.

**Accessibility.** The outer container is `<header>` with `<nav aria-label="Main">`. The link list is `<ul>/<li>`.
The current page is `aria-current="page"` (not color alone). The mobile menu trigger is a `<button>` with
`aria-expanded` and `aria-controls`. When a control exposes its state through ARIA — **any of `aria-expanded` /
`aria-pressed` / `aria-checked` / `aria-selected`** — prefer a **stable, state-neutral accessible name** (e.g.
`aria-label="Toggle menu"`, or stable visible text). The ARIA state attribute already conveys open/closed (or
on/off), so the name shouldn't restate it: a name that *flips* with state (e.g. `aria-label` swapping between "Open"
and "Close") combined with the state attribute double-encodes the state and can read inconsistently. An icon-only
trigger still **needs** a name — pick a state-neutral one. (A state-aware `aria-label="Open menu"`/`"Close menu"` on
a control that does **not** also carry the matching ARIA state attribute is an acceptable secondary alternative.)
Every link has a visible `:focus-visible`.

**Approach A:**
```html
<header class="border-b border-border bg-background">
  <nav aria-label="Main" class="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
    <a href="/" class="font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Brand</a>
    <ul class="hidden items-center gap-4 md:flex">
      <li><a href="/x" aria-current="page"
        class="text-sm text-foreground
               hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
               aria-[current=page]:font-medium">Item</a></li>
      <li><a href="/y" class="text-sm text-muted-foreground hover:text-foreground
               focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Item</a></li>
    </ul>
    <button type="button" aria-expanded="false" aria-controls="nav-menu" aria-label="Toggle menu"
      class="ml-auto md:hidden …">☰</button>
  </nav>
</header>
```

**Approach B:**
```scss
/* The CTA is the shared `button` block placed here via a BEM mix — NOT a re-authored
   button. `navbar-cta` contributes only placement/visibility; the appearance and states come
   from `button button_primary` (see references/approaches.md §7 and resources/anti-patterns.md).
   One affordance = one block: don't re-declare bg/typography/states on a navbar element. */
.navbar {
  @apply border-b border-border bg-background;

  &-inner { @apply mx-auto flex h-14 max-w-6xl items-center gap-6 px-4; }
  &-brand { @apply font-semibold;
    &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; } }
  &-list  { @apply hidden items-center gap-4 md:flex; }
  &-link  {
    @apply text-sm text-muted-foreground;
    &:hover { @apply text-foreground; }
    &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
    &_active { @apply text-foreground font-medium; }        /* = aria-current="page" */
  }
  &-cta   { @apply ml-auto; }                               /* placement only — the look is the `button` block */
}
```
Markup for the CTA is a **BEM mix**: `<a href="/start" class="button button_primary navbar-cta">Get
started</a>`. The reusable `button` block (defined once elsewhere) owns the appearance and the full
state set; `navbar-cta` only positions it. If the CTA shows/hides responsively, put that `display`
flip on a slot the navbar owns (e.g. an `&-ctaSlot` wrapper element) rather than on the mixed node
itself, so it never fights the block's own `display` (see `references/approaches.md` §7).

---

## modal

**Purpose.** A modal window over the content. **The native `<dialog>`** (focus trap and backdrop come
from the platform), with the enter animation via `@starting-style` (a v4 essential).

**Required states.** Buttons inside — button states. `<dialog>` is driven by `::backdrop`,
`[open]`, and `@starting-style` for its appearance. Closing on Esc is native to `<dialog>`.

**Accessibility.** `<dialog>` itself sets `role="dialog"` and `aria-modal`. Link the heading:
`aria-labelledby` → id of the `<h2>`. Open via `dialog.showModal()` (modal focus trap), not
`show()`. Return focus to the trigger after closing. Respect `motion-reduce`.

**Approach A** (classes + minimal CSS for `@starting-style`, which utilities don't expose directly —
you can use the `starting:` variant):
```html
<dialog id="m" aria-labelledby="m-title"
  class="m-auto w-full max-w-lg rounded-lg border border-border bg-card text-card-foreground p-6 shadow-lg
         backdrop:bg-foreground/40
         opacity-0 transition-opacity duration-200 open:opacity-100
         starting:open:opacity-0 motion-reduce:transition-none">
  <h2 id="m-title" class="text-base font-semibold">Title</h2>
  <p class="mt-2 text-sm text-muted-foreground">Body</p>
  <div class="mt-4 flex justify-end gap-2">
    <button type="button" class="button button_sm" onclick="m.close()">Cancel</button>
  </div>
</dialog>
```

**Approach B:**
```scss
.modal {
  @apply m-auto w-full max-w-lg;
  @apply p-6;
  @apply rounded-lg border border-border bg-card text-card-foreground shadow-lg;
  @apply opacity-0 transition-opacity duration-200 motion-reduce:transition-none;

  &::backdrop { @apply bg-foreground/40; }
  &[open] { @apply opacity-100; }
  @starting-style { &[open] { @apply opacity-0; } }         /* enter animation */

  &-title { @apply text-base font-semibold; }
  &-body  { @apply mt-2 text-sm text-muted-foreground; }
  &-actions { @apply mt-4 flex justify-end gap-2; }
}
```

---

## responsive-grid

**Purpose.** A responsive grid that rearranges columns **by the parent's width**, not the viewport's —
via **container queries** (`@container` + `@sm:`/`@md:`), which makes the component genuinely
reusable in any context.

**Required states.** A structural component — no interactive states; the states live on the
nested cards/links.

**Accessibility.** The grid is layout, not semantics: if the items form a list, wrap them in `<ul>/<li>`.
Don't break the reading order (visual order = DOM order).

**Approach A:**
```html
<div class="@container">
  <ul class="grid grid-cols-1 gap-4 @sm:grid-cols-2 @lg:grid-cols-3">
    <li>…</li>
  </ul>
</div>
```

**Approach B:**
```scss
.cardGrid {
  @apply @container;

  &-list {
    @apply grid grid-cols-1 gap-4;
    @apply @sm:grid-cols-2 @lg:grid-cols-3;
  }
  &-item  { @apply flex flex-col gap-1 p-4 rounded-lg border border-border bg-card text-card-foreground; }
}
```

---

## accordion

**Purpose.** A stack of expandable sections (disclosure). Built on **native `<details>`/`<summary>`** —
open/close, keyboard (Enter/Space), and disclosure semantics come from the platform, **without JS and without ARIA**.
For "one open at a time", use the same `name="..."` on each `<details>` (native exclusive accordion).

**Required states.** The trigger (`<summary>`): `:hover`, `:focus-visible` (ring), `:active`. The open
state is the native `[open]` (via `group-open:`/`[open]`), not a JS class. A disabled section is the native
attribute **`inert`** (an `inert:` variant does NOT exist); dim it visually with `opacity-50`.

**Accessibility.** `<details>`/`<summary>` are self-contained for the screen reader — don't add extra ARIA. Hide the
default marker (`list-none` + `[&::-webkit-details-marker]:hidden`); add only a visible
`focus-visible` on the trigger. Chevron — `aria-hidden`.

**v4 nuance (height).** `<details>` doesn't animate height `0 ↔ auto` directly. Option 1: animate the
`::details-content` pseudo-element (v4.1 `details-content:` variant) with `@starting-style` + `transition-discrete`,
enabling document-level `interpolate-size: allow-keywords` (no utility → in `<style>`). Option 2: wrap the
content in a grid and animate `grid-template-rows` `0fr→1fr` (no opt-in). Without support, the section simply
expands instantly (progressive enhancement).

**Approach A:**
```html
<details open class="group rounded-md border border-border bg-card text-card-foreground">
  <summary class="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 rounded-md
                  text-sm font-medium transition-colors duration-150 motion-reduce:transition-none
                  hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
                  [&::-webkit-details-marker]:hidden">
    <span>Section</span>
    <svg aria-hidden="true" class="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180">…</svg>
  </summary>
  <div class="px-4 pb-4 text-sm text-muted-foreground
              details-content:overflow-hidden details-content:h-0 details-content:opacity-0
              details-content:transition-[height,opacity,content-visibility] details-content:transition-discrete
              group-open:details-content:h-auto group-open:details-content:opacity-100
              starting:group-open:details-content:h-0">…</div>
</details>
```

**Approach B:**
```scss
.accordion {
  @apply flex flex-col gap-2;
  @apply w-full max-w-md;

  &-item    { @apply rounded-md border border-border bg-card text-card-foreground; }
  &-trigger {
    @apply flex items-center justify-between gap-4;
    @apply px-4 py-3;
    @apply text-sm font-medium;
    @apply transition-colors duration-150 motion-reduce:transition-none;
    @apply cursor-pointer list-none;
    &::-webkit-details-marker { @apply hidden; }
    &:hover { @apply bg-muted; }
    &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
  }
  &-icon    { @apply size-4 shrink-0 text-muted-foreground transition-transform duration-200; }
  &-content {
    @apply px-4 pb-4 text-sm text-muted-foreground;
    &::details-content {
      @apply h-0 opacity-0 overflow-hidden;
      @apply transition-[height,opacity,content-visibility] duration-200 transition-discrete;
    }
  }
  &-item[open] {
    .accordion-icon { @apply rotate-180; }
    .accordion-content::details-content { @apply h-auto opacity-100; }
  }
  @starting-style { &-item[open] .accordion-content::details-content { @apply h-0 opacity-0; } }

  &-item_disabled { @apply opacity-50;                       /* paired with native inert */
    .accordion-trigger { @apply cursor-not-allowed; } }
}
```

---

## checkbox / radio / switch

**Purpose.** Three native selection controls. checkbox and radio stay native and are tinted with `accent-primary`
(v4 → `accent-color`). switch — `<input type="checkbox" role="switch">` with `appearance-none`; the look is assembled by
sibling track/thumb via `peer-checked:`.

**Required states.** `:hover`, `:focus-visible` (`outline-ring` ring), `:checked`, `:disabled`.
For required fields — validation via **`user-invalid:`** (NOT `invalid:`/`peer-invalid:` — those fire
before input). Dim the row group via `has-[:disabled]:`.

**Accessibility.** Each row is a `<label>` wrapper (the text ties the control without `for/id`). A radio group goes in
a `<fieldset>`/`<legend>`. `role="switch"` reports on/off. Link the error with `aria-describedby` and duplicate it with
text — not just color.

**Approach A (checkbox):**
```html
<label class="group inline-flex items-start gap-3 has-[:disabled]:opacity-50">
  <input type="checkbox" name="terms" required aria-describedby="t-err"
    class="size-4 shrink-0 rounded-sm accent-primary outline-none
           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
           user-invalid:outline-2 user-invalid:outline-danger disabled:cursor-not-allowed" />
  <span class="text-sm text-foreground select-none">I accept
    <span id="t-err" class="block text-xs font-medium text-danger">Required.</span></span>
</label>
```

**Approach A (switch):** a hidden `peer` input + a visible `switch-track`/`switch-thumb`:
```html
<label class="inline-flex items-center justify-between gap-3 has-[:disabled]:opacity-50">
  <span class="text-sm text-foreground select-none">Dark mode</span>
  <span class="relative inline-flex shrink-0 items-center">
    <input type="checkbox" role="switch" name="dark" checked
      class="peer absolute inset-0 z-10 size-full cursor-pointer appearance-none rounded-full outline-none" />
    <span class="h-6 w-10 rounded-full bg-input transition-colors peer-checked:bg-primary
                 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"></span>
    <span class="pointer-events-none absolute left-0.5 size-5 rounded-full bg-background shadow-sm
                 transition-transform ease-out peer-checked:translate-x-4 motion-reduce:transition-none"></span>
  </span>
</label>
```

**Approach B:**
```scss
.checkbox { @apply group inline-flex w-fit items-start gap-3;
  @apply has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50; }
.checkbox-control {
  @apply mt-0.5 shrink-0 size-4;
  @apply rounded-sm accent-primary;
  @apply transition-colors duration-150 motion-reduce:transition-none;
  @apply outline-none;
  &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
  &_invalid { &:user-invalid { @apply outline-2 outline-danger; } } /* NOT invalid: */
}
.switch-track {
  @apply h-6 w-10 rounded-full bg-input transition-colors motion-reduce:transition-none;
  @apply peer-checked:bg-primary;
  @apply peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring;
}
.switch-thumb {
  @apply pointer-events-none absolute left-0.5 size-5 rounded-full bg-background shadow-sm;
  @apply transition-transform duration-150 ease-out motion-reduce:transition-none peer-checked:translate-x-4;
}
```

---

## select

**Purpose.** A styled **native `<select>`** (native popup/keyboard/type-to-search — for free).
`appearance-none` removes the OS chrome; the custom chevron is layered absolutely and made `pointer-events-none`,
so the click passes through to the `<select>` and the native list opens.

**Required states.** `:hover` (optional), `:focus-visible` (ring), `:disabled`, validation.
Two "invalid" layers: `aria-[invalid=true]:`/the `select_invalid` block modifier (a server-side result — colors
immediately) and **`user-invalid:`** (the live client-side one — only after interaction). `required` + an empty
placeholder `<option value="">` makes "nothing selected" invalid.

**Accessibility.** `<label for>` ↔ `<select id>`. Chevron — `aria-hidden`. The error via `aria-describedby`,
duplicated with text. `pr-9` reserves room for the icon so the value doesn't overlap it.

**Approach A:**
```html
<label for="role" class="text-sm font-medium text-foreground">Role</label>
<div class="relative">
  <select id="role" required aria-describedby="r-err"
    class="h-10 w-full appearance-none rounded-md border border-border bg-input pl-3 pr-9 text-sm text-foreground
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
           disabled:opacity-50 user-invalid:border-danger user-invalid:focus-visible:ring-danger">
    <option value="" disabled selected>Select…</option><option>Admin</option>
  </select>
  <svg aria-hidden="true" class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground">…</svg>
</div>
<p id="r-err" class="text-xs font-medium text-danger">Please choose a role.</p>
```

**Approach B:**
```scss
.select { @apply flex flex-col gap-1.5 w-full; }
.select-field { @apply relative; }
.select-control {
  @apply h-10 w-full;
  @apply pl-3 pr-9;
  @apply appearance-none rounded-md border border-border bg-input;
  @apply text-sm text-foreground;
  @apply transition-colors duration-150;
  @apply cursor-pointer;
  &:hover { @apply border-ring/60; }
  &:focus-visible { @apply outline-none ring-2 ring-ring ring-offset-2; }
  &:disabled { @apply cursor-not-allowed opacity-50; }
  &:user-invalid { @apply border-danger; &:focus-visible { @apply ring-danger; } } /* NOT invalid: */
}
.select-icon { @apply pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground; }
.select_invalid .select-control { @apply border-danger; &:focus-visible { @apply ring-danger; } }
```

---

## textarea

**Purpose.** A multi-line input that **grows with content** via `field-sizing-content` (v4.1) — auto-sizing
**without JS** (replacing the old `scrollHeight` hack). The starting height is `rows`; growth is bounded by `min-h`/`max-h`
(beyond the max — it scrolls).

**Required states.** `:focus-visible` (ring), `:disabled`, **`:invalid`** via **`user-invalid:`**
(NOT `:invalid` — it would highlight an empty required field right on load).

**Accessibility.** `<label for>` ↔ `<textarea id>`; hint and error linked with `aria-describedby` (a space-separated list of
ids). In the invalid example — `aria-invalid="true"`. The error is duplicated with text.

**Approach A:**
```html
<label for="bio" class="text-sm font-medium text-foreground">Bio</label>
<textarea id="bio" rows="2" aria-describedby="bio-hint"
  class="field-sizing-content min-h-16 max-h-64 w-full resize-none rounded-md border border-border bg-input
         px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
         disabled:opacity-50 user-invalid:border-danger user-invalid:focus-visible:ring-danger"></textarea>
<p id="bio-hint" class="text-xs text-muted-foreground">Grows as you type.</p>
```

**Approach B:**
```scss
.textarea { @apply flex flex-col gap-1.5 w-full; }
.textarea-control {
  @apply field-sizing-content min-h-16 max-h-64 w-full;     /* auto-grow */
  @apply px-3 py-2;
  @apply resize-none rounded-md border border-border bg-input;
  @apply text-sm text-foreground placeholder:text-muted-foreground;
  @apply transition-colors duration-150;
  &:focus-visible { @apply outline-none ring-2 ring-ring ring-offset-2; }
  &:disabled { @apply cursor-not-allowed opacity-50; }
  &:user-invalid { @apply border-danger; &:focus-visible { @apply ring-danger; } } /* NOT :invalid */
}
.textarea_invalid .textarea-control { @apply border-danger; &:focus-visible { @apply ring-danger; } }
```

---

## tabs

**Purpose.** Switching between panels. The base agnostic pattern is **pure CSS, no JS**: hidden `sr-only`
radio `<input>`s (one per tab) as siblings show the right panel via `:checked`/`peer-checked:` and
highlight the active tab (`<label>`).

**Required states.** A tab: `:hover`, `:focus-visible` (ring), active (via `:checked`). A disabled
tab — an inert `<span aria-disabled="true">` (no radio → not focusable). A panel: visible `focus-visible`.

**Accessibility.** `role="tablist"`/`role="tab"`/`role="tabpanel"` + `aria-selected`; wire the two-way relationship —
each tab `aria-controls` its panel id, each panel `aria-labelledby` the tab's id (give the tab `<label>` its own `id`,
distinct from the radio `id` its `for` targets). **HONEST LIMITATION (flag it explicitly).** Full WAI-ARIA tabs require **roving tabindex + Arrow/Home/End**
— that's ~15 lines of native JS. The CSS-only version gives a correct structure and real focusable controls, but
**not** strict APG. If you need strict semantics, add a small JS layer; **don't imitate a framework**.

**Approach A (wiring fragment):**
```html
<input type="radio" name="tabs" id="t-1" class="peer/t1 sr-only" checked />
<div role="tablist" class="flex gap-1 border-b border-border
     peer-checked/t1:[&_[for=t-1]]:border-primary peer-checked/t1:[&_[for=t-1]]:text-foreground">
  <label for="t-1" id="t-1-label" role="tab" aria-selected="true" aria-controls="panel-1"
    class="-mb-px h-10 px-4 border-b-2 border-transparent text-sm font-medium text-muted-foreground
           hover:text-foreground cursor-pointer">Overview</label>
</div>
<section id="panel-1" role="tabpanel" aria-labelledby="t-1-label" tabindex="0"
  class="hidden p-4 text-sm peer-checked/t1:block
         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">…</section>
```

**Approach B:**
```scss
.tabs { @apply relative block w-full max-w-xl;
  &-radio { @apply sr-only; }
  &-list  { @apply flex items-stretch gap-1 border-b border-border; }
  &-tab   {
    @apply -mb-px inline-flex items-center justify-center h-10 px-4;
    @apply border-b-2 border-transparent;
    @apply text-sm font-medium text-muted-foreground;
    @apply transition-colors duration-150 motion-reduce:transition-none;
    @apply cursor-pointer select-none;
    &:hover { @apply text-foreground; }
    &_disabled { @apply opacity-50 cursor-not-allowed; &:hover { @apply text-muted-foreground; } }
  }
  &-panel { @apply hidden p-4 text-sm; &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; } }

  /* :checked wires the active tab and shows the panel (sibling numbering) */
  &-radio:nth-of-type(1):checked ~ &-list &-tab:nth-child(1) { @apply border-primary text-foreground; }
  &-radio:nth-of-type(1):checked ~ &-panel:nth-of-type(1)    { @apply block; }
}
```

---

## tooltip

**Purpose.** A hint by a trigger. The base agnostic pattern is **pure CSS, no JS**: visibility via
variants driven by the trigger's own state.

**Required states.** The bubble shows on the trigger's `:hover` **AND** `:focus-visible` (keyboard and
screen reader also get the hint). `focus-visible`, not `focus` — no flash on a mouse click. The hidden bubble
is `pointer-events-none` + `invisible`, so it doesn't catch the mouse.

**Accessibility.** `role="tooltip"` on the bubble + `aria-describedby` on the trigger link them. The trigger is a real
`<button type="button">` (in tab order); a non-interactive trigger would need `tabindex="0"`. Don't rely on hover only.
The enter animation — `@starting-style`/`starting:` + `motion-reduce`. Positioning: absolute+translate
today; **CSS anchor positioning** (a native CSS feature — `anchor-name` / `position-anchor` / `position-area`; Tailwind has no dedicated utilities for it, so reach for arbitrary properties — with auto-flip on overflow) is an optional progressive enhancement.

**Approach A:** `group` on the trigger, an absolute bubble:
```html
<span class="relative inline-block">
  <button type="button" aria-describedby="tip" class="group h-10 px-4 rounded-md border border-border bg-background
    text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Hover/focus</button>
  <span id="tip" role="tooltip"
    class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 w-max rounded-md
           bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md
           opacity-0 invisible translate-y-1 transition-[opacity,transform,visibility] duration-150 ease-out
           starting:opacity-0 motion-reduce:transition-none
           group-hover:visible group-hover:translate-y-0 group-hover:opacity-100
           group-focus-visible:visible group-focus-visible:translate-y-0 group-focus-visible:opacity-100">Tip</span>
</span>
```

**Approach B** (reveal via `:has()` on the block):
```scss
.tooltip { @apply relative inline-block;
  &-bubble {
    @apply absolute bottom-full left-1/2 z-10 -translate-x-1/2;
    @apply mb-2 px-2 py-1;
    @apply rounded-md bg-foreground shadow-md;
    @apply text-background text-xs font-medium;
    @apply opacity-0 invisible translate-y-1;                /* closed frame */
    @apply transition-[opacity,transform,visibility] duration-150 ease-out motion-reduce:transition-none;
    @apply pointer-events-none;
    @starting-style { @apply opacity-0; }
  }
  &:has(.tooltip-trigger:hover) .tooltip-bubble,
  &:has(.tooltip-trigger:focus-visible) .tooltip-bubble { @apply opacity-100 visible translate-y-0; }
}
```

---

## breadcrumb

**Purpose.** The navigation path to the current page.

**Required states.** Item links: `:hover` (color), `:focus-visible` (ring). The current item is not
interactive.

**Accessibility.** `<nav aria-label="Breadcrumb">` → `<ol>` → `<li>`. Intermediate items — `<a>`; the last one —
NOT a link, but a `<span aria-current="page">`. The "/" separator is a decorative `before:content-['/']` (NOT text in
the DOM, the screen reader doesn't announce it); on the first item it's suppressed with `first:before:content-none`.

**Approach A:**
```html
<nav aria-label="Breadcrumb">
  <ol class="flex flex-wrap items-center gap-1.5 text-sm">
    <li class="flex items-center gap-1.5 before:text-muted-foreground before:content-['/'] first:before:content-none">
      <a href="/" class="rounded-sm text-muted-foreground transition-colors hover:text-foreground
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Home</a>
    </li>
    <li class="flex items-center gap-1.5 before:text-muted-foreground before:content-['/'] first:before:content-none">
      <span aria-current="page" class="font-medium text-foreground">Current</span>
    </li>
  </ol>
</nav>
```

**Approach B:**
```scss
.breadcrumb {
  &-list { @apply flex flex-wrap items-center gap-1.5 text-sm; }
  &-item {
    @apply flex items-center gap-1.5;
    &::before { @apply text-muted-foreground content-['/']; }
    &:first-child::before { @apply content-none; }
  }
  &-link {
    @apply rounded-sm text-muted-foreground transition-colors duration-150;
    &:hover { @apply text-foreground; }
    &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
    &_current { @apply font-medium text-foreground; }      /* = aria-current="page" */
  }
}
```

---

## pagination

**Purpose.** Page-by-page navigation: numbers + prev/next.

**Required states.** Page links and prev/next: `:hover`, `:focus-visible`, `:active`. The current
page is emphasized, not interactive. prev/next at the edge are "disabled".

**Accessibility.** `<nav aria-label="Pagination">` → `<ul>`. The current page is a `<span aria-current="page">`
(not a link). prev/next at the edge are `<span aria-disabled="true">` (a link can't truly be `disabled`):
not focusable, not clickable (`pointer-events-none`). The ellipsis `…` is `aria-hidden`. On a narrow container the
numbers collapse into a compact "Page X of Y" status via `@container` (`@max-sm:`).

**Approach A (fragment):**
```html
<div class="@container"><nav aria-label="Pagination"><ul class="flex items-center gap-1">
  <li class="@max-sm:hidden"><span aria-current="page"
    class="inline-flex h-9 min-w-9 items-center justify-center px-3 rounded-md border border-transparent
           bg-primary text-sm font-medium text-primary-foreground select-none">6</span></li>
  <li class="@max-sm:hidden"><a href="?page=7"
    class="inline-flex h-9 min-w-9 items-center justify-center px-3 rounded-md border border-border bg-background
           text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground
           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-accent/80">7</a></li>
  <li class="hidden grow justify-center @max-sm:flex"><span class="text-sm font-medium text-muted-foreground">Page 6 of 12</span></li>
</ul></nav></div>
```

**Approach B:**
```scss
.pagination { @apply @container;
  &-list { @apply flex items-center gap-1; }
  &-item { @apply flex items-center;
    &_numbered { @apply @max-sm:hidden; }                  /* numbers hidden on narrow */
    &_status   { @apply hidden grow items-center justify-center @max-sm:flex; } }
  &-link {
    @apply inline-flex items-center justify-center h-9 min-w-9 px-3;
    @apply rounded-md border border-border bg-background;
    @apply text-sm font-medium text-foreground;
    @apply transition-colors duration-150 motion-reduce:transition-none select-none;
    &:hover { @apply bg-accent text-accent-foreground; }
    &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
    &:active { @apply bg-accent/80; }
    &_current { @apply border-transparent bg-primary text-primary-foreground; } /* = aria-current */
  }
  &-prev_disabled, &-next_disabled {                        /* = aria-disabled on span */
    @apply text-muted-foreground opacity-50 cursor-not-allowed pointer-events-none; }
}
```

---

## table

**Purpose.** A semantic data table.

**Required states.** The table itself is static; the interactive layers are: zebra (`even:bg-muted/40`), row hover
(`hover:bg-muted/60`), sticky header (`sticky top-0 z-10`). The scroll wrapper is focusable (`tabindex="0"`) →
a visible `focus-visible` is mandatory.

**Accessibility.** Native `<table>`/`<caption>`/`<thead>`/`<tbody>`/`<tfoot>`. `<caption>` (`sr-only`) — the table's
name. `<th scope="col">` for columns, `<th scope="row">` for the row name. Numeric columns — right-aligned +
`tabular-nums`. Duplicate the status tone with a **word**, not color alone. The scroll wrapper is `role="region"` +
`aria-label` + `tabindex="0"` (otherwise it can't be scrolled with the keyboard). Responsiveness — `@container` + `overflow-auto`.
**Sorting/filtering are NOT part of the skeleton**: only the `aria-sort` semantics are given; real click-to-sort is
~20+ lines of native JS (flag it TODO); **we don't imitate a framework**.

**Approach A (fragment):**
```html
<div role="region" aria-label="Invoices, scrollable" tabindex="0"
  class="@container max-h-80 w-full overflow-auto rounded-lg border border-border bg-card text-card-foreground
         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
  <table class="w-full border-collapse text-sm">
    <caption class="sr-only">Team invoices</caption>
    <thead class="sticky top-0 z-10 bg-muted text-muted-foreground">
      <tr class="border-b border-border">
        <th scope="col" class="px-3 py-2.5 text-left font-medium @md:px-4">Client</th>
        <th scope="col" aria-sort="ascending" class="px-3 py-2.5 text-right font-medium @md:px-4">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr class="border-b border-border even:bg-muted/40 hover:bg-muted/60 transition-colors">
        <th scope="row" class="px-3 py-2.5 text-left font-medium @md:px-4">Acme</th>
        <td class="px-3 py-2.5 text-right tabular-nums @md:px-4">$1,200.00</td>
      </tr>
    </tbody>
  </table>
</div>
```

**Approach B:**
```scss
.dataTable {
  @apply @container max-h-80 w-full;
  @apply rounded-lg border border-border bg-card text-card-foreground;
  @apply overflow-auto;
  &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }

  &-table { @apply w-full border-collapse text-sm; }
  &-caption { @apply sr-only; }
  &-thead { @apply sticky top-0 z-10 bg-muted text-muted-foreground; }
  &-head  { @apply px-3 py-2.5 @md:px-4 border-b border-border text-left font-medium select-none;
    &_numeric { @apply text-right; } }
  &-row   { @apply border-b border-border transition-colors duration-150 motion-reduce:transition-none;
    &:nth-child(even) { @apply bg-muted/40; }              /* zebra */
    &:hover { @apply bg-muted/60; } }
  &-cell  { @apply px-3 py-2.5 @md:px-4; &_numeric { @apply text-right tabular-nums; } }
  &-status { @apply inline-flex items-center px-2 py-0.5 rounded-sm bg-muted text-xs font-medium text-muted-foreground;
    &_paid { @apply bg-success/15 text-success; } &_overdue { @apply bg-danger/15 text-danger; } }
}
```

---

## popover

**Purpose.** A floating panel by a trigger. Built on the **native Popover API** (`popovertarget` on
the button + the `popover` attribute on the panel): click toggle, light-dismiss (click outside), Esc, and rendering in
the top layer (the panel above everything, no `z-index` wars) — **from the platform, no JS**.

**Required states.** The trigger: `:hover`, `:focus-visible`, `:active`, `:disabled`. Items
inside are real `<button>`/`<a>` with the full set of states. The panel's open state is the native
`:popover-open` (the **`[&:popover-open]:`** variant — there's no built-in `popover-open:` in v4). The enter —
`@starting-style` + `transition-discrete` (the panel is `display:none` until opened).

**Accessibility.** The trigger is `<button type="button">` with `aria-expanded` (sync it with the panel's
state via the `toggle` event — **needs ~JS**, don't imitate a framework) and `aria-controls`. The panel is a
named group via `aria-labelledby` → id of the heading. Chevron — `aria-hidden`. A destructive item —
`text-danger` tone + a word.

**What it demonstrates from v4.** The Popover API + `[&:popover-open]:`, `@starting-style`/`starting:` via
a `display` transition, `::backdrop` via `backdrop:`. An optional upgrade — CSS anchor positioning (a native
CSS feature — `anchor-name` / `position-anchor` / `position-area`; Tailwind has no dedicated utilities, so use
arbitrary properties: `[anchor-name:--menuBtn]` on the trigger, `[position-anchor:--menuBtn]` + `[position-area:bottom]` on the panel).

**Approach A:**
```html
<div class="relative inline-block">
  <button type="button" popovertarget="pop" aria-expanded="false" aria-controls="pop"
    class="group inline-flex h-10 items-center gap-2 px-4 rounded-md border border-border bg-background
           text-sm font-medium hover:bg-muted
           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Options</button>
  <div id="pop" popover aria-labelledby="pop-h"
    class="absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 m-0 w-56
           rounded-lg border border-border bg-card text-card-foreground shadow-lg
           opacity-0 scale-95 transition-[opacity,transform,display,overlay] duration-200 transition-discrete
           [&:popover-open]:opacity-100 [&:popover-open]:scale-100
           starting:[&:popover-open]:opacity-0 backdrop:bg-foreground/10">…</div>
</div>
```

**Approach B:**
```scss
.popover {
  @apply relative inline-block;
  &-trigger { @apply inline-flex h-10 items-center gap-2 px-4 rounded-md border border-border bg-background text-sm font-medium;
    &:hover { @apply bg-muted; } &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; } }
  &-panel {
    @apply absolute left-1/2 top-full z-10 -translate-x-1/2 m-0 mt-2 w-56;
    @apply rounded-lg border border-border bg-card text-card-foreground shadow-lg;
    @apply opacity-0 scale-95 transition-[opacity,transform,display,overlay] duration-200 transition-discrete;
    &:popover-open { @apply opacity-100 scale-100; }
    @starting-style { &:popover-open { @apply opacity-0 scale-95; } }
    &::backdrop { @apply bg-foreground/10; }
  }
  &-item { @apply inline-flex w-full items-center gap-2 px-2 py-1.5 rounded-sm text-sm;
    &:hover { @apply bg-accent text-accent-foreground; }
    &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
    &_danger { @apply text-danger; &:hover { @apply bg-danger/10; } } }
}
```

---

## dropdown

**Purpose.** An actions menu that opens from a trigger. The base agnostic pattern is **native
`<details>`/`<summary>`**: open/close, Enter/Space/Esc/Tab come from the platform, **no JS** (the popover API is a
drop-in alternative). Closing after a selection is a one-line native statement
`onclick="this.closest('details').open=false"` (not a framework).

**Required states.** The trigger (`<summary>`): `:hover`, `:focus-visible`, `:active`. Items —
`:hover`/`:focus-visible` share a soft `accent` surface. Open is the native `[open]`
(`group-open:`/`[open]`), not a JS class. The menu's enter — `@starting-style`/`starting:`.

**Accessibility. HONEST LIMITATION (flag it explicitly).** This is a correct **disclosure**, **not** a
WAI-ARIA `role="menu"`: a full keyboard menu (roving tabindex, Arrow/Home/End, type-ahead, focus return
on Esc) is ~15 lines of native JS. So we do NOT slap on `role="menu"/menuitem`, which would
promise the screen reader behavior that doesn't exist without JS; we provide real `<a>`/`<button>` (Tab passes through them) and flag the
limit. `<summary>` carries `aria-haspopup="menu"`; the native marker is hidden. A destructive item — tone +
a word.

**What it demonstrates from v4.** `<details>` disclosure without JS, `group-open:`, `@starting-style`/
`starting:` for the menu's enter, an honest flag for the ARIA boundary.

**Approach A:**
```html
<details class="group relative w-fit">
  <summary aria-haspopup="menu"
    class="inline-flex h-10 min-w-44 cursor-pointer list-none items-center justify-between gap-2 px-3
           rounded-md border border-border bg-background text-sm font-medium hover:bg-muted
           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
           [&::-webkit-details-marker]:hidden">
    <span>Options</span>
    <svg aria-hidden="true" class="size-4 transition-transform group-open:rotate-180">…</svg>
  </summary>
  <ul class="absolute left-0 top-full z-20 mt-2 w-56 p-1 rounded-md border border-border bg-card text-card-foreground shadow-lg
             opacity-0 -translate-y-1 transition-[opacity,transform] duration-150
             group-open:opacity-100 group-open:translate-y-0 starting:group-open:opacity-0">
    <li><a href="#" onclick="this.closest('details').open=false"
      class="flex w-full gap-2 px-2 py-1.5 rounded-sm text-sm hover:bg-accent hover:text-accent-foreground
             focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">View profile</a></li>
  </ul>
</details>
```

**Approach B:**
```scss
.dropdown {
  @apply relative w-fit;
  &-trigger { @apply inline-flex h-10 min-w-44 items-center justify-between gap-2 px-3 rounded-md border border-border bg-background text-sm font-medium;
    @apply cursor-pointer select-none list-none; &::-webkit-details-marker { @apply hidden; }
    &:hover { @apply bg-muted; } &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; } }
  &-icon { @apply size-4 shrink-0 text-muted-foreground transition-transform duration-200; }
  &-menu { @apply absolute left-0 top-full z-20 mt-2 w-56 p-1 rounded-md border border-border bg-card text-card-foreground shadow-lg;
    @apply opacity-0 -translate-y-1 transition-[opacity,transform] duration-150; }
  &-item { @apply flex w-full items-center gap-2 px-2 py-1.5 rounded-sm text-sm;
    &:hover { @apply bg-accent text-accent-foreground; }
    &:focus-visible { @apply outline-2 outline-offset-2 outline-ring bg-accent text-accent-foreground; }
    &_danger { @apply text-danger; &:hover { @apply bg-danger text-danger-foreground; } } }
  &-separator { @apply my-1 h-px bg-border; }
  &[open] { .dropdown-icon { @apply rotate-180; } .dropdown-menu { @apply opacity-100 translate-y-0; } }
  @starting-style { &[open] .dropdown-menu { @apply opacity-0 -translate-y-1; } }
}
```

---

## drawer

**Purpose.** An off-canvas panel at the edge of the screen. **The native `<dialog>`** via `showModal()`
(focus trap and inert background come from the platform); the panel's side is a block modifier. Closing —
`<form method="dialog">`/Esc.

**Required states.** Buttons inside — button states (`:hover`/`:focus-visible`/`:active`/
`:disabled`). Slide-in: the panel is parked off the edge with `translate-x-full`, opening is `open:translate-x-0`,
the enter — `@starting-style`/`starting:` + `transition-discrete` (`display`/`overlay` stay animatable).

**Accessibility.** `<dialog>` itself sets `role="dialog"` + `aria-modal`; add `aria-label` (the panel's
name) and `aria-labelledby` → id of the heading. `showModal()` (not `show()`). Esc-closing is native. Respect
`motion-reduce`.

**What it demonstrates from v4.** An off-canvas slide via `translate` + `open:`/`starting:` +
`transition-discrete`, the `::backdrop` animation, the side as a BEM modifier (`drawer_right`/`drawer_left`),
`h-dvh`.

**Approach A (right edge):**
```html
<dialog aria-label="Settings panel" aria-labelledby="d-title"
  class="ml-auto right-3 h-dvh max-h-dvh w-full max-w-sm m-0 p-0
         rounded-none border-l border-border bg-card text-card-foreground shadow-lg
         translate-x-full transition-[translate,display,overlay] duration-300 transition-discrete
         motion-reduce:transition-none open:translate-x-0 starting:open:translate-x-full
         backdrop:bg-foreground/40 backdrop:opacity-0 backdrop:transition-discrete backdrop:open:opacity-100">
  <div class="flex h-full flex-col">
    <header class="flex shrink-0 items-start justify-between gap-4 border-b border-border p-4">
      <h2 id="d-title" class="text-base font-semibold">Settings panel</h2>
      <form method="dialog" class="contents"><button type="submit" aria-label="Close drawer" class="…">×</button></form>
    </header>
    <div class="flex-1 overflow-y-auto p-4 text-sm text-muted-foreground">…</div>
  </div>
</dialog>
```

**Approach B:**
```scss
.drawer {
  @apply h-dvh max-h-dvh w-full max-w-sm m-0 p-0;
  @apply rounded-none bg-card text-card-foreground shadow-lg;
  @apply transition-[translate,display,overlay] duration-300 ease-out transition-discrete motion-reduce:transition-none;
  &::backdrop { @apply bg-foreground/40 opacity-0 transition-[opacity,display,overlay] duration-300 transition-discrete; }
  &[open]::backdrop { @apply opacity-100; }
  @starting-style { &[open]::backdrop { @apply opacity-0; } }
  &-panel { @apply flex h-full flex-col; }
  &-close { @apply -m-1 inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground;
    &:hover { @apply bg-muted text-foreground; } &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; } }

  &_right { @apply ml-auto right-3 border-l border-border translate-x-full; /* modifier: right edge */
    &[open] { @apply translate-x-0; } @starting-style { &[open] { @apply translate-x-full; } } }
  &_left  { @apply mr-auto left-3 border-r border-border -translate-x-full;  /* mirrored left */
    &[open] { @apply translate-x-0; } @starting-style { &[open] { @apply -translate-x-full; } } }
}
```

---

## progress

**Purpose.** A progress indicator. **The native `<progress>`** (the role and `value`/`max` for the screen reader —
for free). Determinate (has `value`) and indeterminate (`max` without `value`). **No JS** in the skeleton
(live progress — updating the `value` attribute, ~JS outside the skeleton).

**Required states.** None interactive. The determinate fill animates its width with
`transition-[width]` + `motion-reduce`; indeterminate — a loop via `@keyframes` (bound to a hook class/
pseudo-element, **not** `@apply` inside `@keyframes`).

**Accessibility.** `<progress>` itself is an ARIA progressbar; don't write the role/`aria-valuenow` by hand.
Link it to a visible `<label for>`/`id`. The percent text is decorative (`aria-hidden`) — the value is already announced by
the element (no double reading). Indeterminate — no `value` (and no numeric announcement), but its visible `<label for>`
still names it; **don't** add an `aria-label` that differs from the label (it would override the visible text — a WCAG 2.5.3 Label-in-Name mismatch).

**What it demonstrates from v4.** Restyling the native `<progress>` via per-engine pseudo-elements
(`[&::-webkit-progress-bar]`/`[&::-webkit-progress-value]`/`[&::-moz-progress-bar]`), `appearance-none`,
`transition-[width]`. `rounded-full` here is a **legitimate pill** (a thin bar), not over-rounding.

**Approach A (determinate):**
```html
<label for="up" class="text-sm font-medium">Uploading file</label>
<progress id="up" max="100" value="60"
  class="block h-2 w-full appearance-none overflow-hidden rounded-full bg-muted
         [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted
         [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary
         [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-300
         [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary
         motion-reduce:[&::-webkit-progress-value]:transition-none">60%</progress>
```

**Approach B:**
```scss
.progress {
  @apply flex w-full flex-col gap-1.5;
  &-label { @apply text-sm font-medium text-foreground; }
  &-value { @apply text-sm tabular-nums text-muted-foreground; }  /* decorative percent, aria-hidden */
  &-bar {
    @apply block h-2 w-full appearance-none overflow-hidden rounded-full bg-muted; /* pill — legitimate */
    &::-webkit-progress-bar { @apply rounded-full bg-muted; }
    &::-webkit-progress-value { @apply rounded-full bg-primary; @apply transition-[width] duration-300 ease-out motion-reduce:transition-none; }
    &::-moz-progress-bar { @apply rounded-full bg-primary; }
    &_indeterminate { @apply relative;                            /* max without value */
      &::-moz-progress-bar { @apply bg-transparent; }
      &::before { @apply absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary; content: ""; /* loop — raw @keyframes */ } }
  }
}
```

---

## spinner-skeleton

**Purpose.** Two loading-state patterns. **spinner** — an indeterminate ring
(`border` + `border-t-transparent` + `animate-spin`) for a fixed wait. **skeleton** —
pulsing placeholders (`animate-pulse`) in place of the content. Pure CSS, **no JS**.

**Required states.** None interactive. **Both animations must turn off** under
`motion-reduce:animate-none` (vestibular sensitivity); the spinner stays a "loading ring",
the skeleton — static shapes.

**Accessibility.** spinner — `role="status"` + a visually hidden `<span class="sr-only">` (the ring is
decorative → `aria-hidden`). skeleton — the container has `aria-busy="true"` + `aria-label`; the placeholders are
`aria-hidden="true"`. `rounded-full` — only for the ring and a round avatar placeholder; text
lines are `rounded-sm`.

**What it demonstrates from v4.** `animate-spin`/`animate-pulse` + the mandatory `motion-reduce:animate-none`,
`rounded-full` discipline (only circle/pill/spinner).

**Approach A:**
```html
<div role="status" class="inline-flex items-center gap-3">
  <span aria-hidden="true"
    class="inline-block size-6 rounded-full border-2 border-border border-t-transparent animate-spin motion-reduce:animate-none"></span>
  <span class="text-sm text-muted-foreground">Loading…</span>
  <span class="sr-only">Loading</span>
</div>
<div aria-busy="true" aria-label="Loading content" class="flex max-w-sm gap-4 rounded-lg border border-border bg-card p-6">
  <span aria-hidden="true" class="size-12 shrink-0 rounded-full bg-muted animate-pulse motion-reduce:animate-none"></span>
  <div class="flex flex-1 flex-col gap-3">
    <span aria-hidden="true" class="h-4 w-2/3 rounded-sm bg-muted animate-pulse motion-reduce:animate-none"></span>
    <span aria-hidden="true" class="h-3 w-full rounded-sm bg-muted animate-pulse motion-reduce:animate-none"></span>
  </div>
</div>
```

**Approach B:**
```scss
.spinner { @apply inline-block size-6 shrink-0 rounded-full border-2 border-border border-t-transparent;
  @apply animate-spin motion-reduce:animate-none; }                /* ring — rounded-full legitimate */
.skeleton { @apply flex max-w-sm items-start gap-4 rounded-lg border border-border bg-card p-6; }
.skeleton-avatar { @apply size-12 shrink-0 rounded-full bg-muted animate-pulse motion-reduce:animate-none; }
.skeleton-line   { @apply h-3 w-full rounded-sm bg-muted animate-pulse motion-reduce:animate-none;
  &_title { @apply h-4 w-2/3; } }                                  /* lines — rounded-sm, not full */
```

---

## avatar

**Purpose.** A user representation: `<img>` with an initials fallback, sizes, a status dot,
an overlapping group. Pure HTML + CSS, **no JS** (the fallback is the native `onerror="this.hidden=true"`).

**Required states.** Static (a clickable one inherits the button/link ones). The fallback sits
**under** the `<img>`; on a 404 the image hides and the initials show through.

**Accessibility.** A meaningful `<img>` carries a real `alt` (the name); the initials layer is `role="img"` + `aria-label`
(the name) — a roleless `<span>`/`<div>` maps to `role="generic"`, on which `aria-label` is ignored, so the fallback **must**
carry an explicit role to be named — plus an `aria-hidden` glyph. Status is **not color alone** — a `sr-only` word ("Online") sits next to it. The group
overflow counter is `aria-label="5 more people"`.

**What it demonstrates from v4.** `size-*`, `ring-2 ring-background` to separate overlapping avatars and
status pills, `-space-x-*` for the stack. `rounded-full` — a **legitimate canonical circle** (an avatar).

**Approach A:**
```html
<span class="relative inline-flex size-10 shrink-0 overflow-hidden rounded-full bg-muted">
  <span role="img" aria-label="Ada Lovelace"
    class="absolute inset-0 inline-flex items-center justify-center text-sm font-medium text-muted-foreground">
    <span aria-hidden="true">AL</span></span>
  <img src="./ada.jpg" alt="Ada Lovelace" onerror="this.hidden=true" class="relative size-full rounded-full object-cover" />
</span>
<!-- status: <span class="absolute bottom-0 right-0 size-3 rounded-full bg-success ring-2 ring-background"><span class="sr-only">Online</span></span> -->
```

**Approach B:**
```scss
.avatar {
  @apply relative inline-flex shrink-0 items-center justify-center size-10;
  @apply overflow-hidden rounded-full bg-muted;                             /* circle is legitimate */
  @apply text-sm font-medium text-muted-foreground select-none;
  &-image    { @apply relative size-full rounded-full object-cover; }
  &-fallback { @apply absolute inset-0 inline-flex items-center justify-center; }
  &-status   { @apply absolute bottom-0 right-0 inline-flex size-3 rounded-full bg-success ring-2 ring-background; }
  &_sm { @apply size-8 text-xs; } &_lg { @apply size-14 text-base; }        /* size modifiers */
  &_ringed { @apply ring-2 ring-background; }                               /* for overlapping in a group */
}
.avatarGroup { @apply flex -space-x-3; }                                    /* a separate stack block */
```

---

## toast

**Purpose.** A region of pop-up notifications: info/success/warning/danger tones, an icon, a title,
a body, a close button. Structure + style; queue/auto-timers/click-to-close — **needs ~JS**
(there's no CSS-only way to remove a node on a timer/click; not a framework).

**Required states.** The close button — the full set (`:hover`/`:focus-visible`/`:active`/
`:disabled`). Enter/leave — `@starting-style`/`starting:` + `transition-discrete` (`display`
animated); `motion-reduce`.

**Accessibility.** The region — `role="region"` + `aria-label` (a landmark). A toast — `role="status"`
`aria-live="polite"` (info/success/warning, without stealing focus); danger — `role="alert"` (assertive,
interrupts). Close — `<button type="button" aria-label>` (the content is a decorative `aria-hidden` glyph).
The tone is duplicated by the title, not color alone. `pointer-events-none` on the region + `pointer-events-auto` on the toast.

**What it demonstrates from v4.** `@starting-style`/`starting:` enter/leave via a `display` transition,
the tone as a BEM modifier (recolors only the border+icon, the surface stays `bg-card`),
an honest ~JS flag.

**Approach A (a single toast):**
```html
<section role="region" aria-label="Notifications"
  class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-2 p-4 sm:inset-x-auto sm:right-0">
  <div role="status" aria-live="polite"
    class="pointer-events-auto relative flex w-full max-w-sm items-start gap-3
           rounded-lg border border-border bg-card p-4 pr-10 text-card-foreground shadow-lg
           opacity-100 translate-y-0 transition-[opacity,transform,display] duration-200 transition-discrete
           motion-reduce:transition-none starting:opacity-0 starting:translate-y-2">
    <svg aria-hidden="true" class="mt-0.5 size-5 shrink-0 text-muted-foreground">…</svg>
    <div class="flex min-w-0 flex-col gap-0.5">
      <p class="text-sm font-semibold leading-none">Update available</p>
      <p class="text-sm text-muted-foreground">A new version is ready.</p></div>
    <button type="button" aria-label="Dismiss notification"
      class="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground
             hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">×</button>
  </div>
</section>
<!-- danger: role="alert" + border-danger/40 + text-danger on the icon -->
```

**Approach B:**
```scss
.toastRegion { @apply fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-2 p-4 sm:inset-x-auto sm:right-0;
  @apply pointer-events-none; }
.toast {
  @apply relative flex items-start gap-3 w-full max-w-sm p-4 pr-10;
  @apply rounded-lg border border-border bg-card text-card-foreground shadow-lg; /* neutral base */
  @apply opacity-100 translate-y-0 transition-[opacity,transform,display] duration-200 transition-discrete motion-reduce:transition-none;
  @apply pointer-events-auto;
  @starting-style { @apply opacity-0 translate-y-2; }                      /* enter */
  &-icon  { @apply mt-0.5 size-5 shrink-0 text-muted-foreground; }
  &-close { @apply absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground;
    &:hover { @apply bg-muted text-foreground; } &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; } }
  &_success { @apply border-success/40; .toast-icon { @apply text-success; } } /* tone: border+icon */
  &_warning { @apply border-warning/40; .toast-icon { @apply text-warning; } }
  &_danger  { @apply border-danger/40;  .toast-icon { @apply text-danger;  } }
}
```

---

## copy-to-clipboard

**Purpose.** A button that copies a short nearby value (a token, an address, a code) to the clipboard.
Structure + style + the accessibility wiring; the actual copy + the transient "Copied" revert is
**~JS** (no CSS-only way to read the clipboard or flip-and-revert state on a timer — flag it, don't hide it).

**Required states.** The trigger — the full button set (`:hover`/`:focus-visible`/`:active`/`:disabled`).
On success show a **visible** state change (label/icon swap to "Copied" + a check, then revert) — sighted
users see it.

**Accessibility (mandatory wiring — a control acting on a nearby value).** Give the value an `id` and point
the trigger at it with **`aria-describedby`** (id on the value, `aria-describedby` on the button), so the
control's accessible description includes *which* value it copies — the generic name "Copy" alone never tells
a screen-reader user what gets copied. A visible label/icon swap is **not** reliably announced on its own, so
add an `aria-live` region: a permanently-present, empty-at-rest `role="status"` `aria-live="polite"` element
(`sr-only`) whose **text** is updated to "Copied to clipboard" on success (and cleared on revert) — never
move or recreate it, only change its text, or the announcement can drop. The copy glyph is decorative
(`aria-hidden`); meaning lives in the text.

**What it demonstrates from v4.** The full interactive state set on a real `<button type="button">`,
`motion-reduce:transition-none` on the swap, and the value→trigger `aria-describedby` + live-region pattern.
Full implementation (with the dependency-free `~JS` glue) in `examples/copy-to-clipboard/`.

---

## list

**Purpose.** A list / list-group: `<ul>` → `<li>` with clickable rows (a leading icon,
a title + secondary text, trailing meta/badge). One row is active. Pure HTML, **no JS**.

**Required states.** A row (`<a>`): `:hover`, `:focus-visible`, `:active`. The active one — `aria-current="page"` + visual emphasis (`bg-muted` + a left accent via inset `box-shadow`, so as not to
shift the content with a border).

**Accessibility.** The container is a native `<ul aria-label>` (not a `<div>`), the items are `<li>`. A clickable
row is a real `<a>` (or `<button>`). The leading icon is decorative (`aria-hidden`). Status meta
is duplicated with a **word** (not color alone). Draw the focus ring inward (`-outline-offset-2`), so the
container's `overflow-hidden` doesn't clip it.

**What it demonstrates from v4.** `divide-y divide-border` (separators between `<li>`, without an extra bottom
line), `overflow-hidden` to snap the rows to the radius, `truncate`/`min-w-0`, the active row as an
element modifier `list-item_active`.

**Approach A:**
```html
<ul aria-label="Projects"
  class="w-full max-w-md overflow-hidden divide-y divide-border rounded-lg border border-border bg-card text-card-foreground">
  <li><a href="/orbit" aria-current="page"
    class="group flex items-center gap-3 px-4 py-3 bg-muted shadow-[inset_2px_0_0_0_var(--color-primary)] text-sm
           transition-colors hover:bg-muted
           focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:bg-muted">
    <svg aria-hidden="true" class="size-5 shrink-0 text-foreground">…</svg>
    <span class="flex min-w-0 flex-col">
      <span class="truncate font-medium text-foreground">Orbit</span>
      <span class="truncate text-muted-foreground">Updated yesterday</span></span>
    <span class="ml-auto h-5 px-2 inline-flex items-center rounded-sm bg-primary text-xs font-medium text-primary-foreground">3</span>
  </a></li>
</ul>
```

**Approach B:**
```scss
.list {
  @apply w-full max-w-md overflow-hidden rounded-lg border border-border bg-card divide-y divide-border text-card-foreground;
  &-item {
    @apply flex items-center gap-3 px-4 py-3 text-sm transition-colors duration-150 motion-reduce:transition-none;
    &:hover { @apply bg-muted; }
    &:focus-visible { @apply outline-2 -outline-offset-2 outline-ring; } /* ring inward — overflow doesn't clip */
    &:active { @apply bg-muted; }
    &_active { @apply bg-muted; box-shadow: inset 2px 0 0 0 var(--color-primary); } /* = aria-current="page" */
  }
  &-leading  { @apply size-5 shrink-0 text-muted-foreground; }
  &-content  { @apply flex min-w-0 flex-col; }
  &-title    { @apply truncate font-medium text-foreground; }
  &-subtitle { @apply truncate text-muted-foreground; }
  &-meta     { @apply ml-auto inline-flex shrink-0 items-center h-5 px-2 rounded-sm bg-muted text-xs font-medium text-muted-foreground;
    &_accent { @apply bg-primary text-primary-foreground; } &_success { @apply bg-success/15 text-success; } }
}
```

---

## media

**Purpose.** A responsive image/media: `<figure>` with `<img>`/`<picture>` + `<figcaption>`.
Keep the aspect ratio on the **wrapper** (`aspect-video`/`aspect-square`) + `object-cover` on the `<img>`, so an
image of any size doesn't break the frame. Pure HTML + CSS, **no JS**.

**Required states.** Static (none interactive).

**Accessibility.** A meaningful image has a real `alt`; `<figcaption>` describes/captions it.
A purely decorative one — `alt=""` + `role="presentation"` (the screen reader skips it). An overlay caption
stays **real text** (not "baked" into the image); the contrast is a gradient scrim. `loading="lazy"`
+ `decoding="async"`.

**What it demonstrates from v4.** `aspect-video`/`aspect-square` on the wrapper + `object-cover`, `<picture>`
art direction, **`bg-linear-to-t`** (not `bg-gradient-to-t`) as a scrim for the caption (an opaque
gradient **only** for contrast — not glass/slop). `rounded-lg`, **not** `rounded-full`.

**Approach A:**
```html
<figure class="flex w-full max-w-md flex-col gap-2">
  <div class="aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
    <img src="./landscape.jpg" alt="Wide mountain ridge under an overcast sky"
      loading="lazy" decoding="async" class="size-full object-cover" />
  </div>
  <figcaption class="text-sm text-muted-foreground">A short caption describing the image.</figcaption>
</figure>
<!-- decorative: <img alt="" role="presentation" class="h-auto w-full rounded-lg …" /> -->
```

**Approach B:**
```scss
.figure {
  @apply flex w-full max-w-md flex-col gap-2;
  &-media   { @apply relative w-full overflow-hidden rounded-lg border border-border bg-muted; }
  &-image   { @apply size-full object-cover; }
  &-caption { @apply text-sm text-muted-foreground; }       /* caption UNDER the media by default */

  &_video  { .figure-media { @apply aspect-video; } }       /* aspect ratio — block modifier */
  &_square { .figure-media { @apply aspect-square; } }
  &_plain  { .figure-image { @apply h-auto w-full rounded-lg border border-border bg-muted; } } /* decorative in flow */
  &_overlay { @apply relative;                               /* overlay caption */
    .figure-caption {
      @apply absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-4;
      @apply bg-linear-to-t from-foreground/70 to-transparent; /* scrim, NOT bg-gradient-to-* */
      @apply text-sm font-medium text-background; } }
}
```

---

## An alternative to variants via `data-*` (an agnostic CVA replacement)

In JS frameworks, variants are often described via **CVA** (`cva({ variants: { variant: { primary: … } } })`).
It's convenient but requires a JS dependency and ties you to the framework. The **agnostic replacement** is to drive
the variant via a `data-` attribute in the markup and a selector in CSS. The variant name lives in HTML (easy to set
from any template engine/without JS), and the style is in one place.

**Markup** (one class + data attributes):
```html
<button type="button" class="button" data-variant="primary" data-size="sm">Label</button>
<button type="button" class="button" data-variant="danger">Delete</button>
```

**Approach A — with selectors in CSS** (variation without bloating the class list):
```css
.button[data-variant="primary"] { @apply bg-primary text-primary-foreground; }
.button[data-variant="primary"]:hover { @apply bg-primary/90; }
.button[data-variant="danger"]  { @apply bg-danger  text-danger-foreground; }
.button[data-size="sm"]         { @apply h-8 px-3 text-xs; }
```

**Approach B — attribute selectors inside a BEM block:**
```scss
.button {
  @apply inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md text-sm font-medium;
  &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
  &:disabled { @apply opacity-50 pointer-events-none; }

  &[data-variant="primary"] { @apply bg-primary text-primary-foreground;
    &:hover { @apply bg-primary/90; } }
  &[data-variant="danger"]  { @apply bg-danger text-danger-foreground;
    &:hover { @apply bg-danger/90; } }
  &[data-size="sm"] { @apply h-8 px-3 text-xs; }
}
```

**In the utility-first approach A**, the same choice can be made via a **`data-*` variant** right in the markup —
without a separate CSS file:
```html
<span data-variant="success"
  class="inline-flex h-5 items-center px-2 rounded-sm text-xs font-medium
         data-[variant=success]:bg-success/15 data-[variant=success]:text-success
         data-[variant=danger]:bg-danger/15 data-[variant=danger]:text-danger">Status</span>
```

**When to choose what.** `data-*` + selector — when the variants are finite, driven by data/state, and
reused; it gives CVA's declarativeness without a JS dependency and works the same in both approaches.
Direct token-class swapping in the markup (approach A) is simpler for one-off cases. **An optional JS layer:**
if you're already inside a JS framework, `cva()`/`clsx`/`tailwind-merge`/`cn()` solve the same task type-safely —
but it's a layer on top of the same utilities, not the foundation; in pure HTML/CSS it isn't needed.
