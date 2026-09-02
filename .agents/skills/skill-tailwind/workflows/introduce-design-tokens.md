# Workflow: introducing a design-token system into a project

Step-by-step playbook: how to set up a semantic design-token layer in Tailwind v4 (CSS-first) and
migrate markup off "magic" values onto token utilities. Framework-agnostic: plain HTML +
CSS/SCSS.

This is a **workflow**, not a reference. Concepts, rationale, and full tables live in
`references/tokens.md` (the Brand→Semantic→Component hierarchy, `@theme inline/default/reference`,
the alpha scale, namespace reset, the promotion heuristic) and in `templates/theme.css` (the canonical
`@theme`). The "token name → role → utility" canon is in `resources/tokens-table.md`. Ready-made components on
these tokens are in `examples/`. Don't copy the tables here — open them via the link.

> Base principle (§3A): the skill is an **implementation layer**, not a visual design. Token values
> are always **placeholders for the design system**; only the **names** are stable. If a project already has a
> design system / `DESIGN.md` / ready-made tokens — we **don't redefine them, we map them** into
> `@theme`. Details of this stance are in `references/tokens.md` §5.

---

## When to run this playbook

- The markup is overrun with `bg-[#…]`, `text-[oklch(…)]`, `p-[18px]`, `rounded-[10px]` — they repeat.
- The same color/radius/spacing is copied in several places with the risk of drifting apart.
- A design system / `DESIGN.md` is being brought into the project and its values need to be "wired" into Tailwind.
- You're preparing a dark mode and want to toggle it without touching HTML.

If the task is the opposite — to **review** existing tokens for correctness — see
`references/review.md` (item 5 "tokens instead of arbitrary", item 6 "external DS mapped, not
redefined", item 10 "contrast pairs") and `workflows/review-tailwind.md`.

---

## Step 0. Preconditions

1. Setup — `@import "tailwindcss";` (not `@tailwind …`). The dark variant is registered:
   `@custom-variant dark (&:where(.dark, .dark *));`. Both are in `templates/theme.css`.
2. If you'll write `@apply` in a scoped `<style>` / CSS module — you'll need `@reference` there
   (see `references/gotchas.md`). In the regular entry CSS this isn't needed.

---

## Step 1. Inventory: find repeated values and arbitrary

The goal is to collect a list of candidate values and figure out which of them carry a **role** (and so should
become a token), and which will remain one-off exceptions.

1. Comb through the markup and SCSS for arbitrary values and literals:
   - arbitrary classes in square brackets: `…-[…]` (color, size, radius, shadow, spacing);
   - hex/`rgb(…)`/`oklch(…)`/`hsl(…)` straight in the values;
   - repeated numeric radii and spacings off the numeric scale (`rounded-[10px]`, `p-[18px]`).

   The search is convenient to run with the Grep tool across the project, e.g. against patterns
   `-\[` (any arbitrary), `#[0-9a-fA-F]{3,8}`, `oklch\(`, `rgb`.

2. For each value found, record: **how many times it occurs** and **whether you have a name for it in
   your head** ("this is the danger color", "the control radius", "the card background").

3. Split the findings into two buckets by the promotion heuristic (full breakdown — `references/tokens.md`
   §6):
   - **Keep arbitrary** — unique geometry of a single node, occurs exactly once, with no meaning
     beyond the node (`top-[3px]`, `w-[37rem]`). This is more honest than a superfluous token.
   - **Promote to a token** — the value repeats (≥2–3 times), OR it carries a role, OR it's going to be
     changed centrally during a redesign.

> Signs of "time for a token": a duplicated literal; the value has a role/name; it's edited
> centrally when the theme changes. Signs of "keep it": unique one-off geometry.

---

## Step 2. Is there an external design system / `DESIGN.md` / ready-made tokens?

This fork determines **where the values come from**.

```
Does the project have a design system / DESIGN.md / ready-made CSS variables?
├── YES → MAP it into @theme (name mapping). We do NOT hardcode values — they
│         belong to the design system. Go to Step 2A.
└── NO  → We define the semantic layer ourselves, values are placeholders. Go to Step 3.
```

### Step 2A. Map the external system into `@theme` (don't redefine)

The design system exposes its own variables (named however). Our **canonical semantic
names** merely reference them via `var(…)`. Editing a value happens on the DS side and
flows automatically into the utilities. On a conflict between "the skill's convention" and the design system —
**the design system wins**.

```css
/* design-system.css declared its own variables (this is NOT our file — we don't touch it):
   :root {
     --ds-surface:        oklch(99% 0 0);
     --ds-surface-raised: oklch(100% 0 0);
     --ds-text:           oklch(21% 0.01 255);
     --ds-action:         oklch(52% 0.12 255);
     --ds-radius-control: 0.375rem;
   }
*/

@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* MAPPING: our stable names REFERENCE the design-system tokens. */
  --color-background:      var(--ds-surface);
  --color-foreground:      var(--ds-text);
  --color-card:            var(--ds-surface-raised);
  --color-card-foreground: var(--ds-text);
  --color-primary:         var(--ds-action);
  --radius-md:             var(--ds-radius-control);
}
```

We **don't invent** a dark mode: if the DS switches its `--ds-*` inside `.dark` (or another
context), our names follow it automatically. We set up our own `.dark` block with concrete values
**only** where the DS provides no dark values (see Step 4).

