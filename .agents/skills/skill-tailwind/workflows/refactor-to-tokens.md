# Workflow — post-migration modernization: arbitrary/hex → tokens and clearing the "utility soup"

> Purpose: an agent-executable **second-pass** workflow — when the syntax has already been moved to
> Tailwind v4 (`@import "tailwindcss"`, `@theme`, utility renames), but the code still carries v3
> legacy: scattered `#hex`/`oklch(...)` literals, `*-[...]` arbitrary values, duplicated long
> utility chains. Here we **do not touch the syntax** (that was done by `workflows/migrate-v3-to-v4.md`);
> we raise the code up the abstraction ladder toward semantic tokens and deliberate style organization.
>
> This is the **CSS implementation layer**, not a redesign: we **map** design-system values into `@theme`
> under their canonical names rather than inventing them. Values are placeholders; names are stable.
>
> **File scope.** This playbook is the second-pass orchestrator and does **not** duplicate the tables:
> - token concepts, the Brand→Semantic→Component hierarchy, the `@theme inline/default/reference` forms,
>   the alpha scale, namespace reset, the **arbitrary→token promotion heuristic** — `references/tokens.md`
>   (§2, §4, §6);
> - the "token name → role → utility" canon — `resources/tokens-table.md`;
> - choosing approach A vs B, the abstraction ladder, "good vs bad `@apply`" — `references/approaches.md`;
> - the order of the 7 `@apply` groups — `resources/apply-grouping.md` (and `resources/property-order.md`);
> - the skill's BEM convention — `references/approaches.md` §3.
>
> **How it differs from `workflows/introduce-design-tokens.md`:** that one introduces the token layer "from
> scratch" into a project (greenfield wiring of a design system). This one is a post-migration **cleanup** of
> already-working v4 code from arbitrary values/repetition. Step 2 below relies on that playbook without
> repeating it.

---

## When to run this playbook

- The v3→v4 syntax migration is **already complete** (`workflows/migrate-v3-to-v4.md`, checklist closed);
  the build is clean, no v3 literals remain.
- In the markup/SCSS, `bg-[#1d4ed8]`, `text-[oklch(58%_0.18_27)]`, `border-[#e5e7eb]`,
  `p-[18px]`, `rounded-[10px]` remain — especially **repeated** ones.
- The same color/radius/spacing is copied in several places and risks "drifting apart".
- The markup has swelled into "utility soup": identical long utility chains are duplicated across many nodes.

If the task is the opposite — to introduce a token layer into a project that had none — start with
`workflows/introduce-design-tokens.md`. If you need to **review** already-finished tokens — see Step 6.

---

## Step 0 — Preconditions (gate)

**What to look for / confirm:**
- the import — `@import "tailwindcss";` (not `@tailwind …`); the dark variant is registered:
  `@custom-variant dark (&:where(.dark, .dark *));` — both are in `templates/theme.css`;
- the canonical `@theme` set is present at least partially (`templates/theme.css`,
  `references/tokens.md` §1) — these are the target names we will translate arbitrary values into.

**How to fix:** if the syntax migration is not finished — stop, first close
`workflows/migrate-v3-to-v4.md` (this playbook assumes clean v4 syntax on input).

---

## Step 1 — Inventory: greps for repetition / arbitrary / hex

The goal of this step is to assemble a **map of candidates** for promotion: what repeats, what is hardcoded.
Measure first, then fix. The greps below search for literal substrings (just like the Tailwind scanner);
for the hex case — drop `-i`.

**What to look for (run across markup and SCSS):**

```bash
# 1) hex literals in utilities: bg-[#…], text-[#…], border-[#…], ring-[#…]
rg -n -i '(bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|decoration|caret|accent)-\[#[0-9a-f]{3,8}\]'

# 2) color functions in arbitrary values: text-[oklch(…)], bg-[rgb(…)], …[hsl(…)]
rg -n -i '\[(oklch|rgb|rgba|hsl|hsla|color-mix)\('

# 3) geometry in arbitrary values: arbitrary px/rem on spacing/size/radius
rg -n '\b(p|m|gap|w|h|size|top|right|bottom|left|inset|rounded|text)-(\w+-)?\[[\d.]+(px|rem|em)\]'

# 4) ANY arbitrary value, to gauge the scale (square brackets)
rg -n '[a-z-]+-\[[^\]]+\]'

# 5) raw hex in the CSS/SCSS itself (outside utilities) — a candidate for a --color-* token
rg -n -i '#[0-9a-f]{3,8}\b' --glob '*.{css,scss}'
```

