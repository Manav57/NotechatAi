# Master checklist: "is my Tailwind v4 correct?"

A single scannable set of checks before submitting code/examples — one line per item, with checkboxes,
grouped by topic. This is the **entry point**: it consolidates the overlapping checks from the review, the evals axes,
and the component invariants. Full explanations, tables, and "before → after" pairs are **not duplicated** —
each block links to its source. Pass every `[x]` and the code is correct on the v4 technical wiring
(the design layer sets the visual direction, not this checklist).

Token names are canonical semantic ones (`bg-primary`/`text-primary-foreground`, `bg-muted`/
`-foreground`, `bg-card`/`-foreground`, `border-border`, `bg-input`, `ring-ring`/`outline-ring`,
`bg-success`/`-warning`/`-danger` + `-foreground`, `rounded-sm/md/lg/xl`); values are placeholders.

Sources (where to go for the "why" and the details):
`references/review.md` (12 review items + layer audit) · `evals/README.md` (11 behavior axes) ·
`references/components.md` (cross-cutting component invariants) · `resources/v3-to-v4-cheatsheet.md`
(v3→v4 renames) · `resources/gotchas-list.md` (engine gotchas) · `resources/tokens-table.md`
(tokens) · `resources/property-order.md` + `resources/apply-grouping.md` (`@apply` order).

---

## 1. v4 syntax (not v3)

Details and the full list of renames — `resources/v3-to-v4-cheatsheet.md`, `resources/gotchas-list.md`;
axis 1 in `evals/README.md`; item 1 in `references/review.md`.

- [ ] Entry point — `@import "tailwindcss";`, not `@tailwind base/components/utilities`.
- [ ] Config in CSS-first `@theme`; JS config only via `@config "…"` and only when there is real dynamism.
- [ ] Custom utilities — `@utility name { … }`, not `@layer utilities`/`@layer components`.
- [ ] Custom variants — `@custom-variant`/`@variant`, not JS plugins.
- [ ] Translucency — slash (`bg-primary/90`), not `bg-opacity-*`.
- [ ] Gradients — `bg-linear-to-r` (`bg-conic-*`/`bg-radial-*`), not `bg-gradient-to-*`.
- [ ] Arbitrary CSS variable — `bg-(--brand)`, not `bg-[--brand]`.
- [ ] Value renames applied: `shadow-sm→shadow-xs`, `shadow→shadow-sm`, `rounded-sm→rounded-xs`, `blur-sm→blur-xs`.
- [ ] v3 appears ONLY as the "before" in a before→after pair, never as a recommendation.

## 2. Class detection / no dynamic names

Details — `resources/gotchas-list.md` (the "Class detection" section); axis 5 in `evals/README.md`;
items 2–3 in `references/review.md`.

- [ ] Every class is present as a FULL literal in the source.
- [ ] No names assembled by concatenation/interpolation (`text-${tone}-500`, `'bg-' + color`).
- [ ] A class coming from data/CMS is mapped value→ready string, not a template with a partial literal.
- [ ] `@source inline(...)` is a last resort, not the default approach.

## 3. Tokens vs arbitrary

Details and before→after pairs — `references/review.md` §3.4; tokens — `resources/tokens-table.md`;
axes 3–4 and 9 in `evals/README.md`; items 5–6 in `references/review.md`.

- [ ] A repeated arbitrary value (`[#hex]`, `[18px]`, `[0_2px_8px_…]`) is extracted into `@theme`/`@utility`.
- [ ] Promotion is not limited to arbitrary values: a focus-ring / transition / state pattern of standard utilities repeated on 3+ elements is also a custom-`@utility` candidate.
- [ ] A one-off arbitrary is used sparingly and deliberately; accumulated repetition is not.
- [ ] System-level colors/radii/shadows/spacing go through semantic names, not literals.
- [ ] Font tokens use ROLE names (`--font-heading`/`--font-body`/`--font-mono`), NOT `--font-display` — `display` is also the `@font-face` `font-display` descriptor and a real CSS keyword, so the name shadows it.
- [ ] Dark mode is done by overriding tokens under `.dark`, NOT with a scatter of `dark:` on every element.

## 4. States + visible focus