A full breakdown of the mapping, the nuance of `@theme inline` (removing the double indirection at the cost of losing
runtime switching of our token), and the responsibility flow are in `references/tokens.md` §5.

After Step 2A go straight to **Step 5** (replacement in the markup): the semantic names already exist.

---

## Step 3. Define the semantic layer in `@theme`

If there's no DS of your own — we set up the skill's **canonical semantic set**. This is the base
`templates/theme.css`; copy it as a start and replace the **values** for the project, keeping the **names**
stable.

The key rules of the set (in full — `references/tokens.md` §1, the "name→role→utility" table —
`resources/tokens-table.md`):

- **`*` + `*-foreground` pairs.** Every surface comes with a foreground color:
  `--color-card` / `--color-card-foreground`, `--color-primary` / `--color-primary-foreground`,
  `--color-muted` / `--color-muted-foreground`, statuses `--color-danger` / `-foreground`, etc.
  The contrast is "baked into" the theme: the markup writes `bg-card text-card-foreground`.
- **Focus separate from the border.** `--color-ring` lives separately from `--color-border` — the focus ring
  must not depend on the border color.
- **Radii — as a scale:** `--radius-sm/md/lg/xl` → utilities `rounded-sm/md/lg/xl`.
- **Colors — in oklch** (like the engine's default palette), values are placeholders.
- **Translucency — not a token but a slash modifier** (`bg-primary/90`); see Step 6.

Don't add component variables (`--color-button-bg`) by default — only on real
need (the Brand→Semantic→Component hierarchy — `references/tokens.md` §2). In the markup —
**only the semantic level**.

Skeleton (placeholder values; the full canon — `templates/theme.css`):

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Surfaces */
  --color-background: oklch(99% 0 0);
  --color-foreground: oklch(21% 0.01 255);
  /* Cards / muted / focus outlines / primary / accent / statuses … */
  --color-card: oklch(100% 0 0);
  --color-card-foreground: oklch(21% 0.01 255);
  --color-primary: oklch(52% 0.12 255);
  --color-primary-foreground: oklch(99% 0 0);
  --color-border: oklch(92% 0.004 255);
  --color-ring: oklch(62% 0.02 255);
  --color-danger: oklch(58% 0.18 27);
  --color-danger-foreground: oklch(99% 0 0);
  /* …the rest of the canonical set from templates/theme.css… */

  /* Radii */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

> If the default "rainbow" colors get in the way (the risk of `bg-purple-500` bypassing tokens) — you can clear
> the namespace `--color-*: initial;` and keep only your own names. Do this deliberately: the breakdown and
> risks are in `references/tokens.md` §4.3.

---

## Step 4. Dark mode — redefine the same names under `.dark`

The dark palette is **the same semantic names** with different values under the `.dark` selector.
The markup doesn't change at all: `bg-card text-card-foreground` works in both themes, because the
variables resolve at runtime.

```css
/* Same names — different values. The values are placeholders too. */
.dark {
  --color-background: oklch(18% 0.01 255);
  --color-foreground: oklch(96% 0.004 255);
  --color-card: oklch(21% 0.01 255);
  --color-card-foreground: oklch(96% 0.004 255);
  --color-border: oklch(30% 0.01 255);
  --color-primary: oklch(70% 0.12 255);
  --color-primary-foreground: oklch(18% 0.01 255);
  /* …the same set of names as in @theme… */
}
```

Why a `.dark` block and not `@theme`: values in `@theme` land in `:root` globally; the dark
overrides must live under the `.dark` selector so they toggle with a runtime class. `@theme` defines
*names and utilities*, `.dark { … }` — *values for a context*. Multiple themes (e.g.,
high-contrast) use the same technique: another selector class with the same set of names. The full breakdown (two
independent steps: registering the variant + redefining) is in `references/tokens.md` §3.

> If the dark-mode values come from an external DS (Step 2A) — your own `.dark` block is **not needed**: the DS
> switches `--ds-*` itself, and our names follow it.

---

## Step 5. Replace arbitrary/hex in the markup with token utilities (before → after)

Now that the names are set up, we go through the Step 1 findings from the "promote" bucket and change the
literals to semantic utilities. In the markup — **only semantics**, not brand values and not
arbitrary.

```html
<!-- before: the same hex and radius all over the code -->
<button class="bg-[#1f6feb] rounded-[10px]">Save</button>

<!-- after: names from @theme (the value is a design-system placeholder) -->
<button class="bg-primary text-primary-foreground rounded-lg">Save</button>
```

```scss
/* before: a one-off exception acquired the meaning "danger" and got repeated */
.alert_icon { @apply text-[oklch(58%_0.18_27)]; }

/* after: promotion to a token + use by name */
@theme { --color-danger: oklch(58% 0.18 27); }
.alert_icon { @apply text-danger; }
```

Replacement works in **both approaches** (see `references/approaches.md`):

- **A (utility-first):** change the class right in the markup (`bg-[#…]` → `bg-primary`).
- **B (BEM + `@apply`):** change the literal inside `@apply` in SCSS (`text-[oklch(…)]` → `text-danger`),
  respecting the grouping (background/borders/shape and typography are different groups).

Samples of the resulting components on the canonical tokens in both implementations are in `examples/` (`button`,
`card`, `input-field`, `badge`, `alert`, `navbar`, `modal`, `responsive-grid`).

Replacement reminders:

- Write a CSS variable in an arbitrary value as `bg-(--brand)`, **not** `bg-[--brand]`.
- Don't glue names together with strings (`text-${tone}-foreground`) — detection is literal.
- Radii — from the `rounded-sm/md/lg/xl` scale, not `rounded-[…]` and not `rounded-full` without reason.

---

## Step 6. Translucency — a slash modifier, `color-mix` if needed

Translucent shades are **not set up as separate tokens**. By default — a slash modifier on the
utility (the engine applies the alpha on the fly):

```html
<button class="bg-primary hover:bg-primary/90 active:bg-primary/80">Save</button>
<!-- modal backdrop -->
<div class="bg-foreground/50"></div>
```

A named alpha scale via `color-mix()` is justified **only** if specific steps are
reused and need their own **name** (that is, they've become part of the design system):

```css
@theme {
  --color-primary-50:  color-mix(in oklab, var(--color-primary)  5%, transparent);
  --color-primary-100: color-mix(in oklab, var(--color-primary) 10%, transparent);
}
```

We mix `in oklab` — it's consistent with the oklch palette and gives smooth transparency. Full breakdown —
`references/tokens.md` §4.1.

---

## Step 7. Contrast and state check

Before handoff we run the result against the accessibility requirements (full wording —
`references/review.md` items 9–10):

1. **Contrast pairs.** `bg-*` + `*-foreground` pairs are used together everywhere. No
   `text-foreground` over `bg-primary` — on a colored surface use only its `*-foreground`.
2. **Light and dark.** Check both themes (`<html class="dark">`): the pairs are contrasting in both, no
   surface "blends" with the text after being redefined in `.dark`.
3. **Full set of states.** Interactive elements carry `hover:` / `focus-visible:` /
   `active:` / `disabled:`. Visible focus via `outline-ring` / `ring-ring` — don't kill the outline
   without a replacement.
4. **States don't break contrast.** `disabled:opacity-50`, `hover:bg-primary/90`, etc. don't
   take readability below the threshold.
5. **No AI slop.** No purple-blue gradients, glass cards, excessive rounding, blobs —
   the values are neutral and come from the design system (`references/review.md` §5).

---

## Checklist (copy into the task)

- [ ] Inventory done: all `…-[…]`/hex/`oklch(…)` collected, repetition and role counted (Step 1).
- [ ] Findings split into "keep arbitrary" and "promote to a token" by the heuristic (`tokens.md` §6).
- [ ] Fork taken: external DS → **mapped** into `@theme` (`var(--ds-*)` mapping), not
      redefined; otherwise — your own semantic layer (Step 2 / 2A / 3).
- [ ] Semantic layer — canonical names + `*` / `*-foreground` pairs; `ring` separate from
      `border`; radii `--radius-sm/md/lg/xl` (`templates/theme.css`, `resources/tokens-table.md`).
- [ ] In the markup — only semantics; brand/component variables aren't used directly.
- [ ] Dark mode — the same names with different values in `.dark` (or switching on the DS side);
      `@custom-variant dark` registered (Step 4).
- [ ] All promoted arbitrary/hex replaced with token utilities (before → after), in A and in B (Step 5).
- [ ] Translucency — a slash modifier; named alpha only with a reused name
      (Step 6).
- [ ] CSS variables in arbitrary are written `bg-(--brand)`, not `bg-[--brand]`; no string-glued names.
- [ ] Contrast checked in light and dark mode; `bg-*` + `*-foreground` pairs (Step 7).
- [ ] Full set of states + visible `focus-visible`; no AI slop (Step 7).

> Related workflows and references: `references/tokens.md` (concepts and full tables),
> `templates/theme.css` (the canonical `@theme`), `resources/tokens-table.md` (name→role→utility),
> `references/approaches.md` (A vs B), `references/review.md` + `workflows/review-tailwind.md`
> (reviewing tokens), `examples/` (ready-made components on these tokens).
