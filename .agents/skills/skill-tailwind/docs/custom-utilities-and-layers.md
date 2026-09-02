# Custom utilities, layers and variants in v4

> Conceptual breakdown: when you need to go beyond Tailwind v4's ready-made utilities — what to choose
> (`@utility` / `@layer components` / `@custom-variant`) and exactly why. This is a **mental
> model**, not a syntax reference: concise "before/after" triples are in `references/v4-rules.md`
> (rule 7), the `@apply` grouping map is in `resources/apply-grouping.md`, the abstraction ladder
> and "good/bad `@apply`" are in `references/approaches.md`. The source of truth for engine behavior is
> Tailwind v4's default engine behavior; official positions come from
> the official Tailwind documentation.
>
> All examples are framework-agnostic (pure HTML + CSS/SCSS). Token values are placeholders;
> the names are stable (`bg-primary`, `bg-card`, `border-border`, `ring-ring`, `rounded-md`, …).

---

## 1. Where this sits on the abstraction ladder (rungs 4–6)

This page is about the **upper** rungs of the ladder from `references/approaches.md`. You climb here
only when the lower ones are exhausted:

- **Rung 4 — your own `@utility`.** You lack a low-level, **composable** "brick"
  that Tailwind doesn't have: a single behavior that is later combined with variants
  (`hover:`, `md:`) and other utilities. It's still a utility — one responsibility.
- **Rung 5 — a component class in `@layer components`.** A stable **named
  visual primitive** with its own API has emerged (`button`, `card`, `badge`), used
  repeatedly, which utilities in the markup must be allowed to override.
- **Rung 6 — `@apply` as a narrow adapter.** Inside your own class (rung 5) or third-party
  generated markup, you inline utilities, reusing design tokens.

