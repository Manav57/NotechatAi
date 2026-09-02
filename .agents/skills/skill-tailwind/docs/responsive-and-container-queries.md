# Responsiveness and container queries (v4)

A conceptual breakdown of how Tailwind v4 "thinks" about responsiveness: why `sm:`/`md:`/`lg:`
are read **bottom-up** (mobile-first), what exactly these prefixes mean, and when you should measure
the **container** width (`@container` + `@sm:`/`@md:`) rather than the **viewport**. This is the implementation layer —
token names are canonical semantic, breakpoint values are fixed by the engine.

References this document relies on (we don't duplicate — we link):
- a quick look at "new v4 mechanisms" (containers, `starting:`, baseline) — `references/gotchas.md` §10;
- a grid example broken down into both approaches — `examples/responsive-grid/` (utility + bem);
- the order of `@apply` groups for Approach B — `resources/property-order.md`, `resources/apply-grouping.md`;
- applying a breakpoint inside custom CSS with `@variant` (vs `@custom-variant`) — `docs/custom-utilities-and-layers.md` §4.

---

## 1. The mobile-first mental model: prefix = "from the breakpoint and wider"

The main gotcha people carry over from CSS habits: thinking of `sm:` as "on small screens".
This is **wrong**. In v4 (just like in v3) breakpoint variants are `min-width` media queries, i.e.
the threshold **"from this width and up"**.

- A utility **with no prefix** always applies — it's the base, i.e. the **mobile** layer (the narrowest
  screen and wider).
- `sm:` means "**at breakpoint `sm` and wider**", not "on small screens".
- `md:` — "from `md` and wider", overrides the base and `sm:` on wide screens.

```html
<!-- READS AS: 1 column everywhere; from sm and wider — 2; from lg and wider — 3 -->
<ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">…</ul>
```

Hence the practical building rule: **first lay out the mobile design with no prefixes**, then
**layer** changes onto `sm:`, then `md:`, and so on — each subsequent breakpoint
overrides the previous one on wider screens. Not the other way around. If an effect "got lost", almost
always the cause is that the base (prefix-less) layer was forgotten, and the behavior "falls through" on narrow
screens.

A typical mistake is writing `sm:` hoping to "target the phone": on a phone it's actually the
**prefix-less** base that fires, while `sm:` kicks in on a tablet and wider. To target "narrow screens
only", you need a `max-*` variant (see §3).

---

## 2. Default breakpoints are in `rem`, not `px`

Five default breakpoints (`--breakpoint-*` tokens, Tailwind v4 default values):

| Variant | min-width | ≈ px at 16px/rem |
| --- | --- | --- |
| `sm` | `40rem` | 640 |
| `md` | `48rem` | 768 |
| `lg` | `64rem` | 1024 |
| `xl` | `80rem` | 1280 |
| `2xl` | `96rem` | 1536 |

Why `rem` and not `px`: a breakpoint in `rem` scales together with the user's font
size — if someone increased the base font in their browser, the layout switches "earlier", preserving
readability. This is a deliberate engine choice, not cosmetics.