**How to evaluate (what to promote, what to keep) — the ladder from `references/tokens.md` §6:**
- **a literal repeated ≥2–3 times** → a token candidate;
- **a role stands behind the value** ("this is the danger color", "the control radius") → a token candidate,
  even with a single occurrence;
- **unique geometry of a single node** with no reuse and no role → honestly **keep** the arbitrary value
  (`top-[3px]`, `w-[37rem]`) — we don't breed tokens "just in case".

> Note on the CSS-variable form: if the code contains `bg-[--brand]` (square brackets), this is still
> the v3 form — it is fixed by `workflows/migrate-v3-to-v4.md` (Step 5: `bg-[--var]` → `bg-(--var)`). Here
> we assume such cases are already converted; if not — close that step first.

Record the list of candidates (literal → number of occurrences → presumed role) — it feeds Steps 2–3.

---

## Step 2 — Extract semantic tokens into `@theme` (+ `*-foreground` pairs, dark mode)

For each candidate-with-a-role from Step 1, create a **semantic** name in `@theme` (the role, not the color:
`--color-primary`, not `--color-blue-600`). Take the names from the canon — `references/tokens.md` §1 and
`resources/tokens-table.md`; the mechanics of introducing the token layer are described in detail by
`workflows/introduce-design-tokens.md` (not repeated here).