Connection to Approach B: BEM + `@apply` is a **deliberate stop at rungs 4–6**, not a "failure"
of the utility-first approach (the skill's thesis, see `references/approaches.md` §1). `@utility` and `@layer
components` are the very tools Approach B uses to build its semantic classes. Before
climbing here, make sure it can't be solved at rung 2 (extract the **markup** into a partial/fragment) or
rung 3 (define a **token** in `@theme`). A custom utility is justified when what repeats is precisely
a **pattern of properties**, not a value and not a chunk of markup.

---

## 2. `@utility name {}` — a custom utility (instead of v3's `@layer utilities`)

### Why not `@layer utilities`

In v3 you registered a custom utility by wrapping a bare class in `@layer utilities { .x {} }`.
In v4 this is an **anti-pattern**: this way the engine doesn't manage the utility as a utility.

```css
/* ❌ v3 habit (before) */
@layer utilities {
  .content-auto { content-visibility: auto; }
}

/* ✅ v4 */
@utility content-auto {
  content-visibility: auto;
}
```

The difference isn't cosmetic. `@utility` registers the utility **in the engine**, so it:

- is **sorted** in the canonical property order together with built-in utilities (the same
  canonical order as for `@apply` — see `resources/property-order.md`), rather than being
  "glued" to the end of the layer as raw CSS;
- **supports variants** — `hover:content-auto`, `md:content-auto`, `not-hover:content-auto`
  work out of the box. A class hidden inside `@layer utilities` doesn't have this.

So for **single utilities** — always `@utility`. The `@layer utilities` layer is not used for your own
classes in v4 (see `references/v4-rules.md` rule 7, the NEVER list).

### Static vs functional

A static utility is a fixed set of declarations with no value:

```css
@utility content-auto {
  content-visibility: auto;
}
```

A functional utility takes a **value** and therefore **must** end in `-*` (an engine
requirement; see the official Tailwind documentation — Functions and directives / `@utility`). Without `-*`
you can't declare a functional utility:

```css
@utility tab-* {
  tab-size: --value(integer);
}
```

Now `tab-2`, `tab-4` are generated on demand. The name before `-*` is the "root" of the utility.

### `--value()` and `--modifier()` (briefly)

Inside a functional utility, the value from the class name is retrieved with functions. This is an **escape hatch for
utility authors** — the detailed grammar lives in the official Tailwind documentation (the section on functional
utilities); here is exactly enough to read someone else's code:

- `--value(integer)` / `--value(number)` / `--value(percentage)` — a "bare" value of the given type
  (`tab-4` → `4`).
- `--value(--namespace-*)` — a value **from the theme** by namespace. This is how a utility reuses
  `@theme` tokens. For example, reading from the radius scale:

  ```css
  @utility surface-* {
    /* value is pulled from --radius-* (rounded-sm/md/lg in the theme) */
    border-radius: --value(--radius-*);
    @apply bg-card text-card-foreground border border-border;
  }
  ```

  `surface-md` substitutes `--radius-md`. The token names are canonical — the values remain
  placeholders in `@theme` (see `templates/theme.css`, `resources/tokens-table.md`).
- `--value([…])` — support for an arbitrary value in square brackets.
- `--modifier(...)` — the part **after the slash** (`/`). The same mechanism as slash opacity
  `bg-primary/90`: `--modifier()` retrieves `90` (this is `references/v4-rules.md` rule 5 on the
  utility author's side).

You can list several `--value(...)` — the engine takes the first match (theme → arbitrary →
bare). For runtime values from a CSS variable at the **usage site**, the syntax is
`bg-(--brand)`, not `bg-[--brand]` (rule 14 in `references/v4-rules.md`).

---

## 3. `@layer base / components / utilities` — what goes where

`@import "tailwindcss"` expands into the cascade layers `theme → base → utilities` (plus
the reserved `components`); the order in which layers are declared in `index.css` sets the cascade. In v4 `@layer`
is a **native CSS cascade layer**, not a v3 pseudo-directive. Each layer is responsible for its own type
of rules:

| Layer | What we put there | Why |
|---|---|---|
| `@layer base` | Base styles for **elements** by tag selector: `body`/`h1` typography, link defaults, `*` reset additions. | Low specificity; any utility in the markup easily overrides it. Complements preflight. |
| `@layer components` | **Component classes** (rung 5): `.button`, `.card`, `.badge` — usually via `@apply`. | Sits **before** `utilities` in the cascade → a utility on the element (`<button class="button mt-4">`) overrides the component. That's exactly what's needed. |
| `@layer utilities` | In v4 — **not** for your classes. The engine puts things here itself via `@utility`. | Declare your own single utilities with `@utility` (see §2), not manually into this layer. |

The key reason to put a component class specifically in `@layer components` is the **layer order**. This way
`utilities` (and therefore any utility in the markup) wins over the component **regardless of
specificity** — the component sets a default, the utility tweaks it precisely, and no override-rot arises:

```css
@layer components {
  .card {
    @apply rounded-lg border border-border bg-card text-card-foreground shadow-sm;
  }
}
```

```html
<!-- mt-8 and rounded-none override the .card defaults because utilities > components -->
<article class="card mt-8 rounded-none">…</article>
```

> Don't confuse the layers: for a **single utility** — `@utility` (§2), for a **named component** —
> `@layer components` + `@apply`. This is precisely the boundary between rungs 4 and 5 on the ladder.

### Base element styles

`@layer base` is for defaults on **tag selectors**, not classes:

```css
@layer base {
  body { @apply bg-background text-foreground; }
  a    { @apply underline-offset-4 hover:underline; }
}
```

These rules have low priority and don't interfere with utilities in the markup.

---

## 4. `@custom-variant` and `@variant`

These are **different** directives — don't confuse them.

- **`@custom-variant` — declares** a new variant (once, in the entry CSS). Once declared, it
  can be used as a prefix in the markup (`myvariant:bg-muted`) and inside `@variant`.
- **`@variant` — applies** an already existing variant to a rule block **in CSS** (useful in Approach
  B to avoid duplicating the selector).

### `@custom-variant` — two forms

**Inline selector without a body** (selectors are parsed from the parentheses). An `@` prefix inside the parentheses → at-rule
(media/supports), otherwise a style rule:

```css
/* "hover OR focus" as a single variant; the variant stack reads left to right */
@custom-variant hocus (&:hover, &:focus);
```

```html
<button class="bg-card hocus:bg-muted">…</button>
```

**Block form with a body and `@slot`** — `@slot` marks the point where the engine inserts the utilities:

```css
@custom-variant theme-midnight {
  &:where([data-theme="midnight"] *) { @slot; }
}
```

The canonical example of this form is a **class-based dark mode** (overriding the built-in `dark`
so it keys off the `.dark` class rather than only `prefers-color-scheme`):

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Details on dark mode and `.dark` overrides are in `docs/dark-mode.md` and `references/tokens.md`;
here it's just an illustration of the `@custom-variant` mechanism.

> Historical subtlety (from the sources): `@variant` **without a body / with `@slot`** is treated by the engine as
> `@custom-variant` (the legacy form). In new code, use `@custom-variant` for **declaring**, and
> leave `@variant` for **applying** (below).

### `@variant` — apply a variant in CSS

In Approach B, instead of repeating the state selector you can apply a variant with the `@variant` directive —
especially handy for media/feature variants (`dark`, `supports`, breakpoints) that have no simple
`&:` equivalent:

```scss
@reference "../app.css";  /* @apply in a separate module/<style> requires @reference (rule 15) */

.card {
  @apply bg-card text-card-foreground;

  /* apply the built-in dark variant to this block without duplicating the selector */
  @variant dark {
    @apply ring-1 ring-border;
  }
}
```

This is the equivalent of `@apply dark:ring-1 dark:ring-border`, but more readable when there's more than
one property group inside the state.

The same applies to **breakpoints** — `@variant md { @apply … }` is the v4 way to apply a breakpoint
inside custom CSS (it compiles to `@media (width >= 48rem) { … }`):

```scss
.cardGrid {
  @apply grid grid-cols-1 gap-4;        /* mobile base */
  @variant md { @apply grid-cols-2 gap-6; }  /* breakpoint override, grouped */
}
```

It is the exact equivalent of `@apply md:grid-cols-2 md:gap-6` (or the codemod's explicit
`@media (width >= theme(--breakpoint-md)) { @apply grid-cols-2 gap-6; }`); use the block form when one
breakpoint flips several utilities of an element, and the inline form for a 1–2 utility flip. ⚠️ This
replaces v3's `@screen md { … }`, which is **removed** in v4 — the engine passes it through unrecognized
and silently drops the wrapped rules. When and why to reach for the block form (with worked Approach-B
before/after) is in `docs/responsive-and-container-queries.md` §5.

> **`@variant` nests at any depth.** It isn't limited to a block's top level — it works inside a
> nested element selector (`&-nav`), inside a state (`&:hover`), inside a modifier (`&_outline`), or any
> combination, as deeply as the rule nests. It applies its variant to whatever rule block contains it:
>
> ```scss
> .siteHeader {
>   &-nav {
>     @apply hidden;                      /* mobile base on the nested element */
>     @variant md { @apply flex gap-6; }  /* breakpoint override, still grouped on this element */
>   }
> }
> ```
>
> The same holds for non-breakpoint variants (`@variant dark`, `@variant supports`). So you never need to
> hoist responsive/state overrides up to the block root just to use `@variant`.

---

## 5. Example: a custom utility + a component class with `@apply`

A coherent fragment showing rungs 4–6 together. The `@apply` group order is canonical (layout
→ sizing → spacing → background/borders/shape → typography → effects → interaction; then states,
then modifiers), with the full breakdown in `resources/apply-grouping.md`.

**entry CSS** (rung 4 — your own `@utility`):

```css
@import "tailwindcss";
@import "./theme.css";   /* @theme with semantic tokens (templates/theme.css) */

/* Composable "brick": a visible-focus preset. Available as an ordinary utility,
   works with variants (focus-visible:focus-ring) and in @apply. */
@utility focus-ring {
  @apply outline-none ring-2 ring-ring ring-offset-2;
}
```

Using the utility directly in the markup (Approach A, rungs 1–3):

```html
<a href="#" class="rounded-md focus-visible:focus-ring">Link</a>
```

**Component class** (rungs 5–6 — `@layer components` + `@apply`, Approach B). The same `focus-ring`
is reused inside:

```css
@layer components {
  .button {
    @apply inline-flex items-center justify-center gap-2;
    @apply h-10;
    @apply px-4;
    @apply rounded-md bg-primary;
    @apply text-sm font-medium text-primary-foreground;
    @apply transition-colors duration-150;
    @apply cursor-pointer select-none;

    &:hover         { @apply bg-primary/90; }      /* slash opacity (rule 5) */
    &:focus-visible { @apply focus-ring; }         /* reuse our own utility */
    &:active        { @apply bg-primary/80; }
    &:disabled      { @apply opacity-50 pointer-events-none; }

    /* block modifier */
    &_outline {
      @apply border border-border bg-background text-foreground;
      &:hover { @apply bg-muted; }
    }
  }
}
```

```html
<button type="button" class="button">Save</button>
<button type="button" class="button button_outline">Cancel</button>
```

What the example illustrates:

- **rung 4** (`@utility focus-ring`) → **rung 5** (`.button` in `@layer components`) →
  **rung 6** (`@apply` inside). `focus-ring` is reused both in the markup and in the component;
- the component sits in `@layer components` → a utility in the markup (`<button class="button mt-6">`)
  overrides its defaults (§3);
- the full set of `hover / focus-visible / active / disabled` states is a requirement for interactive
  components (`references/approaches.md`); the focus is **visible** via `ring-ring`;
- semantic tokens (`bg-primary`, `text-primary-foreground`, `border-border`, `ring-ring`),
  no brand hex and no AI slop; a ready paired `button` example in both implementations is in
  `examples/button/`.

> If the SCSS compiles **separately** from the entry (a CSS module, an isolated `<style>`), the first
> line needs `@reference "..."`, otherwise `@apply` won't see the tokens (rule 15,
> `references/v4-rules.md`).

---

## 6. Related `@apply` engine limitations (so you don't hit a wall)

Three `@apply` gotchas from the official Tailwind documentation that are directly relevant to this page:

- **`@apply` works with variants**: `@apply hover:underline` is valid (candidates compile
  as ordinary classes). But in Approach B, states are more often moved into nested `&:hover { @apply … }`
  for grouping — both ways are correct (`resources/apply-grouping.md`).
- **Cycles → error.** Dependencies between `@apply` and `@utility` are sorted topologically; if
  `@utility a` applies `b`, and `b` applies `a`, the engine fails with "Circular dependency detected".
- **`@apply` is forbidden in `@keyframes`** and doesn't mix CSS mixins (dashed-`--foo`) with utilities in
  a single `@apply`. This is part of "bad `@apply`" (`references/approaches.md` §4, the SKILL NEVER list).

---

## See also

- `references/v4-rules.md` — rule 7 (`@layer utilities` → `@utility`), rule 14
  (`bg-(--var)`), rule 15 (`@reference`), the NEVER list.
- `references/approaches.md` — the abstraction ladder (§1, rungs 4–6), good/bad `@apply` (§4).
- `docs/responsive-and-container-queries.md` — §5: when to extract breakpoint `@apply` into a
  `@variant <breakpoint> { … }` block (Approach B), and the `@screen` → `@variant` migration note.
- `resources/apply-grouping.md` + `resources/property-order.md` — the `@apply` group order.
- `templates/entry.css` — commented-out `@utility` and `@custom-variant` stubs.
- `templates/theme.css` / `resources/tokens-table.md` — canonical semantic tokens.
- `examples/button/`, `examples/badge/` — component classes via Approach B (`@apply`, grouped).
