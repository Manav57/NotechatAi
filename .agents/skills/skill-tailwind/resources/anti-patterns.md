# Anti-patterns — "before → after" gallery

The positive counterpart to the **NEVER** list in `SKILL.md`. For each prohibition — a short
**Wrong → Correct** pair with minimal code and a one-line "why". Scan top to bottom:
the left block is how the model writes by inertia (v3 habit, AI-slop, an a11y/token/BEM misstep),
the right is the v4 canon.

> This is a supplementary cheat sheet, not a reference. Rationale and subtleties — `references/v4-rules.md`
> (Wrong→Correct→Why, numbered rules) and `references/gotchas.md` (silent gotchas). The full
> list of prohibitions — the "Anti-patterns (NEVER)" section in `SKILL.md`. Migration tables —
> `resources/v3-to-v4-cheatsheet.md`; one-line gotchas — `resources/gotchas-list.md`. We don't
> duplicate them here, but give a visual "before/after" pair under each NEVER.

Token values in the examples are placeholders; only the **names** are stable.

---

## 1. Entry point: `@tailwind` → `@import`

```css
/* Wrong */                          /* Correct */
@tailwind base;                     @import "tailwindcss";
@tailwind components;
@tailwind utilities;
```

Why: the `@tailwind` directives are removed in v4; the entry point is a single `@import`, which expands into the
`theme → base → utilities` layers.

---

## 2. Config without a reason: `tailwind.config.js` → `@theme`

```js                              /* Wrong */
// tailwind.config.js
module.exports = { theme: { extend: { colors: { primary: "#2563eb" } } } };
```

```css                             /* Correct */
@import "tailwindcss";
@theme { --color-primary: oklch(52% 0.12 255); }   /* value is a placeholder */
```

Why: config in v4 lives in CSS; `--color-primary` itself generates `bg-primary`/`text-primary`/
`border-primary` and slash-opacity. A JS config — only for real JS dynamics, via
`@config "…"`.

---

## 3. Opacity: `bg-opacity-*` → slash

```html
<!-- Wrong -->                                <!-- Correct -->
<div class="bg-primary bg-opacity-50">        <div class="bg-primary/50">
```

Why: the `*-opacity-*` families are removed; opacity is set with the slash modifier directly on the color
(`bg-primary/50`, `text-foreground/75`, `border-border/60`).

---

## 4. Gradient: `bg-gradient-to-*` → `bg-linear-to-*`

```html
<!-- Wrong -->                                       <!-- Correct -->
<div class="bg-gradient-to-r from-muted to-card">     <div class="bg-linear-to-r from-muted to-card">
```

Why: `bg-gradient-*` is renamed to `bg-linear-*` (plus `bg-radial-*`, `bg-conic-*`); the old name
does not work in v4.

---

## 5. Custom utility: `@layer utilities` → `@utility`

```css
/* Wrong */                                    /* Correct */
@layer utilities {                              @utility content-auto {
  .content-auto { content-visibility: auto; }     content-visibility: auto;
}                                               }
```

Why: only via `@utility` does the engine correctly sort the utility in the cascade and give it variants
(`hover:content-auto`). A functional one — `@utility tab-* { … }` (the `-*` suffix is required).

---

## 6. CSS variable in arbitrary: `bg-[--var]` → `bg-(--var)`

```html
<!-- Wrong -->                        <!-- Correct -->
<div class="bg-[--brand]">            <div class="bg-(--brand)">
```

Why: a reference to a CSS variable in v4 uses parentheses `(--var)`; square brackets `[--var]` are interpreted
differently and don't produce the expected result. Square brackets remain for literals (`top-[117px]`).

---

## 7. Dynamic class name: concatenation → full literal / `@source inline`

```html
<!-- Wrong: the scanner doesn't see a literal -->   <!-- Correct: variant = the whole class -->
<span class="text-{{ tone }}-500">               <span class="text-accent">
```

