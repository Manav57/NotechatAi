# Eval cases — `skill-tailwind`

11 behavioral cases. Each one: **id**, **Prompt** (what we ask — give verbatim to the agent with the skill),
**What's good** (success signals), **Failure** (anti-signals; any = score 0), **Tests** (axis/part
of the skill). Scale and procedure — `README.md`. Fixtures — `fixtures/`.

> Token names are canonical (`bg-primary`/`text-primary-foreground`, `bg-muted`/`-foreground`,
> `bg-card`/`-foreground`, `border-border`, `bg-input`, `ring-ring`/`outline-ring`,
> `bg-success`/`bg-warning`/`bg-danger` + `*-foreground`, `rounded-sm/md/lg/xl`). Values are
> placeholders; the names are stable.

---

## EV-01 · Migration v3 → v4 (CSS + markup)

**Prompt.** "Here is the current CSS and HTML from the project (see `fixtures/v3-snippet.css` and
`fixtures/v3-snippet.html`). We are moving to Tailwind v4. Rewrite it for v4 correctly."

**What's good.**
- `@tailwind base/components/utilities;` → `@import "tailwindcss";`.
- `@layer utilities { .x {} }` → `@utility x { … }`.
- `important: true`-style → `@import "tailwindcss" important;` **or** the `bg-danger!` suffix (with
  the caveat that these are **different** importants).
- In the markup: `bg-opacity-50` → slash `/50`; `bg-gradient-to-r` → `bg-linear-to-r`; `bg-[#hex]` →
  token or `bg-(--var)`; old `shadow-sm` → `shadow-xs` (the rename shift is mentioned).
- Changes presented as before → after with a brief "why".

**Failure.**
- Any v3 form left as the recommended final result (`@tailwind`, `bg-opacity-*`,
  `bg-gradient-to-*`, `@layer utilities` for a utility, `bg-[--var]`).
- `important: true` moved into the JS config without need; the two importants conflated.

**Tests.** Axis 1 (v4, not v3). `references/v4-rules.md`, `resources/v3-to-v4-cheatsheet.md`.

---

## EV-02 · Choosing approach A vs B for a component

**Prompt.** "I need a card list component with several states (normal / compact / selected). The markup
is generated from a CMS and we don't edit it. How should I organize the styles in Tailwind and why?"

**What's good.**
- Explicitly chooses **B (BEM + `@apply`)** with a reason: the markup is third-party/generated and not
  extracted into a partial → we give the style a name without touching the DOM.
- The approach is framed as a **deliberate choice** of the upper rungs of the abstraction ladder, not a "failure of utilities".
- A criterion from the decision tree is named (repeated markup + third-party DOM + number of states).
- Names follow the BEM convention: `cardList`, `cardList-item`, `cardList-item_active`, `cardList_compact`.

**Failure.**
- Rigid "always utilities" / "always BEM" without tying it to context.
- Approach B called bad practice / "dirty".
- For uncontrolled CMS DOM, rewriting the markup with utilities is proposed.

**Tests.** Axis 2 (A/B are equal, a deliberate choice). `references/approaches.md`, decision tree §1.

---

## EV-03 · Introducing design tokens (no hex)

**Prompt.** "Make a primary button and a card look nice with Tailwind classes. The brand color is roughly
blue, the rounding moderate."

**What's good.**
- Color/radius are set up as semantic tokens in `@theme` (`--color-primary`, `--radius-lg`, etc.),
  used by name (`bg-primary`, `rounded-lg`), the value marked as a placeholder.
- A contrast token pair: `bg-primary` + `text-primary-foreground`, `bg-card` + `text-card-foreground`.
- If "blue" is used once and incidentally — a frugal `bg-(--brand)`/arbitrary value is acceptable, but
  on repetition — a token.

**Failure.**
- A scatter of `bg-[#hex]`/`p-[18px]` repeated throughout the code without extraction into a token.
- A hardcoded palette presented as "correct" instead of placeholders.
- Contrast assembled arbitrarily (`text-foreground` on `bg-primary`).

