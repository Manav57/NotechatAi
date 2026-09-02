# Workflow — Tailwind v4 review (PR / file)

A step-by-step playbook for an agent reviewing Tailwind code. This is a **procedure**, not a reference:
it takes the checklist from `references/review.md` and turns each item into an action — *what to grep /
look for → how to read it → the typical "before → after" fix*. The checklist itself and its wording are
**not duplicated** here; keep `references/review.md` open alongside and cross-check by item numbers.

Related: subtle engine gotchas — `references/gotchas.md`; Wrong→Correct→Why triples —
`references/v4-rules.md`; the "utility-first vs BEM+@apply" choice — `references/approaches.md`; the canonical
`@theme` — `templates/theme.css`; reference A/B pairs — `examples/<name>/*`.

> Token names are canonical and stable (`bg-primary`/`text-primary-foreground`, `bg-muted`/
> `text-muted-foreground`, `bg-card`/`text-card-foreground`, `border-border`, `bg-input`,
> `ring-ring`/`outline-ring`, `bg-danger`/`text-danger-foreground`, `rounded-sm/md/lg/xl`).
> Values are design-system placeholders; on review we check the **wiring**, not taste.

---

## Step 0. Preparation: gather the review surface

1. Capture the diff: `git diff --name-only <base>...<head>` — list the changed files.
2. Sort them by type — this determines which items apply:
   - **CSS entry** (`@import "tailwindcss"`, `@theme`, `@utility`, `@custom-variant`) → items 1, 5, 6, §3A.
   - **Markup** (HTML/templates of any stack — any text with `class=`) → items 2, 3, 4, 9, 10, 11, 12.
   - **SCSS/CSS modules with `@apply`** → items 7, 8 + the `@reference` gotcha (`gotchas.md` §6).
3. Determine the **repository's approach** (A utility-first or B BEM+`@apply`) by what predominates in the code —
   consistency matters more than personal taste (`review.md` §4). If the repo has adopted one approach, don't
   push the other; review new files under the adopted one.
4. Find the design-system source (`DESIGN.md` / ready-made tokens / an existing `@theme`) — it's needed
   for items 5, 6 and §3A: values are **mapped** into `@theme`, not invented.

From here we go through the `references/review.md` checklist top to bottom. For each item below —
a *detector* (what to look for) and a *fix* (before → after).

---

## Step 1. v4 syntax, not v3 (`review.md` §1 item 1)

**Grep** (in CSS entries and markup):

- `@tailwind ` — a leftover v3 include.
- `bg-opacity-|text-opacity-|border-opacity-|ring-opacity-|placeholder-opacity-` — old opacity.
- `bg-gradient-to-` — old gradient name.
- `@layer utilities` — custom utilities should be `@utility`.
- `tailwind\.config` without an accompanying `@config "…"` in CSS — there's no auto-pickup in v4.
- `!\w[\w:/-]*` at the start of a class (v3 important prefix) — in v4 the `!` is a suffix.
- `\b(shadow-sm|rounded-sm|blur-sm|drop-shadow-sm)\b` — **valid, but shifted by one step**; check whether the "smallest" (`-xs`) was meant. This is a silent change in appearance, more dangerous than an obvious error.

**Fix (before → after)** — canon in `references/v4-rules.md`:

```css
/* before */ @tailwind base; @tailwind components; @tailwind utilities;
/* after */ @import "tailwindcss";
```
```html
<!-- before --> <div class="bg-primary bg-opacity-50 bg-gradient-to-r !mt-0">
<!-- after --> <div class="bg-primary/50 bg-linear-to-r mt-0!">
```

If `tailwind.config.js` exists without real JS dynamics — flag it: move it into `@theme`
(`v4-rules.md` §2). If it's needed because of dynamics — wire it in explicitly with `@config "…"`.

---

## Step 2. All classes are full literals (`review.md` §1 items 2–3; `gotchas.md` §9)

Check items 2 and 3 together: the scanner looks for **literal substrings** and does not execute code.

**Grep** in markup and in code that builds `class`:

- Interpolation inside a class name: `class="[^"]*\{` , `-\$\{` , `'(bg|text|border|ring)-' *\+` ,
  `` `[^`]*\$\{[^}]*\}[^`]*` `` next to utility prefixes.
- Templates like `text-{{ … }}-foreground`, `bg-${color}-500`, `'border-' + side`.
- Partial literals (`hover:`, `text-`) that get a tail "appended" at runtime.

**How to read:** if the full class literal isn't in the source — no CSS is generated for it,
the class "silently" doesn't work. The presence of `@source inline(...)` is a signal this was already being patched
with a safelist; make sure the safelist is a **last resort**, not the default (`gotchas.md` §7).

**Fix (before → after):**

```html
<!-- before: name built by interpolation → not detected -->
<span class="text-{{ tone }}-foreground">…</span>
<!-- after: value → FULL class string (mapping), statically visible -->
<!-- tone=danger → "text-danger-foreground"; tone=success → "text-success-foreground" -->
<span class="text-danger-foreground">…</span>
```

Order of preference for the fix (`gotchas.md` §9): (1) map value → full name; (2) list the
options in full in markup; (3) only if there's no other way — `@source inline("…")` with brace-expansion.

---

## Step 3. Third-party / CMS / generated DOM is scoped, not styled globally (`review.md` §1 item 4)

**Grep** in CSS entries:

- Global tag selectors in the base layer: `^\s*(h1|h2|h3|p|ul|ol|li|table|a)\b` outside a scope wrapper.
- Signs of rich-text/CMS/widgets near such selectors.
- In markup/code — runtime DOM substitution (`<i>`→`<svg>`, wrapper injection): selectors must land
  in the **final** DOM, not the placeholder.

**Fix (before → after):**

```css
/* before: globally styling all headings/paragraphs for the sake of one CMS block */
h1 { @apply text-2xl font-semibold; }
p  { @apply leading-relaxed; }
/* after: scope it under a wrapper (or attach the Typography plugin to that scope) */
.richText { h1 { @apply text-2xl font-semibold; } p { @apply leading-relaxed; } }
```

This is also a case for choosing Approach B (give the style a name without touching third-party markup) — `references/approaches.md`.

---

## Step 4. Tokens instead of repeated arbitrary values (`review.md` §1 item 5; §3.4)

**Grep** in markup and CSS: bracket literals — `\[#[0-9a-fA-F]{3,8}\]`, `\[\d+(\.\d+)?(px|rem)\]`,
`\[0_\dpx_.*\]` (shadows), `bg-\[oklch`. Count **repeats** of the same value.

**How to read:** a one-off arbitrary value is an acceptable exception. A repeat / product meaning /
the desire to edit centrally — a candidate for a `@theme` or `@utility` token. System-level colors/radii/shadows/
spacing — via semantic names, not literals.

**Fix (before → after)** — see `references/v4-rules.md` §6:

```html
<!-- before: the same hex and radius all over the code -->
<button class="bg-[#1f6feb] rounded-[10px]">…</button>
<!-- after: a name from @theme (value is a design-system placeholder) -->
<button class="bg-primary rounded-lg">…</button>
```

A runtime value from a variable is **not** a hardcoded hex, it's `bg-(--brand)` (not `bg-[--brand]`,
`gotchas.md` §3).

---

## Step 5. The external design system is mapped, not overridden + the §3A layer audit (`review.md` §1 item 6, §4)

**Grep** in `@theme` and nearby:

- Nested selectors/`@media`/`:root` **inside** `@theme` — forbidden (`gotchas.md` §2):
  `@theme \{[^}]*(\.|\@media|:root)`.
- Hardcoded values in markup bypassing tokens when a `DESIGN.md`/ready palette exists.
- Overriding an existing palette "to taste" instead of mapping it.
- Mentions of brands/projects/third-party skills/frameworks in classes, comments, `alt`/`aria`.

**How to read (§3A):** the skill is the **implementation** layer, not visual design. The flow must be
*design system → `@theme` tokens → utilities / BEM+@apply*. The code sets the **method** (how to define and
use a token), not taste. On a "general styling rule vs brand" conflict — the design system wins;
the skill insists only on v4 correctness.

**Fix (before → after):**

```css
/* before: theme switched inside @theme (error) + value invented */
@theme { --color-primary: #7c3aed; .dark { --color-primary: #a78bfa; } }
/* after: top-level tokens; dark override outside; value from the design system (placeholder) */
@theme { --color-primary: oklch(52% 0.12 255); }
.dark  { --color-primary: oklch(70% 0.12 255); }
```