```css
/* if the dynamics can't be removed — a targeted safelist of the WHOLE classes that appear: */
@source inline("text-tier-fly text-tier-elite text-tier-admin");
```

Why: the scanner looks for **literal** substrings and does not execute code; gluing the name together does not produce a full
class → no CSS is generated. Map variants onto whole strings; the last resort is `@source inline(…)`.

---

## 8. `@apply` in `@keyframes` / without `@reference`

```css
/* Wrong: @apply inside @keyframes */          /* Correct: keyframes — pure CSS */
@keyframes pulse {                              @keyframes pulse {
  50% { @apply opacity-50; }                      50% { opacity: 0.5; }
}                                               }

/* Wrong: scoped/module without context */     /* Correct: pull in the theme by reference */
.card_title { @apply text-card-foreground; }    @reference "../app.css";
                                                .card_title { @apply text-card-foreground; }
```

Why: `@apply` is forbidden inside `@keyframes` (that's plain CSS there). In isolated `<style>`/
CSS modules the theme is not visible — you need `@reference "…"` to the entry CSS, otherwise an "unknown class" error.

---

## 9. Hidden "utility soup" → a deliberate component class or extracting markup

```html
<!-- Wrong: dozens of utilities dumped into one "semantic" class for the sake of clean markup -->
<style>.card { @apply relative flex flex-col gap-2 w-full p-4 bg-card border border-border
  rounded-md shadow-xs text-card-foreground text-sm transition-shadow … } </style>
```

```html
<!-- Correct (A): extract the repeated MARKUP into a partial/fragment, the utilities stay in the HTML -->
<article class="flex flex-col gap-2 p-4 bg-card border border-border rounded-md">…</article>
```

```scss
/* Correct (B): a deliberate component class — BEM + @apply, grouped by property type */
@reference "../app.css";
.card {
  @apply relative flex flex-col gap-2;
  @apply w-full p-4;
  @apply bg-card border border-border rounded-md shadow-xs;
  @apply text-card-foreground text-sm;
  @apply transition-shadow;
}
```

Why: hiding "soup" in a class for the sake of "clean markup" is bad `@apply`. The cure is either extracting the
**markup** (approach A, rung 2 of the ladder) or a **deliberate** component class with grouped
`@apply` (approach B). The difference is intent and grouping, not "hiding". The A/B decision tree and the
"good/bad `@apply`" rule — `references/approaches.md`.

---

## 10. Hardcoded hex → semantic token

```html
<!-- Wrong -->                                       <!-- Correct -->
<div class="bg-[#2563eb] text-[#ffffff]               <div class="bg-primary text-primary-foreground
            border-[#e5e7eb]">                                    border border-border">
```

Why: `bg-[#hex]` scatters the design system across the markup — the value isn't reused, isn't
themeable, doesn't reach `.dark`. Define the color once with a token in `@theme`; if it comes from an
external design system — **map** it, don't override it (§3A `SKILL.md`).

---

## 11. Form validation: `invalid:` → `user-invalid:`

```html
<!-- Wrong: turns red before input -->           <!-- Correct: only after interaction -->
<input class="invalid:border-danger">            <input class="user-invalid:border-danger">
```

Why: `:invalid` fires immediately on load (an empty required field is already invalid) — the field
turns red before the user has typed anything. `:user-invalid` highlights only after
interaction/submit. More details — `docs/accessibility.md`.

---

## 12. Breakpoint inside CSS: `@screen` → `@variant`

```scss
/* Wrong: v3 directive, REMOVED in v4 */     /* Correct (shorthand): @variant <bp> */
@screen md {                                  @variant md {
  .cardGrid { @apply grid-cols-3; }             @apply grid-cols-3;
}                                             }
```

```css
/* Correct (codemod form): plain media query against the breakpoint token */
@media (width >= theme(--breakpoint-md)) { /* … */ }
```

Why: `@screen` is **gone** in v4 — the compiler does **not** error, it passes the at-rule through
**verbatim**; the browser ignores the unknown rule and the wrapped styles are **silently dropped**. To
apply a breakpoint inside custom CSS / a component class, use `@variant md { @apply … }` (it compiles to
`@media (width >= 48rem) { … }` and `@apply` works inside it) or the explicit `@media (width >=
theme(--breakpoint-md))` form. In Approach B, when one element gathers **many** breakpoint utilities
(more than ~2-4 same-prefix, or one breakpoint flipping several property groups), grouping the overrides
into a single `@variant <bp>` block (mobile base on the normal grouped lines) reads better — see
`resources/apply-grouping.md`. A 1-2 utility flip stays inline; don't push viewport responsiveness
wholesale into SCSS.

---

## 13. Status token as decoration → accent / a dedicated category token

```html
<!-- Wrong: a STATE token (danger) used for a category/tier badge -->
<span class="bg-danger text-danger-foreground">Admin</span>
```

```html
<!-- Correct: a neutral accent, or a dedicated category token -->
<span class="bg-accent text-accent-foreground">Admin</span>
<span class="bg-tier-admin text-tier-admin-foreground">Admin</span>   <!-- if you define tier tokens -->
```

```css
/* dedicated category tokens — plain @theme, still themeable; values are placeholders */
@theme {
  --color-tier-fly:   oklch(72% 0.10 200);
  --color-tier-elite: oklch(80% 0.12 90);
  --color-tier-admin: oklch(62% 0.13 25);
}
```

Why: `success`/`warning`/`danger`/`info` are reserved for **state feedback** — a `danger` badge says
"something is wrong", not "this is the Admin tier". Repurposing them as a tone palette overloads their
meaning and drifts across pages (the same tier picks a different status hue each time, proving the choice
is appearance-driven). For categorical decoration (tiers, tags, brands) use `--color-accent` or dedicated
`--color-tier-*` tokens, and pin **one meaning = one token** so the mapping is stable everywhere. The
status-vs-categorical rule — `references/tokens.md`; the decision branch — `resources/decision-trees.md`.

---

## 14. Soft status: `bg-status/NN text-status` → a defined `*-subtle` pair

```html
<!-- Wrong: ad-hoc opacity tint + the SOLID hue as text; contrast unverified, theme-dependent -->
<span class="bg-success/15 text-success">Online</span>
```

```html
<!-- Correct: a governed, contrast-checked subtle pair -->
<span class="bg-success-subtle text-success-subtle-foreground">Online</span>
```

```css
/* define the pair once (values are placeholders; add .dark overrides) */
@theme {
  --color-success-subtle: color-mix(in oklab, var(--color-success) 15%, transparent);
  --color-success-subtle-foreground: oklch(40% 0.06 150);   /* legible on the tint */
}
```

Why: pairing an opacity-tinted surface with the **base** hue as foreground (`bg-success/15 text-success`)
is an ungoverned pattern — its contrast depends on whatever sits behind it and isn't verified across
themes. A status pill should be **either** solid `bg-<status> text-<status>-foreground` **or** a defined
`*-subtle` pair — never `bg-<status>/NN text-<status>`. The subtle-surface recipe — `references/tokens.md`.

---

## 15. Reusing button styles by nesting a link in a button (a11y) → put the classes on the right tag

```html
<!-- Wrong: an <a> that navigates nested inside a styled <button> -->
<button class="button button_primary">
  <a href="/play">Play</a>
</button>
```

```html
<!-- Correct: a thing that NAVIGATES is <a>; a thing that ACTS is <button>. -->
<!-- The `button` block styles apply to either tag; the focus ring sits on the focusable element. -->
<a href="/play" class="button button_primary">Play</a>
<button type="button" class="button button_primary">Buy</button>
```

Why: a `<button>` may not contain interactive content — `<button><a></a></button>` is invalid HTML, gives
two tab stops, announces conflicting button/link roles, and lands the focus ring on the wrong (non-navigating)
node. Don't wrap a link to borrow button styling; make the button block **polymorphic** and put its classes —
and the `focus-visible:` ring — on the element that actually does the job. The rule — `docs/accessibility.md`
§3 (pick the tag by behavior, not appearance).

---

## 16. One-off PAGE layout modeled as a giant block → keep it in markup utilities

```scss
/* Wrong: a non-reused page collapsed into one block with 20+ single-use elements (utility-soup relocated) */
.homePage {
  &-hero { @apply flex flex-col gap-6 py-16; }
  &-heroInner { @apply mx-auto max-w-3xl text-center; }
  &-eyebrow { @apply text-sm text-muted-foreground; }
  &-title { @apply text-4xl font-semibold; }
  /* …~25 more elements each used exactly once… */
}
```

```html
<!-- Correct: one-off page layout stays as utilities in the markup — even on an Approach-B site -->
<section class="flex flex-col gap-6 py-16">
  <div class="mx-auto max-w-3xl text-center">
    <p class="text-sm text-muted-foreground">…</p>
    <h1 class="text-4xl font-semibold">…</h1>
  </div>
</section>
```

Why: Approach B is for **repeated named primitives** (button/card/badge/field). A one-off page that is
never reused — and whose "elements" each appear once — gains nothing from a block; it's the hidden
utility-soup of §9 wearing a semantic name (harder to reason about than the markup it replaces). One-off
PAGE layout (hero/sections/spec lists) stays in markup utilities regardless of the project's A/B
convention. The "reused 2+ times?" branch — `resources/decision-trees.md`; the A/B routing —
`references/approaches.md` §7.

---

## 17. Same affordance re-authored across blocks → one reusable block + modifiers/mix

```scss
/* Wrong: the same control re-typed as a `-copy` element in three unrelated blocks, drifting per page */
.appHeader { &-copy { @apply h-9 px-3 rounded-md border border-border bg-background; } }
.homePage  { &-copy { @apply h-10 px-4 rounded-md border border-border; } }
.playPage  { &-copy { @apply h-10 px-4 rounded-md bg-primary text-primary-foreground; } }
```

```html
<!-- Correct: extract ONE reusable block that owns all its shared behavior, then reuse / mix it -->
<button type="button" class="copyButton">Copy IP</button>

<!-- positioned inside a parent via a BEM mix (block + parent's element, no re-authoring) -->
<button type="button" class="copyButton appHeader-copy">Copy IP</button>
```

Why: when the same affordance (a copy button, an IP/tag chip, a badge) keeps reappearing as an ad-hoc
element inside several blocks — and worse, drifts in size/color from one to the next — that's a
**duplicated affordance**, not three elements. Extract one block that owns its shared behavior and reuse
it; when it must sit inside a parent block, position it with a **BEM mix** (the standalone block stays
margin-free and owns its appearance; the parent's element supplies only external geometry). One affordance
= one block. The mix mechanism and the smell — `references/approaches.md` §7.

---

## 18. AI-slop (purple-blue / glass) → neutral tokens

```html
<!-- Wrong: loud gradient + "glass" + blobs -->
<div class="bg-gradient-to-br from-purple-500 to-blue-600 backdrop-blur-lg bg-white/10
            rounded-3xl shadow-2xl">
```

```html
<!-- Correct: semantic tokens, restrained shape -->
<div class="bg-card text-card-foreground border border-border rounded-lg shadow-sm">
```

```html
<!-- Wrong: the same "glass" trick on a sticky header/navbar (translucent surface + backdrop-blur) -->
<header class="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
```

```html
<!-- Correct: solid, opaque chrome -->
<header class="sticky top-0 z-40 border-b border-border bg-background">
```

Why: purple-blue gradients, excessive rounding, and decorative blobs are typical AI defaults that impose
a visual direction. The glass effect is **any translucent surface (`bg-*/<alpha>`) + `backdrop-blur`
used for looks** — not just on cards: a blurred translucent sticky header/navbar or overlay is the same
slop, so reach for opaque semantic tokens there too (`bg-background`/`bg-card`/`border-border`/`rounded-lg`).
A neutral token gradient (`from-muted to-card`) is acceptable; a loud one is not. The skill is responsible
for Tailwind correctness, not for style.

**Narrow exception — scrims.** An intentional modal/dialog scrim **may** use a translucent background
(the skill's dialog/drawer backdrop does, `backdrop:bg-foreground/40`) — but do **not** add `backdrop-blur`
to it; the blur is the slop signal, the dimming alpha is fine.

---

## 19. Translucent alpha on resting page chrome → the opaque token

```scss
/* Wrong: a resting alpha on a structural sticky surface — content scrolling under bleeds through */
.appHeader { @apply sticky top-0 z-40 border-b border-border bg-background/95; }
```

```scss
/* Correct: the OPAQUE semantic token for chrome the page scrolls through */
.appHeader { @apply sticky top-0 z-40 border-b border-border bg-background; }
```

Why: distinct from the glass item above (no `backdrop-blur` here, so it isn't full glassmorphism), a
**resting** alpha like `bg-background/95` on page-level chrome (sticky header/footer/sidebar) lets the
content underneath bleed through — resting surfaces the page scrolls past should use the opaque token
(`bg-background`, `bg-card`). Reserve alpha for interaction-state tweaks (`hover:bg-primary/90`),
intentional scrims/overlays, and translucent **TINT layers stacked over a parent surface** — which are
legitimate and **not** flagged: zebra rows (`even:bg-muted/40`), a `tfoot` tint (`bg-muted/30`), and the
like. The difference: a tint sits over a known opaque parent; resting chrome sits over arbitrary
scrolling content.

---

## 20. Font token named after a CSS keyword → a role-based name

```css
/* Wrong: --font-display shadows the @font-face `font-display` descriptor + the `display` keyword */
@theme {
  --font-display: ui-monospace, "JetBrains Mono", monospace;   /* generates the `font-display` utility */
}
```

```css
/* Correct: role-based font tokens (values are placeholders) */
@theme {
  --font-heading: ui-monospace, "JetBrains Mono", monospace;   /* → font-heading */
  --font-body:    ui-sans-serif, system-ui, sans-serif;        /* → font-body   */
  --font-mono:    ui-monospace, monospace;                     /* → font-mono   */
}
```

Why: `display` is both a CSS property and the `@font-face` `font-display` descriptor, so a `--font-display`
token shadows a real CSS keyword/descriptor — the generated `font-display` utility reads as if it set
`display`, and the name is the one to avoid. Name font tokens by **role** (`heading`/`body`/`mono`/`brand`),
the same way colors are named by role, not by their look. The token-naming rule — `references/tokens.md`.

---

## 21. Default-size modifier that repeats the base → neutral base or no class for the default

```scss
/* Wrong: the base hardcodes the `md` geometry AND a button_size_md modifier re-applies the same thing */
.button {
  @apply h-10 px-4;            /* base is NOT size-neutral — it already is `md` */
  @apply text-sm font-medium;
  &_size_md { @apply h-10; @apply px-4; @apply text-sm; }   /* dead: overrides nothing, emitted on every button */
}
```

```scss
/* Correct: base stays size-neutral; each size modifier carries its own geometry */
.button {
  @apply inline-flex items-center justify-center;   /* structural only — no fixed height/padding/size */
  @apply font-medium;
  &_size_sm { @apply h-8;  @apply px-3; @apply text-xs; }
  &_size_md { @apply h-10; @apply px-4; @apply text-sm; }   /* now the real carrier of the `md` look */
  &_size_lg { @apply h-12; @apply px-6; @apply text-base; }
}
```

```html
<!-- Alternative correct: declare the bare block the default and emit NO class for it -->
<button class="button">Default (md) — no size modifier</button>
<button class="button button_size_lg">Large</button>
```

Why: a key-value modifier for an axis's **default** (`button_size_md`) whose entire `@apply` set equals what
the base already applies is a **dead modifier** — it is emitted on every instance yet overrides nothing, and
it contradicts a base that claims to be size-neutral while hardcoding the `md` geometry. Either move all
geometry into the modifiers (base = structural) or let the bare block *be* the default and emit a class only
for the non-default sizes. The dead-modifier smell (default-value case) — `references/review.md` §3.5.

---

## 22. Focus ring re-authored per component → one canonical promoted pattern

```scss
/* Wrong: sibling controls draw focus two different ways */
.button       { &:focus-visible { @apply outline-none ring-2 ring-ring ring-offset-2; } }
.themeToggle  { &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; } }
.appHeader-link { &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; } }
```

```css
/* Correct: promote ONE focus primitive to a utility, used everywhere (canonical form) */
@utility focus-ring {
  @apply outline-2 outline-offset-2 outline-ring;
}
```

```scss
/* every control's :focus-visible reuses the one pattern */
.button       { &:focus-visible { @apply focus-ring; } }
.themeToggle  { &:focus-visible { @apply focus-ring; } }
.appHeader-link { &:focus-visible { @apply focus-ring; } }
```

Why: the visible-focus technique must be **one** pattern across the whole site, not re-authored per
component. When a button uses `ring-2 ring-ring ring-offset-*` while its neighbours use `outline-2
outline-offset-2 outline-ring`, two adjacent controls show different keyboard-focus visuals (a gapped
box-shadow ring vs a solid outline) — a defect even though each form is individually valid. Pick the
canonical form, and once it lands on 3+ controls promote it to `@utility focus-ring` and `@apply` it in
every `:focus-visible`. The consistency rule and promotion threshold — `references/review.md` §1 items 5/9.

---

## 23. Act-on-value control with a generic name → link the value via `aria-describedby`

```html
<!-- Wrong: the copy button never tells the screen reader WHICH value it copies -->
<code class="copyIp-value">play.example:25565</code>
<button type="button" class="copyIp-button" aria-label="Copy server IP address">Copy</button>
```

```html
<!-- Correct: the value has an id; the control references it so the value is part of its description -->
<code id="copyIpValue" class="copyIp-value">play.example:25565</code>
<button type="button" class="copyIp-button"
        aria-label="Copy server IP address"
        aria-describedby="copyIpValue">Copy</button>
```

Why: a control that acts on a specific nearby value (a copy-to-clipboard button beside the code/IP it copies,
a reset/clear button for an adjacent field) should reference that value with `aria-describedby` — give the
value node an `id`, point `aria-describedby` at it. The screen reader then announces the value as part of the
control's accessible description ("Copy server IP address, play.example:25565"), so the user hears *which*
value the action targets, not just a generic label. The pattern — `docs/accessibility.md` §4.1.

---

## Two "important" forms (a common confusion, not from the NEVER numbers above)

```css
/* Globally on the ENTIRE utilities layer */   /* Targeted on ONE class */
@import "tailwindcss" important;         <div class="bg-danger!">
```

Why: these are different things. The global flag goes in the import line; the targeted one is a **suffix** `!` at the end of the
class (not the v3 prefix `!bg-danger`). And both ≠ `prefix(tw)`. Disambiguation — `references/v4-rules.md` §13.

---

## Memo

- The left block of each pair is **for recognition only**; don't copy it into new code.
- `inert:` as a variant **does not exist** — don't invent it; for non-interactivity use the `inert` attribute +
  if needed an `[inert]:` selector / `pointer-events-none`.
- `@screen` and `screen()` are **removed** in v4 and fail **silently** (no error, styles dropped) — §12 covers
  the `@variant` / `@media (width >= theme(--breakpoint-*))` replacements.
- The review checklist for these items — `references/review.md`; a step-by-step breakdown — `workflows/review-tailwind.md`.