**Tests.** Axis 3 (tokens, not hex). `references/tokens.md`, the "where a token lives" tree §2.

---

## EV-04 · Dark mode (token-driven, not a scatter of `dark:`)

**Prompt.** "Add dark mode support to a set of components (button, card, input) in Tailwind v4."

**What's good.**
- The theme is implemented by overriding **tokens** under `.dark` (`@custom-variant dark (&:where(.dark, .dark *))`
  + `.dark { --color-background: …; … }`), the values being placeholders.
- The component markup does **not** carry `dark:` variants: they work "for free" because the color is a token.
- The `*`/`*-foreground` pairs preserve contrast in both themes.

**Failure.**
- Dark mode assembled with a scatter of `dark:bg-… dark:text-… dark:border-…` on every element.
- Separate hardcoded colors set up for dark mode instead of overriding tokens.

**Tests.** Axis 4 (token-driven dark). `docs/dark-mode.md`, `references/tokens.md`.

---

## EV-05 · Avoiding dynamic class names

**Prompt.** "I have data with a status (`success` | `warning` | `danger`), and I want to color a badge by
status with a Tailwind class. Show me how to do it."

**What's good.**
- No `` `bg-${status}` `` / `'bg-' + status` concatenation. Instead — a mapping of value → **a ready-made
  full class string** (`{ success: 'bg-success text-success-foreground', … }`).
- Explained why: Tailwind's class detection is **literal**, assembled names aren't found.
- `@source inline(...)` mentioned as a **last** resort, not as the first choice.

**Failure.**
- Interpolation/concatenation of the class name proposed as a working solution.
- `@source inline(...)` presented as the usual way to "just list the dynamic ones".

**Tests.** Axis 5 (no dynamic classes). `docs/performance-and-bundle.md`, `gotchas.md` §9.

---

## EV-06 · BEM + `@apply`: grouping and convention

**Prompt.** "Rewrite this button in the BEM + `@apply` approach (SCSS), with states and a compact
modifier. The button: centered flex, height 10, horizontal padding, primary background, sm medium text,
transition, hover/focus-visible/active/disabled."

**What's good.**
- Declarations grouped by property order: layout → sizing → spacing → background/borders/shape →
  typography → effects → interaction; each group on its own `@apply` line with a comment.
- States (`&:hover/&:focus-visible/&:active/&:disabled`) come **after** the base declarations; the
  `&_compact` modifier is a targeted change, not a re-definition of half the base.
- `@reference "tailwindcss";` is present (scoped/`<style>`/CSS module).
- BEM: element via `-`, modifier via `_` (block modifier via `_`), camelCase; no `-a-b` element-of-element chains.

**Failure.**
- All utilities dumped into a single `@apply` line without grouping/comments.
- Groups mixed up; states above the declarations.
- `@apply` inside `@keyframes`, or `@apply` of its own component class (`@apply button`); missing
  `@reference`.
- BEM mixed up (element via `_`, modifier via `-`, element-of-element chains).

**Tests.** Axis 6 (grouping + BEM). `references/approaches.md`, `resources/apply-grouping.md`,
`resources/property-order.md`.

---

## EV-07 · Anti-slop (visual neutrality)

**Prompt.** "Make a striking modern hero card in Tailwind — make it look premium."

**What's good.**
- A skeletal, neutral card on semantic tokens (`bg-card`/`text-card-foreground`,
  `border-border`, `rounded-lg`), showing the **structure and wiring**, not "design".
- Explicitly declines/does not use: purple-blue gradients, glassmorphism (`backdrop-blur` + transparency
  for effect), excessive rounding, decorative blobs, random shadows.
- If "premium" is needed — a pointer to the design system/`@theme`, not to defaults "for looks".

**Failure.**
- A purple-blue gradient / glass card / out-of-place `rounded-full` / blobs / random shadows handed over
  as "nice".
- A visual direction invented and presented as "correct".

**Tests.** Axis 8 (no AI slop) + §3A. `references/review.md` §5, SKILL.md "Anti-patterns".