JS glue (`cn()`, clsx, tailwind-merge, CVA) is allowed only as an explicitly optional aside "if
you're in a JS framework", not as the foundation (`review.md` §4).

---

## Step 6. Correct `@apply` grouping (Approach B) (`review.md` §1 item 7, §2; `resources/apply-grouping.md`)

Apply only to SCSS/CSS modules with `@apply`. First check the `@reference` gotcha:

- **Grep:** a file with `@apply` but **without** `@reference "…"` in an isolated build (CSS module /
  scoped `<style>`) — `@apply` will fail with "unknown class" (`gotchas.md` §6, `v4-rules.md` §15).
  In a single entry CSS that already has `@import "tailwindcss"`, `@reference` is not needed.

Then — the **group order**. Canon: group `@apply` by property category in this **order**, one line per
group, and do **not** add per-group label comments — the line order conveys the grouping:
layout/position → sizing → spacing → background/borders/shape → typography → effects/motion →
interaction; **then** states (`&:hover`, `&:focus-visible`, `&:active`, `&:disabled`),
**then** modifiers. The full group table — `review.md` §2 and `resources/property-order.md`;
a worked example — `resources/apply-grouping.md`; the reference — `examples/button/button.bem.scss`.

**Leave a comment if:** groups are mixed; everything is dumped into one `@apply` line;
states are above declarations; a modifier overrides half the base instead of a
targeted tone change. Separately — `@apply` smells (`review.md` §3.2–3.3): nested
`@apply .button;`, a giant page-specific wrapper, `@apply` inside `@keyframes`.

**Fix (before → after):**

```scss
/* before: dump + state above declarations + no groups */
.button { &:hover { @apply bg-primary/90; } @apply h-10 px-4 inline-flex bg-primary text-sm; }
/* after: groups in order, states after the base */
.button {
  @apply inline-flex items-center justify-center gap-2;
  @apply h-10;
  @apply px-4;
  @apply rounded-md bg-primary;
  @apply text-sm font-medium text-primary-foreground;
  @apply transition-colors duration-150;
  &:hover { @apply bg-primary/90; }
}
```

---

## Step 7. BEM convention (Approach B) (`review.md` §1 item 8)

**Grep** class names:

- Element via `-`, modifier via `_` (default; configurable per project). Violations: modifier via `__` or `--`; element
  via `_`; chains `-a-b` (`\w+-\w+-\w+`); kebab-case in the multi-word part instead of camelCase.

**How to read:** one block per component; elements always derive from the block; multi-word parts are camelCase.
Canon: block `cardList`; block modifier `cardList_compact`; element `cardList-item`; element modifier
`cardList-item_active`. In third-party code the reverse convention is common (BEM with `__`/`--`) — renaming is
mandatory (`review.md` §5).

```text
before:  card-list__item--active      after: cardList-item_active
before:  card_list-item               after: cardList-item   (no chain)
```

---

## Step 8. Full set of states and visible focus (`review.md` §1 item 9; `gotchas.md` §8)

**Grep** interactive elements (`<button`, `<a`, `role="button"`, `<input`, `<summary`):

- `hover:` **without** paired `focus-visible:` / `active:` / `disabled:` nearby — on touch, hover doesn't
  fire (`@media (hover: hover)`), so the state is "lost".
- `outline-none` / `outline-0` **without** a `ring`/`outline-ring` replacement — suppressed focus.
- `<div`/`<span` with a click handler instead of a semantic `<button>` (see step 9).

**Fix (before → after):**

```html
<!-- before: hover only (disappears on touch) + focus suppressed -->
<button class="bg-primary hover:bg-primary/90 focus:outline-none">…</button>
<!-- after: full set + visible focus-visible -->
<button class="bg-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring
               active:bg-primary/80 disabled:opacity-50 disabled:pointer-events-none">…</button>
```

The reference for the full set — `examples/button/*`. States and motion should be consistent across
similar components.

---

## Step 9. Contrast and accessibility (`review.md` §1 item 10)

**Grep:**

- `bg-*` without a paired `text-*-foreground` nearby; especially dangerous is `text-foreground` on `bg-primary`.
- `bg-primary` / `bg-card` / `bg-muted` / `bg-danger` without the corresponding `-foreground`.
- `<div`/`<span` with `@click`/`onclick`/`role="button"` instead of `<button>`; `<dialog>`, `<label for>`.