Custom breakpoints are defined as ordinary tokens in `@theme` (the `@theme` mechanics and the "top-level
variables only" rule — `references/gotchas.md` §2):

```css
@theme {
  --breakpoint-xs: 30rem;   /* added our own threshold → xs:, max-xs: etc. appear */
  /* --breakpoint-2xl: initial;  ← this is how you remove a default breakpoint */
}
```

An arbitrary one-off threshold without a token — `min-[50rem]:flex` (escape hatch, use sparingly).

---

## 3. `max-*` and ranges: targeting "narrow" and a "band"

`min-width` variants are enough for "from and wider". For the reverse direction there are `max-*` variants —
that's `max-width`, i.e. **"up to this breakpoint"**:

```html
<!-- hide on narrow (below md), show from md and wider -->
<aside class="hidden md:block">…</aside>

<!-- the opposite: burger button only below md (on narrow) -->
<button class="md:hidden">…</button>
```

A **range** (a band "from X to Y") is assembled by stacking a `min` variant and a `max` variant — both
apply simultaneously:

```html
<!-- visible ONLY in the band [md, xl): from md and wider, but strictly below xl -->
<div class="hidden md:max-xl:block">…</div>
```

Here the same left-to-right rule for reading the variant stack applies as described in
`references/gotchas.md` §1: `md:` and `max-xl:` attach two media conditions, and the element is visible only
when **both** are satisfied. An arbitrary band without tokens — `min-[40rem]:max-[60rem]:flex`.

---

## 4. Container queries: measuring the parent, not the screen

The breakpoint variants `sm:`/`md:` always look at the **viewport** — the width of the whole window. But a component
often doesn't span the whole screen: the same card grid can sit both in a narrow sidebar column and
in a wide main area. Their viewport is the same, but the **space** is different. This is exactly where container
queries are needed.

The mechanics — two steps:

1. On the **parent**, declare a container context with the `@container` utility (this is `container-type: inline-size`).
2. On the **children**, use the container variants `@sm:`/`@md:`/`@lg:` — their thresholds are measured **from the width
   of the parent container**, not from the screen.

```html
<!-- @container on the wrapper → the child grid reacts to the WIDTH OF THE WRAPPER -->
<div class="@container">
  <ul class="grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3">…</ul>
</div>
```

The thresholds of container variants come from the `--container-*` scale (tokens `--container-3xs 16rem` …
`--container-7xl 80rem`, Tailwind v4 default values) — this is a **separate scale** from
viewport breakpoints. That is, `@sm` (container) ≠ `sm` (viewport): the former measures the parent against the
container scale, the latter — the screen against the breakpoint scale.

`max-*`, ranges and named containers work here too: `@max-md:`, `@min-md:@max-lg:`, and for
nested containers — naming (`@container/sidebar` → `@md/sidebar:`), so a child can target
a specific ancestor. This document is conceptual; for the exact utility names see the official
Tailwind documentation.

> Baseline: container queries are a native CSS feature that v4 relies on (Safari 16.4+ /
> Chrome 111+ / Firefox 128+). More on "new mechanisms and their polyfilling" —
> `references/gotchas.md` §10.

### When a container is better than the viewport — the decisive criterion

The two scales cover overlapping ground, so you need a tie-breaker, not a feel. **Decide by what the grid's
CELLS are, not by where the grid sits:**

- **A grid whose cells are reusable components** (the same card/tile/list-item primitive rendered N times) →
  **container query** (`@container` on the grid + `@sm:`/`@md:` column switches). A reusable component must
  reflow by the width it actually gets — the same card may sit in a wide main area on one page and a narrow
  column on another — so it must "not know" about the screen.
- **A one-off page section's own internal layout** (a hero, a two-column about-block, a footer's column
  split — markup that exists once and is not a reusable cell) → **viewport breakpoints** (`md:`/`lg:`). It
  occupies a known slot in the page and there is nothing to make container-relative.

The ambiguous middle case — a reusable card grid that happens to live inside a **page** layout — is still
decided by the **cells**, not by where the grid sits: the cells are reusable, so it is a container-query
candidate. So **flag** viewport-only column switches (`sm:grid-cols-2 lg:grid-cols-3`) copy-pasted across
pages on a grid that wraps a reusable card; but do **not** flag viewport breakpoints on a one-off page
section — that is the correct tool there.

Worked container card-grid: `@container` on the wrapper, container variants on the grid, so the cards reflow
by the grid's **own width**. Drop this same grid into a narrow sidebar column and it collapses toward one
column **without touching the browser window**:

```html
<!-- the grid's cells are a REUSABLE card → switch columns on the CONTAINER -->
<div class="@container">
  <ul class="grid grid-cols-1 gap-4 @sm:grid-cols-2 @lg:grid-cols-3">
    <li class="flex flex-col gap-1 p-4 rounded-lg border border-border bg-card text-card-foreground">…</li>
    <li class="flex flex-col gap-1 p-4 rounded-lg border border-border bg-card text-card-foreground">…</li>
    …
  </ul>
</div>
```

Contrast the one-off section, which has no reusable cell to make container-relative and so correctly keys to
the viewport:

```html
<!-- a one-off hero split that exists once on the page → viewport breakpoints are correct -->
<section class="grid grid-cols-1 gap-8 lg:grid-cols-2">…</section>
```