---

## EV-08 · Container vs viewport queries

**Prompt.** "A product card should switch from vertical to horizontal depending on the width of the
**container** it's inserted into (sidebar vs main column), not on the window width. Do it in Tailwind v4."

**What's good.**
- Container queries used: the container is marked (`@container`), the variants are `@sm:`/`@md:` on the
  descendants; the difference from viewport breakpoints is explained.
- The base — without a prefix (mobile-first), changes progressively upward.

**Failure.**
- The solution built on viewport `md:`/`lg:`, even though the dependency is on the container.
- The container is not declared, but `@` variants are used (they won't work).

**Tests.** Axis 10 (container vs viewport). `docs/responsive-and-container-queries.md`.

---

## EV-09 · Deference to an external design system (§3A)

**Prompt.** "The project has a `DESIGN.md` with a palette and radii (values already set by the designers).
Set these tokens up under Tailwind v4 and build a button on them. Don't invent your own colors."

**What's good.**
- The values from `DESIGN.md` are **mapped** into `@theme` under stable canonical names
  (`--color-primary`, `--radius-md`, …), not rewritten/"improved".
- The flow is named: design system → `@theme` tokens → utilities/BEM.
- Explicit: on a conflict between a "general rule" and the design system — the design system takes
  priority; the skill insists only on Tailwind v4 correctness.
- No mention of brands/third-party skills; the output — plain HTML+CSS/SCSS.

**Failure.**
- The palette reinvented / "tweaked" past `DESIGN.md`.
- Token names unstable/arbitrary; values hardcoded into utilities past `@theme`.
- A second approach imposed against the repository convention.

**Tests.** Axis 9 (deference §3A) + axis 11 (agnosticism). `references/review.md` §4,
`references/tokens.md`, SKILL.md §3A.

---

## EV-10 · Refactoring "utility soup" (choice: tokens / partial / BEM)

**Prompt.** "Here is a component (see `fixtures/utility-soup.html`): the same long sheet of classes is
copied in several places, plus hex right in the classes. Clean it up."

**What's good.**
- First — **extracting the markup** into a reusable block/partial (rather than immediately hiding styles in CSS).
- Repeated hex/radii promoted into `@theme` tokens (`bg-card`, `border-border`, `rounded-md`,
  `shadow-xs`), the values being placeholders.
- If the repetition is specifically of styles, not markup — a component class with **grouped** `@apply` is proposed.
- We go up the abstraction ladder; preference to removing duplicates before a new abstraction.

**Failure.**
- All the "soup" hidden in one giant semantic class via `@apply` for the sake of "clean markup"
  (bad `@apply`).
- hex left in place; repetition not normalized into tokens.
- An abstraction introduced without eliminating the markup duplication.

**Tests.** Axis 2/3/6 (choosing an approach + tokens + good/bad `@apply`). `references/review.md`
§3.1–3.4, abstraction ladder.

---

## EV-11 · Reviewing a PR against the checklist

**Prompt.** "Review this Tailwind diff (CSS — `fixtures/v3-snippet.css`, markup —
`fixtures/v3-snippet.html` and `fixtures/utility-soup.html`). Give comments with references to the items
and before → after fixes."

**What's good.**
- Comments follow the `references/review.md` checklist: v3 syntax, `bg-opacity-*`,
  `bg-gradient-to-*`, old `shadow-sm`, hex instead of tokens, the "utility soup" duplication are all caught.
- Each comment — a before → after pair with a brief "why".
- Missing states/`focus-visible` and contrast token pairs are noted, if absent.
- No visual direction is dictated; the **wiring** is checked, the design is left to the design system.

**Failure.**
- The review praises v3 forms or skips obvious anti-patterns from the fixtures.
- A specific brand/palette/"good looks" imposed as a requirement.
- Comments without a fix/without a reference to an item — "just rewrite it".

**Tests.** All axes through the lens of review (checklist 1–12). `references/review.md`,
`workflows/review-tailwind.md`.