**Key rules of this step (verify, don't restate the tables):**
- **Only the semantic level lands in `@theme` as a utility name** (the Brand→Semantic→Component hierarchy —
  `references/tokens.md` §2). A brand literal can go into a separate variable and be referenced:
  `--color-primary: var(--brand-blue-600);`.
- **A `*-foreground` pair is mandatory** for every color surface: if you created `--color-card` —
  create `--color-card-foreground`; contrast is "baked into" the theme, the markup writes `bg-card
  text-card-foreground` (`references/tokens.md` §1, the pair principle).
- **Dark mode — same names, different values** under `.dark { … }` (and **not** inside `@theme`):
  `@theme` declares the names/utilities once, `.dark` overrides the values at runtime
  (`references/tokens.md` §3). For a themable token — a plain `@theme`, **not** `@theme inline`
  (inline bakes the value into the utility and breaks runtime switching — `references/tokens.md`
  §4.2, §3A).
- **An external design system / `DESIGN.md`** — we don't override it, we **map** to it: our names
  reference its `--ds-*` (`references/tokens.md` §5). On conflict, the design system wins.
- **Translucency** — a slash modifier on the utility (`bg-primary/90`), not a separate token
  `--color-primary-90`. A named alpha scale via `color-mix()` — only if the steps are actually
  reused (`references/tokens.md` §4.1).

```css
/* before: the same literal repeated in markup/SCSS and means "danger" */
/* after: a semantic pair in @theme + an override in dark mode */
@theme {
  --color-danger: oklch(58% 0.18 27);            /* value is a placeholder for the DS */
  --color-danger-foreground: oklch(99% 0 0);
}
.dark {
  --color-danger: oklch(62% 0.17 27);            /* same names, dark values */
  --color-danger-foreground: oklch(99% 0 0);
}
```

---

## Step 3 — Replace arbitrary/hex with token utilities (before → after)

Now mechanically translate the occurrences from Step 1 onto the semantic utilities generated by the tokens from
Step 2. In the markup — **semantics only** (`references/tokens.md` §2: `bg-primary`, not
`bg-[oklch(…)]` and not `bg-brand-blue-600`).

| Before (arbitrary/hex) | After (token utility) | Token (`@theme`) |
|---|---|---|
| `bg-[#1d4ed8]`, `bg-[oklch(52%_0.12_255)]` | `bg-primary` | `--color-primary` |
| `text-[#1d4ed8]` on a primary background | `text-primary-foreground` | `--color-primary-foreground` |
| `text-[oklch(58%_0.18_27)]` | `text-danger` | `--color-danger` |
| `border-[#e5e7eb]` | `border-border` | `--color-border` |
| `bg-[#f3f4f6]` (secondary surface) | `bg-muted` / `text-muted-foreground` | `--color-muted(-foreground)` |
| `ring-[#94a3b8]` (focus) | `ring-ring` / `outline-ring` | `--color-ring` |
| `rounded-[10px]` (control radius, repeated) | `rounded-md` | `--radius-md` |
| `p-[16px]`, `gap-[8px]` (on the scale) | `p-4`, `gap-2` | `--spacing` (scale) |
| `bg-[rgb(0_0_0/0.5)]` (backdrop) | `bg-foreground/50` | slash modifier |
| runtime value from the DS | `bg-(--ds-action)` (round brackets) | mapping §5 |

> **Spacing — don't invent a token.** The numeric scale in v4 is computed from a single `--spacing: 0.25rem`
> (`p-4` = `calc(var(--spacing) * 4)`). An arbitrary `p-[16px]` that lands on a scale step — replace with the
> scale utility (`p-4`), not with a new named spacing value (`references/tokens.md` §1, end, and §7).

> **What to keep arbitrary.** Unique geometry of a single node with no role and no repetition — correct to
> keep (`top-[3px]`, `w-[37rem]`). Replacement for replacement's sake is harmful: see the ladder in
> `references/tokens.md` §6.

After replacing, repeat the Step 1 greps — the hex/arbitrary list should collapse down to deliberate
exceptions.

---

## Step 4 — Clear the "utility soup": ladder step 2 OR a deliberate component class (approach B)

Promoting values (Steps 2–3) removes hardcoded numbers, but it does not remove **duplicated long markup**.
This is a separate axis. We make the choice deliberately — the decision tree is in `references/approaches.md`
§5; the abstraction ladder is in §1.

**First — step 2 (extracting the MARKUP), this is the default.** If the same utility chain repeats and the
project can extract the markup into a native reusable fragment (partial / include / template),
do it — the duplicate goes away **without a CSS abstraction**, the styles inside stay utility-first (approach A).
This is the preferred way for **your own** DOM (`references/approaches.md` §1, step 2; §4).

**If markup extraction is not possible / the DOM is third-party — a deliberate `@apply` component class (approach B).** When
there is no partial mechanism, **or** the markup is third-party/generated (CMS, a third-party widget, DOM assembled
by a script) — a real CSS class on the render selector is needed. Then we build a BEM class with
grouped `@apply` (`references/approaches.md` §3, §4 "✅ Good"; ladder steps 5–6).

```html
<!-- before: "utility soup", the same chain copied across many buttons -->
<button class="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md
               bg-primary text-sm font-medium text-primary-foreground
               transition-colors duration-150 hover:bg-primary/90
               focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
               active:bg-primary/80 disabled:opacity-50 disabled:pointer-events-none">Save</button>

<!-- after (approach B, third-party DOM / no partial): a semantic BEM class -->
<button class="button button_primary">Save</button>
```

The SCSS class itself we write per the Step 5 grouping. A ready reference of the `button` class via approach B (with all
states and modifiers) — `resources/apply-grouping.md`, the worked example; paired A/B components — `examples/`.

> **Don't "hide utilities for the sake of short markup".** Mass `@apply` just to shorten the template, without
> a real need for a named primitive — an anti-pattern (`references/approaches.md` §4 "❌
> Bad"): co-location is lost, nothing is gained. If you feel pulled toward `@apply` everywhere — step back to
> step 2.

---

## Step 5 — Set up `@apply` grouping and the BEM convention

For everything that went to approach B in Step 4, bring the SCSS to the skill's canon.

**`@apply` grouping (7 groups, fixed order) — `resources/apply-grouping.md`:**

1. Layout/position → 2. Sizing → 3. Spacing → 4. Background/borders/shape → 5. Typography →
6. Effects/motion → 7. Other interaction. Then — **states** (`&:hover`,
`&:focus-visible`, `&:active`, `&:disabled`), then — **modifiers** (`&_primary`, `&_outline`).
Each group is a separate `@apply` line with a short comment; empty groups are skipped. The order of
utilities within a line does not affect the cascade (the engine re-sorts) — grouping is purely for
readability.

**The skill's BEM convention (default) — `references/approaches.md` §3:**
- `camelCase` for multi-word parts; the separators are fixed: block `blockName`; element
  `blockName-elementName` (hyphen); block modifier `blockName_modifierName` (underscore); element modifier
  `blockName-elementName_modifierName` (underscore); a key-value modifier `blockName_size_lg`;
- **one block per component**, elements are counted from the block; **no chains** `-a-b`
  (`cardList-itemTitle`, not `cardList-item-title`); a modifier is never used alone (`block block_mod`).
- This is the default; if a project already declares another BEM scheme, follow it — only the hard rules
  always hold (separators are programmatically separable, a modifier never stands alone, no elements of elements).

**States — the full set.** For interactive components, hover / focus-visible / active / disabled are
mandatory; the focus is **visible** (`outline-2 outline-offset-2 outline-ring` or `ring-2
ring-ring`); `focus-visible:` is preferred over `focus:`. Form validation — the `user-invalid:` variant
(not `invalid:`). The `inert:` variant does not exist.

> Isolated styles: if the SCSS is compiled separately from the entry CSS (CSS module / scoped `<style>`),
> the first line needs `@reference "…"`, otherwise `@apply` can't see the tokens (`references/approaches.md`
> §3, the v4 notes).

---

## Step 6 — Run the checklist and the harness

**Review checklist** — go through `references/review.md` (12 items: tokens vs arbitrary, contrast
pairs `*-foreground`, the full set of states, correct `@apply` grouping, the BEM convention,
dark mode, etc.); the step-by-step review workflow — `workflows/review-tailwind.md`. Especially relevant
after this refactor: the items "tokens instead of arbitrary", "external DS mapped, not overridden",
"contrast pairs".

**Static harness** — run it over the changed files:

```bash
node evals/harness.mjs <changed .html/.css/.scss>
# machine-readable: node evals/harness.mjs --json <files>
```

The harness catches exactly what this playbook cleaned up: leftover `bg-[--var]` (the v3 CSS-variable form),
repetition → semantic token (`--color-…` / `--spacing` / `--radius-…`), the token-driven dark mode
(`.dark { --color-…: … }` instead of color `dark:` utilities). Reference fixtures — `evals/fixtures/`;
a description of the run — `evals/README.md`.

---

## Modernization checklist (final self-check)

- [ ] **0.** The v3→v4 syntax migration is closed (`workflows/migrate-v3-to-v4.md`); the input is clean
  v4 syntax; `@import "tailwindcss"` + `@custom-variant dark` are in place.
- [ ] **1.** Inventory is done (greps for hex/`oklch`/arbitrary/repetition); a candidate list assembled
  "literal → occurrences → role".
- [ ] **2.** Candidates-with-a-role are extracted into `@theme` under **semantic** names; every
  surface has a `*-foreground` pair; dark values are in `.dark { … }` (not in `@theme`, not
  `inline`); the external DS is mapped, not overridden.
- [ ] **3.** All repeated hex/arbitrary are replaced with token utilities (`bg-primary`,
  `text-danger`, `border-border`, `rounded-md`, `p-4`); in the markup — semantics only; deliberate
  one-off arbitrary values left intentionally; spacing — through the `--spacing` scale, not a new token.
- [ ] **4.** The "utility soup" is cleared: repeated markup is extracted to step 2 (a partial), **or** for a third-party
  DOM / when there is no partial — a deliberate `@apply` BEM class (approach B); no "hiding utilities
  for the sake of short markup".
- [ ] **5.** In approach B, the 7 `@apply` groups are set up (layout→…→interaction, then states,
  then modifiers) and a strict BEM convention (one block, no `_a_b`); the full set of states +
  visible focus; validation — `user-invalid:`; `@reference` in isolated styles.
- [ ] **6.** `references/review.md` is passed; the harness `node evals/harness.mjs` on the changed files is
  clean.

> Sources of truth when in doubt: tokens and the promotion heuristic — `references/tokens.md` (§2, §4, §6)
> and `resources/tokens-table.md`; choosing the approach and "good vs bad `@apply`" —
> `references/approaches.md`; grouping — `resources/apply-grouping.md`. Engine behavior — Tailwind v4's
> default behavior; official positions — the official Tailwind documentation.