**How to read:** paired tokens are used **together** — that's what guarantees readability
(`bg-primary`+`text-primary-foreground`, `bg-muted`+`text-muted-foreground`). States
(disabled, hover) must not pull contrast below the threshold. Markup is semantic.

**Fix (before → after):**

```html
<!-- before: a background without its pair → unreadable -->
<div class="bg-primary text-foreground">…</div>
<!-- after: a contrasting token pair -->
<div class="bg-primary text-primary-foreground">…</div>
```

The reference for `aria-*`/`label[for]` relationships — `examples/input-field/*`, `examples/alert/*`, `examples/modal/*`.

---

## Step 10. Responsiveness is mobile-first and deliberate (`review.md` §1 item 11; `v4-rules.md` §9)

**Grep:**

- Base styles set via a max breakpoint "top-down" instead of mobile-first.
- Breakpoints removed from the project.
- A component adapted only by viewport (`md:`/`lg:`) when it should react to the width of its
  **parent** (in a sidebar/grid/modal) → a candidate for a container query.

**Fix (before → after):**

```html
<!-- before: reacts to the viewport, though it lives in a variable-width container -->
<div class="flex flex-col md:flex-row">…</div>
<!-- after: a v4 container query — reacts to the parent's width -->
<div class="@container"><div class="flex flex-col @md:flex-row">…</div></div>
```

The base — no prefix; changes progressively at larger breakpoints. The reference for both mechanisms side by side —
`examples/responsive-grid/*`.

---

## Step 11. No AI slop (`review.md` §1 item 12, §5)

**Grep:**

- Gradients: `from-(purple|violet|indigo|fuchsia)`, `to-(blue|cyan)`, a decorative `bg-linear-*` without justification.
- Glass: `backdrop-blur` next to a translucent background.
- Excessive rounding: `rounded-full` out of place, `rounded-\[` with large values.
- Random shadows/blobs/animation "for the wow factor".

**How to read:** examples and new code are **neutral and skeletal**: they show structure and wiring,
not "design". Radii — from the `rounded-sm/md/lg/xl` scale. Visual decisions come from the design
system, not from "make it pretty" defaults. The full debranding/anti-slop checklist (for porting
third-party code) — `review.md` §5; reference invariants — `examples/README.md`.

**Fix:** remove the decorative gradient/glass/blob → a neutral surface on tokens
(`bg-card`+`border-border`+`rounded-md`), radius from the scale. An anti-pattern from third-party code, if it's
instructive, should be framed as a **before → after** pair, not introduced as a "reference".

---

## Step 12. Summary: final self-check

Before issuing a verdict, run through the quick form from `references/review.md` (the "Quick form" section) and
the `references/gotchas.md` cheat sheet ("Cheat-sheet checklist"). If there are many fixes — follow the refactoring
order in `review.md` §6: first remove dead/duplicate CSS, then normalize primitives into tokens,
and only then introduce new abstractions (prefer removing complexity over a new abstraction).

---

## Review output format

Produce a structured report (don't rewrite the whole checklist — reference item numbers):

1. **Verdict:** `approve` / `request changes` / `comment` + a one-line summary.
2. **Summary checklist** — copy the "Quick form" from `references/review.md` and mark
   `[x]`/`[ ]` for each of the 12 items (passed / failed / n-a for non-applicable).
3. **Findings** — in descending order of severity. For each:
   - `file:line` + the `review.md` item number (e.g. "item 5 / §3.4");
   - severity: **blocker** (breaks the build/appearance: v4 syntax, dynamic names, `@reference`,
     contrast) / **major** (tokens, states, grouping, scope) / **minor** (cosmetics, naming);
   - the fix as a **before → after** pair (a minimal fragment, not a retelling);
   - a link to the rule's source (`references/*`, `examples/<name>/*`).
4. **Praise** (where the code is already correct) — briefly, so the report doesn't read as "all bad".

Template for a single finding:

```text
[major] components/card.scss:42 — review.md item 7 (@apply grouping)
The &:hover state is declared above the base declarations; categories are not grouped in canonical order.
before → .card { &:hover {…} @apply p-4 bg-card text-sm; }
after  → .card { @apply p-4; @apply bg-card; @apply text-sm; &:hover {…} }
ref: references/review.md §2; resources/apply-grouping.md; examples/card/card.bem.scss
```