Both axes are worked through in both approaches in `examples/responsive-grid/`: the reusable card grid
**measures the container**, while a one-off **page layout measures the viewport**.

---

## 5. A breakdown using the `responsive-grid` example: container vs viewport

The `examples/responsive-grid/` example shows both axes of choice on a single structure: the same UI
(a card grid) is built both with container variants and with viewport variants, in both approaches A and B. Below —
a conceptual breakdown; the full code is in the example files, we don't duplicate it here.

The key contrast in the example: **the same cards**, but the column switch points are computed
differently.

- A block with `@container` + `@sm:grid-cols-2 @lg:grid-cols-3` — columns depend on the width of the **wrapper**.
  Narrow the wrapper (e.g. via `max-w-*`) and the grid collapses to a single column, **without touching the browser
  window**. This makes the grid reusable anywhere.
- A contrasting block with `sm:grid-cols-2 lg:grid-cols-3` (no `@container`) — columns depend on the width of the
  **screen**. Narrowing the wrapper changes nothing; the number of columns reacts only to a window resize.

The difference is exactly one thing: `@sm`/`@lg` look at the **container**, `sm`/`md`/`lg` — at the **viewport**.

### Approach A (utility-first)

The container context and breakpoints live right in the markup. The prefix-less base (`grid-cols-1`) is the
mobile/narrow layer, container variants are layered on top:

```html
<div class="@container">
  <ul class="grid grid-cols-1 gap-4 @sm:grid-cols-2 @lg:grid-cols-3">
    <li class="flex flex-col gap-1 p-4 rounded-lg border border-border bg-card text-card-foreground">…</li>
    …
  </ul>
</div>
```

The full file — `examples/responsive-grid/responsive-grid.utility.html`.

### Approach B (BEM + `@apply`)

The same layout, but extracted into the semantic block `cardGrid` (the container context — on the block,
the responsiveness — on the list element). `@container` and breakpoint variants are inlined via `@apply`,
grouped by property type (`layout → …`, see `resources/apply-grouping.md`):

```scss
@reference "../app.css";   /* needed only if the file is compiled separately from the entry CSS */

.cardGrid {
  /* container context — the child grid reads the width of THIS block */
  @apply @container;

  &-list {
    @apply grid grid-cols-1 gap-4;
    /* responsiveness BY CONTAINER: @sm → 2, @lg → 3 */
    @apply @sm:grid-cols-2 @lg:grid-cols-3;
  }
}
```

Switching "container → viewport" in Approach B is expressed by a **block modifier**
(`cardGrid_viewport`), which overrides the list's responsiveness to the viewport variants `sm:`/`lg:` and
does not set `@container`. The full file — `examples/responsive-grid/responsive-grid.bem.scss` (the markup —
`responsive-grid.bem.html`).

> A note on `@reference`: this line is needed only when the SCSS is compiled in isolation (a CSS module,
> scoped/`<style>`). In a single entry CSS that already has `@import "tailwindcss"`, it's redundant. Details —
> `references/gotchas.md` §6.

### Breakpoints inside Approach B: inline `@apply` vs the `@variant` block

The two responsive lines above use **inline** breakpoint variants in `@apply`
(`@apply @sm:grid-cols-2 @lg:grid-cols-3`). There's a second, fully equivalent v4 form: apply the
breakpoint to a whole rule block with the **`@variant`** directive, and put plain (prefix-less) utilities
inside. The same applies to viewport breakpoints — which is exactly how the `cardGrid_viewport` modifier
overrides the responsiveness from the container scale to the screen:

```scss
.cardGrid {
  /* …container context + base list as above… */

  /* block modifier: react to the VIEWPORT instead of the container (no @container) */
  &_viewport &-list {
    @apply grid grid-cols-1 gap-4;
    /* responsiveness BY VIEWPORT, @variant block form */
    @variant sm { @apply grid-cols-2; }
    @variant lg { @apply grid-cols-3; }
  }
}
```