Details — `references/components.md` (cross-cutting rules 1–2); axis 7 in `evals/README.md`;
item 9 in `references/review.md`.

- [ ] An interactive element carries `:hover` + `:focus-visible` + `:active` + `:disabled` (not just `hover`).
- [ ] Focus — `:focus-visible` (not `:focus`); the canonical ring is `outline-2 outline-offset-2 outline-ring`. Repeated on 3+ elements? Extract it into a custom `@utility focus-ring { @apply outline-2 outline-offset-2 outline-ring; }` and reuse that one pattern everywhere.
- [ ] The focus-ring technique is ONE canonical pattern across the whole site — not re-authored per component. No sibling controls showing mixed `outline-*` vs `ring-*` focus (e.g. one button on `ring-2 ring-ring` while its neighbours use `outline-2 outline-offset-2 outline-ring`).
- [ ] `outline-none` is never left anywhere without a `ring`/`outline-ring` replacement.
- [ ] Every transform/opacity transition and every `animate-*` carries a reduced-motion alternative: utility `motion-reduce:transition-none`/`motion-reduce:animate-none`, or in Approach B `@media (prefers-reduced-motion: reduce) { @apply transition-none; }`.
- [ ] States and motion are consistent across similar components.

## 5. Form validation — `user-invalid:`

Details — `references/components.md` (input-field, checkbox/radio/switch, select, textarea);
harness check in `evals/README.md`.

- [ ] Client-side validation — `user-invalid:`, NOT `:invalid`/`invalid:`/`peer-invalid:` (those color an empty required field immediately).
- [ ] Server result — via `[aria-invalid="true"]`/the block modifier `*_invalid`.
- [ ] The error is duplicated as text and linked with `aria-describedby`, not conveyed by color alone.
- [ ] The `inert:` variant is NOT used — it does not exist; use the native `inert` attribute + `opacity-50`.

## 6. Contrast and contrast pairs

Details — `references/components.md` (cross-cutting rule 4); axis 7 in `evals/README.md`; item 10 in `references/review.md`.

- [ ] Token pairs are used together: `bg-primary`+`text-primary-foreground`, `bg-muted`+`text-muted-foreground`, `bg-card`+`text-card-foreground`.
- [ ] No `text-foreground` over `bg-primary` and similar "non-native" pairs.
- [ ] States (`disabled`, `hover`) do not push contrast below the threshold.
- [ ] The surface-to-background border — `border-border` (a border requires BOTH a width AND a color; see `resources/gotchas-list.md`).

## 7. Responsive + container queries

Details — `references/components.md` (responsive-grid, pagination, table); axis 10 in `evals/README.md`; item 11 in `references/review.md`.

- [ ] The base is unprefixed; changes progress upward at larger breakpoints (`md:`, `lg:`), mobile-first.
- [ ] Sizing comes from the parent's width, not the window — via `@container` + `@sm:`/`@md:`, not viewport alone.
- [ ] Decisive criterion for a grid: cells are REUSABLE components (cards) → wrap the grid in `@container` and switch columns with `@sm:`/`@md:` so cells reflow by the grid's own width; a one-off page section's internal layout → viewport (`md:`/`lg:`) is fine. Flag viewport-only column switches on a reusable-card grid.
- [ ] No breakpoints that were removed from the project are used.

## 8. `@apply` grouping + BEM (Approach B)

Details and the canonical order — `resources/property-order.md`, `resources/apply-grouping.md`,
`references/review.md` §2; axis 6 in `evals/README.md`; items 7–8 in `references/review.md`.

- [ ] Group order: layout → sizing → spacing → background/borders/shape → typography → effects → interaction, then states, then modifiers.
- [ ] Each group is a separate `@apply` line with a short comment; no "dumping" everything into one line.
- [ ] No nested `@apply` of your own component classes (`@apply .button;`) and no `@apply` inside `@keyframes`.
- [ ] BEM (default, configurable per project): block `cardList`, block modifier `cardList_compact`, element `cardList-item`, element modifier `cardList-item_active`, key-value `cardList_size_lg` (element `-`, modifier `_`; camelCase; a modifier never stands alone, no `-a-b` element-of-element chains).
- [ ] No dead modifier — including the default-value case: a default key-value modifier (`button_size_md`, `card_tone_default`) whose `@apply` set just repeats what the base already applies is dead (emitted on every instance, overrides nothing). Make the base neutral and carry geometry/tone in the modifiers, OR make the bare block the default and emit no class for it. Details — `references/review.md` §3.5.
- [ ] In isolated CSS (a CSS module/`<style>`) there is a `@reference "…";` at the top.

