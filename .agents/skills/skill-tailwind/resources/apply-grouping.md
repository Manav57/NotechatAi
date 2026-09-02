# `@apply` grouping (Approach B: BEM + `@apply` in SCSS)

> A practical reference on **how to break `@apply` into readable lines** under Approach B
> (BEM classes + `@apply` in SCSS). Builds on the canonical Tailwind v4 property order — see
> `property-order.md` (local source; the order itself is defined by the Tailwind v4 engine).

## Why group

In Approach B we assemble a component from utilities inside a single BEM class. If you dump all
utilities into one `@apply` line, that block is as hard to read as the "utility soup" in the markup.
The solution is to **split `@apply` across several lines by property meaning**, in the same sequence
the engine already lays the declarations out in (see `property-order.md`).

Important: **the order of utilities inside `@apply` does not affect the cascade** — Tailwind re-sorts
properties by the canonical array at compile time. Grouping exists **purely for source readability**.
That is why it must be stable and predictable — hence the fixed 7 groups below.

> **When to choose B over A** — see `references/approaches.md`. In short: B fits when markup is
> repeated, when the team convention is "clear at a glance", and when styling third-party/generated DOM.
> Approach A (utilities in the markup) is equally valid; the grouping below is for cases where you have deliberately chosen B.

## Seven groups (in this order)

Write each group as a **separate `@apply` line**. Skip empty groups. The group order is fixed and
matches a coarsened view of the canonical array.

The skill does **not** label these groups with category comments. The line order alone conveys the
grouping: one `@apply` line per property category, in the fixed sequence below, so every block reads
the same way and a reader knows which line carries which kind of property by its position. (Semantic
comments that explain a specific behavior, or that mark a BEM element/modifier, are a different thing
and stay — see the worked example.)

| # | Group | What it includes (utilities) |
|---|--------|----------------------|
| 1 | **Layout / position** | `position`/`absolute`/`relative`/`fixed`/`sticky`, `inset-*`/`top`/`right`/`bottom`/`left`, `z-*`, `block`/`flex`/`grid`/`inline-*`/`hidden`, `flex-*`/`grid-*`/`col-*`/`row-*`, `place-*`/`items-*`/`justify-*`/`content-*`, `gap-*` |
| 2 | **Sizing** | `w-*`, `h-*`, `size-*`, `min-w-*`/`min-h-*`, `max-w-*`/`max-h-*`, `aspect-*` |
| 3 | **Spacing** | `m-*`/`mx-*`/`my-*`/`mt-*…`, `p-*`/`px-*`/`py-*/…`, `space-x-*`/`space-y-*` |
| 4 | **Background / borders / shape** | `bg-*`, `border`/`border-*`, `rounded-*`, `ring-*`, `shadow-*`, `outline-*`, `divide-*` |
| 5 | **Typography** | `font-*`, `text-<size>` (`text-sm`…), `text-<color>` (`text-foreground`…), `leading-*`, `tracking-*`, `text-center`/`-left`, `whitespace-*`, `truncate`, `uppercase` |
| 6 | **Effects / motion** | `opacity-*`, `transition`/`transition-*`, `duration-*`, `ease-*`, `transform`, `scale-*`/`rotate-*`/`translate-*`, `blur-*`/`brightness-*`/`filter` |
| 7 | **Other interaction** | `cursor-*`, `select-none`, `pointer-events-*`, `overflow-*` |

### Place each utility by its CSS property

Put a utility on the line for the group it actually belongs to — by its CSS property, not by where it
visually sits in the markup. A short lookup for the cases that get misfiled most often:

| Utility | Goes in group |
|---------|---------------|
| `relative` / `absolute` / `fixed` / `sticky` (position) | **1 — Layout / position** |
| `leading-*` / `tracking-*` | **5 — Typography** |
| `shrink-0` / `grow` / `flex-1` / `flex-*` (flex-**item**) | **2 — Sizing** (flex-item sits in the sizing block of the canonical order, not in layout) |
| `list-*` (`list-none` / `list-disc` / `list-inside` — list-style) | **7 — Other interaction** (list-style is its own slot near the end of the canonical order; keep it off the interaction line — give it its own `@apply` line, not merged with `cursor-*`/`select-*`) |
| `overflow-*` | **7 — Other interaction** |

If you are unsure, check `property-order.md`, which lists every utility's property in canonical order.

### Pick one focus-ring style for the whole component set

`outline-*` and `ring-*` are **both group 4** (background / borders / shape), so either is correctly
placed — but they are two different ways to draw the same affordance, and sibling components should not
mix them arbitrarily. Decide on **one** visible-focus expression for the set and use it everywhere, e.g.

```scss
&:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
```

so that a card, a button, and a link next to each other all show the same keyboard focus, rather than one
drawing an outline and the next a box-shadow ring with an offset gap. When that same focus block repeats
across several components, **promote it** (the standard "promote on repeat" move) to a custom utility and
`@apply` it instead of re-authoring the ring per component:

```scss
@utility focus-ring {
  @apply outline-2 outline-offset-2 outline-ring;
}

/* then, in each component: */
&:focus-visible { @apply focus-ring; }
```

This keeps the focus indicator consistent and gives you a single place to retune it. (Either
`outline-*` or `ring-*` is a valid base for the utility — pick one and stay with it across the set.)

### Breakpoint variants live in the layout group

Responsive utilities belong to **group 1 (layout / position)** wherever they appear, and there are two
equally valid ways to write them in Approach B:

- **Inline** on the grouped line: `@apply flex-col gap-3 md:flex-row md:gap-4;`
- **In a `@variant` block:** keep the mobile base on the normal grouped lines, then collect the
  breakpoint overrides into one block — `@variant md { @apply flex-row gap-4; }` (the v4 replacement for
  the removed v3 `@screen`; it compiles to `@media (width >= 48rem) { … }`, and the codemod-accurate
  long form is `@media (width >= theme(--breakpoint-md)) { … }`).

A 1–2 utility flip reads fine inline. Once one element accumulates several same-prefix utilities (or one
breakpoint flips several property groups), the `@variant` block usually reads better. Both forms are
correct — treat the choice as readability, not rule. Do **not** push viewport responsiveness wholesale
into SCSS by default: the breakpoint utilities in the markup remain the simplest option for one-off layout.

After the seven groups come **states** and **modifiers**:

8. **Nested states** — in the order `&:hover`, `&:focus-visible`, `&:active`, `&:disabled`
   (plus `&:focus-within`, `&:checked` as needed). Inside each state — the same 7 groups.
9. **Elements, then modifiers** — BEM elements (`&-icon`, `&-label`) follow the base, in DOM order;
   BEM block modifiers (`&_primary`, `&_compact`, `&_active`) that override individual groups come
   **last**. Inside an element or modifier — again the same 7 groups + their own states when needed.

So a complete block body reads top to bottom as: **(1)** the base property groups 1–7, **(2)** the
base states, **(3)** the elements in DOM order, **(4)** the block modifiers. This ordering carries no
cascade weight (the engine re-sorts declarations regardless) — it is purely for predictable, scannable
source, so every block looks the same and a reader always knows where to find each part.

### Note on `text-<size>` vs `text-<color>`

In group 5, `text-sm` (font-size) and `text-foreground` (color) are **different** CSS properties, and
in the canonical array `font-size` comes before `color`. Keep them on one typography line; if you
prefer, you can split them across two lines (font metrics → text color), but it is simpler to keep
them together.

## Worked example: `.button`

A complete `button` component in Approach B. The skill's default BEM convention: block `button`,
elements via a hyphen (`button-icon`), block modifiers via an underscore (`button_primary`), element
modifier via an underscore (`button-icon_loading`). (This is the default; if the project already
declares another scheme, follow that one.) Values come through semantic tokens from `theme.css`
(placeholders, replaced to match the project's design system).

```scss
/* If this SCSS compiles separately from the entry CSS (CSS module / isolated <style>),
   the first line of the file needs @reference, otherwise @apply won't see the tokens:  */
/* @reference "../app.css"; */

.button {
  @apply inline-flex items-center justify-center gap-2;
  @apply h-10 min-w-0;
  @apply px-4 py-2;
  @apply rounded-md border border-border bg-card shadow-xs;
  @apply text-sm font-medium text-card-foreground;
  @apply transition-colors duration-150 ease-out;
  @apply cursor-pointer select-none;

  /* --- States (same group order inside each) --- */
  &:hover {
    @apply bg-muted;
  }
  &:focus-visible {
    @apply outline-none ring-2 ring-ring;          /* visible focus */
  }
  &:active {
    @apply translate-y-px;
  }
  &:disabled {
    @apply opacity-50;
    @apply pointer-events-none;
  }

  /* --- Element --- */
  &-icon {
    @apply size-4;
    @apply transition-transform duration-150;

    /* element modifier */
    &_loading {
      @apply animate-spin;
    }
  }

  /* --- Block modifiers (override individual groups) --- */
  &_primary {
    @apply border-transparent bg-primary shadow-sm;
    @apply text-primary-foreground;

    &:hover  { @apply bg-primary/90; }             /* slash opacity */
    &:active { @apply bg-primary/80; }
  }

  &_danger {
    @apply border-transparent bg-danger;
    @apply text-danger-foreground;

    &:hover  { @apply bg-danger/90; }
    &:focus-visible { @apply ring-danger; }
  }

  &_ghost {
    @apply border-transparent bg-transparent shadow-none;
    @apply text-foreground;

    &:hover { @apply bg-muted; }
  }
}
```

The corresponding markup:

```html
<button class="button button_primary">
  <svg class="button-icon" aria-hidden="true"><!-- ... --></svg>
  Save
</button>

<button class="button button_danger" disabled>Delete</button>
```

### What the example illustrates about the skill's rules

- **Full set of states** — `hover` / `focus-visible` / `active` / `disabled` are all present
  (a requirement for component examples). Focus is **visible** (`ring-2 ring-ring`).
- **Semantic tokens** — `bg-card`, `text-card-foreground`, `border-border`, `ring-ring`,
  `bg-primary`/`text-primary-foreground`, `bg-danger`/`text-danger-foreground`. No brand colors
  and no arbitrary values.
- **v4 slash opacity** — `bg-primary/90` (not `bg-opacity-*`).
- **v4 renames** — `shadow-xs` / `shadow-sm` (not v3 `shadow-sm` / `shadow`).
- **Motion via `transform`/`opacity`** — `translate-y-px`, `opacity-50`, `animate-spin`;
  duration 150ms via `duration-150` (a fast, unobtrusive response).
- **The skill's BEM convention** — a single block `button`; element `button-icon` (hyphen); block
  modifier `button_primary` (underscore); element modifier `button-icon_loading` (underscore).
  The element derives from the block, with no `-a-b` chains. This is the default scheme; if the project
  already declares another one, follow that instead.

## Relationship to `property-order.md`

The seven groups are a coarsened view of the canonical property order (see `property-order.md`). If
you are unsure which group a utility falls into or in what order to place it within a line, check the
table in `property-order.md`; it lists the same sequence at the level of individual CSS properties.
Since the engine re-sorts declarations by this array anyway, **`@apply` grouping is a matter of
readability, not cascade correctness**.