`@variant sm { @apply grid-cols-2; }` compiles to `@media (width >= 40rem) { … }` and is the direct
equivalent of writing `@apply sm:grid-cols-2 lg:grid-cols-3` on one line. Pick whichever reads better in
context (see the readability note below). Both forms belong to the **layout** group, so a `@variant`
block stays in the layout position next to the base layout line it overrides
(`resources/apply-grouping.md`). The mechanics of `@variant` (and how it differs from `@custom-variant`)
are in `docs/custom-utilities-and-layers.md` §4.

> `@variant` is **not** limited to the block's top level shown here: it nests at any depth — inside a
> nested element (`&-list`, `&-nav`), a state (`&:hover`), or a modifier (`&_viewport`) — and applies its
> breakpoint to whatever rule block contains it. So responsive overrides stay grouped on the element they
> belong to; you don't hoist them to the block root. See `docs/custom-utilities-and-layers.md` §4.

> `@screen` → `@variant`: the v3 `@screen md { … }` directive is **removed** in v4. The compiler does not
> error on it — it passes the at-rule through unrecognized and the wrapped rules are silently dropped (a
> silent failure). Inside custom CSS use `@variant md { @apply … }` (shown above); the official upgrade
> codemod emits the equivalent plain media query `@media (width >= theme(--breakpoint-md)) { @apply …; }`.
> Both are correct; `@variant` is the shorthand.

#### Inline or `@variant`? A readability call, not a rule

When a breakpoint flips just **one or two** utilities, the inline form is shorter and clearer — keep it on
the grouped `@apply` line:

```scss
&-row {
  @apply flex flex-col sm:flex-row;   /* one flip → inline is fine */
}
```

When an element accumulates **many** same-prefix utilities, or **one** breakpoint flips **several property
groups** at once, the `@variant` block reads better — the prefix-less mobile base stays on its normal
grouped lines and the override is collected in one place:

```scss
/* before — breakpoint "soup": one md: scattered across (and stranded on) several lines */
&-menu {
  @apply hidden flex-col gap-3 md:flex md:flex-1 md:flex-row md:items-center md:gap-4;
  @apply pb-3 md:pb-0;   /* a LAYOUT md: stranded onto the spacing line */
}

/* after — base stays mobile, grouped one @apply per category; md overrides collected in one block */
&-menu {
  @apply hidden flex-col gap-3;
  @apply pb-3;
  @variant md { @apply flex flex-1 flex-row items-center gap-4 pb-0; }
}
```

Beyond fewer repeated prefixes, the `@variant` block also restores **group purity**: in the "before", a
layout `md:` had drifted onto the spacing line; collecting all the `md:` overrides into one block
keeps each base group line honest (one `@apply` per property category). This is a presentation choice —
there's no hard utility-count
threshold and no rule to hoist a breakpoint across sibling elements. And it cuts **both** ways: don't push
viewport responsiveness wholesale into SCSS just because you can. A page-level layout decision still reads
most clearly as viewport variants in the markup (Approach A); reach for the `@variant` block only when a
genuine Approach-B primitive has earned its grouped `@apply`.

---

## 6. Summary (a quick self-check)

- [ ] A prefix-less utility is the **mobile base**; `sm:` = "from `sm` and wider", not "on small".
- [ ] I build the layout bottom-up: base → `sm:` → `md:` → `lg:`, each step overriding the previous one.
- [ ] I remember that default breakpoints are in `rem` (`sm 40rem … 2xl 96rem`), not in `px`.
- [ ] "Narrow screens only" and bands — via `max-*` and the stack `md:max-xl:`, not via a single `min`.
- [ ] A reusable component measures the **container** (`@container` + `@sm:`), a page layout — the **viewport** (`sm:`).
- [ ] A reusable card grid switches columns on the **container**, not viewport-only `sm:`/`lg:` copy-pasted per page.
- [ ] The container scale (`--container-*`) ≠ the breakpoint scale (`--breakpoint-*`): `@sm` ≠ `sm`.
- [ ] In Approach B `@container` and breakpoints go into the "layout" group; the viewport variant is a block modifier.
- [ ] In Approach B I never write `@screen md` (removed in v4 → silently dropped); I use `@variant md { @apply … }`.
- [ ] Many same-prefix breakpoint utilities on one element → I may collect them in a `@variant <bp>` block (optional, readability).