## 9. Third-party / CMS / generated DOM is scoped

Details — `references/review.md` item 4 and §3.5; invariant axes in `references/components.md`.

- [ ] Uncontrolled markup (rich-text/widget/CMS) is wrapped in a scope (`.richText`/the Typography plugin), not styling `h1/p/ul/table` globally.
- [ ] If JS replaces the DOM (`<i>`→`<svg>`, injects wrappers) — selectors target the FINAL DOM, not the placeholder.

## 10. No AI slop

Details and the debranding checklist — `references/review.md` §5; axis 8 in `evals/README.md`; item 12 and cross-cutting rule 6 in `references/components.md`.

- [ ] No purple-blue (or any random "pretty") gradients without justification.
- [ ] No glassmorphism: a translucent surface (`bg-*/<alpha>`) + `backdrop-blur` for the effect's sake, on ANY element — cards, sticky headers/navbars, overlays. (A modal scrim may be translucent, but do not add `backdrop-blur` to it; the blur is the slop signal.)
- [ ] No excessive rounding; `rounded-full` — only for a circle/pill/avatar/spinner/thin bar.
- [ ] No decorative "blobs", random shadows, or extra animation "for the wow factor".
- [ ] The example is skeletal and neutral — it shows structure and wiring, not "design".

## 11. §3A — mapping an external design system

Details and the layer audit — `references/review.md` §4 and item 6; axes 2 and 9 in `evals/README.md`.

- [ ] An external design system/`DESIGN.md`/ready-made tokens are PASSED THROUGH into `@theme` under stable names, not reinvented.
- [ ] Values are placeholders; only token NAMES are stable; there is no hardcoding around the tokens.
- [ ] No visual direction is dictated (palette/fonts/radii as "correct"); the code sets the method, not the taste.
- [ ] On conflict, the design system takes priority; the skill only insists on Tailwind v4 correctness.
- [ ] No mentions of third-party skills/brands/projects/non-Tailwind technologies; the JS wiring (`cn()`/clsx/tailwind-merge/CVA) is only an optional aside "if you are in a JS framework".
- [ ] The output is plain HTML + CSS/SCSS; no Vue/React/Nuxt/Svelte/JSX/Pinia/Vite.
- [ ] The two approaches A/B are equal; the choice follows the decision tree and is stated, and BEM+`@apply` is not presented as a "failure of utilities".

## 12. Accessibility

Details — `references/components.md` (cross-cutting rules 1–5, per-component); axis 7 in `evals/README.md`; item 10 in `references/review.md`.

- [ ] Semantic markup: `<button type>`, `<a>`, `<input>`+`<label for>`, the native `<dialog>` — not a `<div>` with a handler.
- [ ] Multi-page site with a persistent header/nav: a skip link (bypass blocks) is the FIRST focusable element — `sr-only` that reveals on focus (`focus-visible:not-sr-only`), pointing at `<main id="main" tabindex="-1">`, so keyboard users skip the repeated chrome on every page.
- [ ] Visually-hidden text for the screen reader via `sr-only` (status/name not conveyed by visible text).
- [ ] A control acting on a specific nearby value (copy-to-clipboard next to the code/IP it copies, a reset/clear button for an adjacent field) links that value with `aria-describedby` (value `id` → control), so the value is part of the control's accessible description — not just a generic name like "Copy IP address".
- [ ] Animations/transitions are suppressed under `motion-reduce:transition-none` / `motion-reduce:animate-none`.
- [ ] `forced-colors:` is accounted for where color carries meaning (high-contrast must not break states).
- [ ] Tone/status is duplicated in words, not by color alone; decorative icons — `aria-hidden`.
- [ ] Honest ARIA boundaries are flagged (CSS-only tabs/dropdown/table-sort are not strict APG; the full pattern needs ~JS, and we do not emulate a framework).
