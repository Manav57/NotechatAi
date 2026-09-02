# Two approaches: utility-first vs BEM + `@apply`

> The skill's primary methodological reference. Tailwind CSS v4 gives you **two equally valid** ways to
> organize styles. This document explains the philosophy of each, provides working examples, and helps you
> deliberately pick an approach for a specific component. **We consider the value of both equal** — it's
> a question of context (repeated markup, third-party DOM, team convention), not "right/wrong."
>
> All the code below is framework-agnostic: plain HTML + CSS/SCSS. Token names are canonical
> (`bg-primary`, `text-foreground`, `border-border`, `rounded-md`, etc.); token values live in
> `@theme` (see `templates/theme.css`) and are swapped to match the project's design system.

---

## 1. Abstraction ladder (the framing for the choice)

Before choosing "utilities or `@apply`," climb the abstraction ladder and stop at the
minimal sufficient rung. This is the shared framework for **both** approaches: Approach A lives on
rungs 1–3, Approach B is a deliberate choice of rungs 4–6.

| Rung | What you do | When |
|---|---|---|
| **1. Utilities in markup** | Compose the UI from ready-made classes right in the HTML. | Default. Always start here. |
| **2. Reusable markup block** | Extract repeated markup into a project-native reusable block (partial / include / template / template fragment). | When **markup** repeats. This removes duplication without a CSS abstraction. |
| **3. Tokens via `@theme`** | A repeated value becomes a named token (color, radius, spacing). | The value is part of the design language and must change centrally. |
| **4. A custom `@utility`** | You're missing a low-level behavior that Tailwind doesn't have. | You need a composable "brick" (a focus-ring preset, a layout helper). |
| **5. A component class in `@layer components`** | A stable named visual primitive. | There's a stable API (`button`, `card`, `badge`) used many times. |
| **6. `@apply` as a narrow adapter** | You inline utilities into your own CSS. | You're styling third-party/generated markup, small repeats, token-oriented CSS. |

**The skill's key thesis:** BEM + `@apply` is a **deliberate choice of rungs 4–6**, not a "failure" of
the utility-first approach. Approach B doesn't break the ladder — it just reaches the upper rungs more
often, because the team/project values readable markup and reuse at the CSS level.

> Important: at rung 2 a "reusable markup block" is an abstraction of **markup**, not CSS. If
> you're in a JS framework, it's your component; in a templating engine, a partial/include. The skill doesn't dictate this,
> because it's framework-agnostic. The style implementation inside such a block can be either A or B.

> **Two separate axes — don't confuse them.** "Repeated markup" (the same HTML structure on many
> pages) and "repeated styling" (the same set of properties on many elements) are **different problems
> with different fixes**. Rung 2 solves the **markup** axis; `@apply`/Approach B solves the **CSS**
> axis. For **plain static HTML with no partial/component mechanism**, the markup axis still has a
> rung-2 answer: a **build-time include** (any HTML-include build step that stitches a shared
> `header.html`/`footer.html` into each page). Reach for that first — do **not** route duplicated
> *markup* into BEM + `@apply`, because `@apply` deduplicates *CSS*, not HTML, and would leave the
> markup copy-pasted while adding a CSS abstraction you didn't need. If you accept the duplication
> anyway, keep the per-page difference (the active nav item) to a **single source of truth** — e.g. one
> data attribute on a stable ancestor (`<body data-page="pricing">`) driving the state via a
> data-attribute variant (`data-[active=true]:…`) — instead of hand-editing `aria-current` and the
> active classes in every file.

---

## 2. Approach A — utility-first (classes in markup)

### Philosophy

Styling = composing single-purpose classes right in the HTML. CSS is almost never written "by hand":
the entire look of an element is read in one place — in its markup.

### Pros

- **Co-location.** To understand why an element looks the way it does, you don't need to jump to a separate CSS file —
  everything is right next to the markup.
- **No override-rot.** Changing a utility on an element doesn't silently break
  other places: the style is local, with no "action at a distance" through the cascade and specificity.
- **Smaller final bundle.** The same utilities are reused by the engine; there's no duplication of properties
  that `@apply` produces.
- **No need to invent class names** — eliminating a whole class of naming bugs.
- **Power that inline styles lack:** responsiveness, states, and dark mode live in the same classes
  (`md:`, `hover:`, `focus-visible:`, `dark:`), which `style="..."` can't do.

### Mobile-first

Base (unprefixed) utilities = mobile (all screens). Breakpoint variants **add** changes
upward. `md:` means "at the md breakpoint and up," NOT "on small screens." Write the base layout
first, then layer `sm:` → `md:` → `lg:`.

```html
<!-- base = mobile; at md and up we switch to a row -->
<div class="flex flex-col gap-4 md:flex-row md:gap-6">...</div>
```

### States via variants

States are variant prefixes, not separate CSS. One class = one state; styles don't "hide."
The variant stack reads **left to right** (`dark:hover:` = "in dark mode, on hover").

```html
<!-- hover / focus-visible / active / disabled — all in classes -->
<button
  class="bg-primary text-primary-foreground hover:bg-primary/90
         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
         active:bg-primary/80 disabled:opacity-50 disabled:pointer-events-none">
  Save
</button>
```

> `focus-visible:` is preferable to `focus:` for keyboard accessibility (it doesn't show the ring on a
> mouse click). The full set of states **hover / focus-visible / active / disabled** is mandatory for
> interactive components — it's part of the accessibility requirements.

### Example: button (utility-first)

```html
<button type="button"
  class="inline-flex items-center justify-center gap-2
         h-10 px-4
         rounded-md bg-primary
         text-sm font-medium text-primary-foreground
         transition-colors duration-150
         hover:bg-primary/90
         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
         active:bg-primary/80
         disabled:opacity-50 disabled:pointer-events-none">
  <svg class="size-4" aria-hidden="true"><!-- icon --></svg>
  Continue
</button>
```

A variant (outline) — a different set of classes on the same element:

```html
<button type="button"
  class="inline-flex items-center justify-center gap-2 h-10 px-4
         rounded-md border border-border bg-background
         text-sm font-medium text-foreground
         transition-colors duration-150
         hover:bg-muted
         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
         disabled:opacity-50 disabled:pointer-events-none">
  Cancel
</button>
```

### Example: card (utility-first)

```html
<article class="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
  <div class="flex flex-col gap-1 p-6">
    <h3 class="text-lg font-semibold leading-none tracking-tight">Title</h3>
    <p class="text-sm text-muted-foreground">Supporting description text.</p>
  </div>
  <div class="px-6 pb-6 text-sm">Body content.</div>
</article>
```

> If such a card/button block repeats — climb to **rung 2** (extract the markup into a
> reusable fragment). This removes duplication while staying fully utility-first.

---

## 3. Approach B — BEM + `@apply` (in SCSS)

### Philosophy

The markup carries **semantic** class names (by BEM hierarchy), while the appearance is assembled from
utilities via `@apply` in SCSS, **grouped by property type**. The UI is "understandable at a glance" from the
class structure, and a style edit happens in one place.

### Pros

- **Readable markup.** The HTML stays short and meaningful: `cardList-item` conveys a role, not a
  set of twenty utilities.
- **"Understandable at a glance."** The BEM hierarchy (block → element → modifier) gives the interface structure and
  meaning that you'd have to reconstruct in a "utility soup."
- **Reuse at the CSS level.** A single semantic class is edited in one place; the markup is left
  untouched.

### The skill's default BEM convention

`camelCase` for multi-word parts (lowercase-first). The default separators:

| Entity | Notation | Example |
|---|---|---|
| Block | `blockName` | `cardList` |
| Block modifier | `blockName_modifier` (block + underscore) | `cardList_compact` |
| Element | `blockName-element` (block + hyphen) | `cardList-item` |
| Element modifier | `blockName-element_modifier` (element + underscore) | `cardList-item_active` |
| Key-value modifier | `blockName_key_value` (value after underscore) | `cardList_size_lg` |

```
cardList                 // block
cardList_compact         // block modifier
cardList-item            // element
cardList-item_active     // element modifier
cardList_size_lg         // key-value modifier
```

In SCSS this nests by `&`-concatenation (each `&-`/`&_` appends its literal suffix onto the parent):

```scss
.cardList {
  &-item { … }           // .cardList-item
  &_compact { … }        // .cardList_compact
  &-item { &_active { … } } // .cardList-item_active
}
```

Rules:
- **One block per component.** Elements are always counted **from the block**, not from each other.
- **No chains** `-a-b` (no "elements of elements"). If an "element of an element" arises — create a
  **new block** or keep it flat (`cardList-itemTitle`, not `cardList-item-title`).
- Multi-word names are joined `camelCase`, lowercase-first (`cardList`, `itemTitle`), without internal
  separators.

#### BEM naming schemes (this is the **default**, and it's configurable)

The scheme above is the skill's **default**, but BEM has several established naming styles. If the
project already declares a different one, **follow the project** — consistency beats the default. Common
schemes:

| Scheme | Element sep | Modifier sep | Mod-value sep | Word case |
|---|---|---|---|---|
| **Classic** | `__` | `_` | `_` | lowercase, words via `-` (`block__elem_mod`) |
| **Two-Dashes** | `__` | `--` | `_` | lowercase, words via `-` (`block__elem--mod`) |
| **CamelCase** | `__` | `_` | `_` | Capitalized words |
| **React** | `-` (single hyphen) | `_` | `_` | Block/Element Capitalized, modifier lowercase-first |
| **No-namespace** | — (no element prefix) | `_` | `_` | — |
| **Your own** | any | any | any | any (must stay programmatically separable) |

**The skill's default** = the **React separators** (element `-`, modifier `_`, mod-value `_`) with
**lowercase-first camelCase** names (e.g. `cardList`, not `CardList`). Use it unless the project says
otherwise.

**Hard rules the skill enforces regardless of scheme:**
- Names must be **programmatically separable** into block / element / modifier (so tooling and a reader
  can parse them unambiguously).
- **A modifier never stands alone** — always alongside the base it modifies (`<div class="cardList
  cardList_compact">`, never a bare `cardList_compact`).
- **No elements of elements** (`cardList-item-title` / `cardList__item__title` are forbidden — elements
  are flat from the block).

### Nested-selector order inside a block

Within a block's SCSS body, keep a consistent top-to-bottom order (the engine re-sorts the emitted CSS,
so this is purely for readability/consistency, not cascade): (1) the base property groups 1–7, (2) base
states (`&:hover`, `&:focus-visible`, …), (3) **elements** in DOM order, (4) **block modifiers last**.
Element modifiers nest immediately inside their element. Putting modifiers after the elements keeps the
"base → parts → variations" reading order stable across every block.

> **A block root sets no external geometry/positioning.** A block's root should not set centering
> (`mx-auto`), outer margins, or `position` on itself — those tie it to one place and break reuse. Defer
> external geometry to an inner element (`block-inner`) or to a parent that hosts the block (see the
> BEM-mix note in §7). Keep the root responsible for the block's *own* appearance only.
>
> **Carve-out — singleton page-chrome blocks.** This prohibition targets **reusable primitives** whose
> placement must stay external. A **singleton page-chrome block** that is *not* reused — a sticky header,
> footer, sidebar, or the app-shell — **MAY** set `position` / `sticky` / `z-index` on its root, because
> there is no "drop it anywhere" concern: the block exists in exactly one place by definition. Keep the
> *inner* centering/width on an inner element (`header-inner { mx-auto max-w-6xl }`) as usual; only the
> page-level positioning belongs on the chrome root. Don't hoist `position` onto an extra wrapper just to
> satisfy the rule when the block is a genuine singleton.

> **Toolchain caveat for Approach B in component/SFC styles (scoped or not).** When `@apply`/`@reference`
> live in a single-file-component's `<style lang="scss">` — **whether or not it is `scoped`** — the build
> plugin must be one that actually processes those blocks. `@tailwindcss/vite` only transforms modules whose id ends in
> `.css` (or `&lang.css`) and **silently skips** a preprocessor lang such as `&lang.scss`, shipping raw
> `@apply`/`@reference` to the browser with **no error**. To keep `<style lang="scss">` (so `&-`/`&_`
> nesting works), use `@tailwindcss/postcss`, which runs after the Sass preprocessor on every CSS
> module — every component/SFC `<style>`, scoped or not. Details and the recommended path are in
> `references/build-integration.md`.

### Approach B in component frameworks: scoped vs non-scoped global `<style>`

Some component frameworks let a component's `<style>` be **`scoped`** (the build hashes the markup and
the selectors so they apply only inside that component) or **non-scoped global** (the rules land in the
global stylesheet like any other CSS). For Approach B the choice is architectural — it decides whether
your BEM classes are *reusable across components* — so make it deliberately. (This is the only
framework-specific note in this document; everything else is framework-agnostic.)

| | **Scoped `<style>`** | **Non-scoped global `<style>`** |
|---|---|---|
| Collision safety | Automatic — the build isolates classes per component. | Manual — **you must keep block names globally unique** (BEM gives you this for free). |
| Reuse across components | **No.** A class defined in component X isn't usable from component Y's markup — the hash confines it. | **Yes.** The BEM class is a real global class any component can put in its markup. |
| BEM mix / parent-restyles-child | Hard — the injected `data-*` (or similar) attribute can get appended into descendant/modifier selectors, so a block modifier styling a *descendant* element, or one block mixed onto another's node, may not match without an escape hatch (a "deep" selector). | Natural — a BEM mix (two blocks on one node) and a parent block modifier restyling a child element both work because the classes are plain global selectors. |
| What you pay | Nothing extra to write, but you lose composability. | The discipline of unique block names. |

**Which to pick for Approach B.** Approach B's whole value is **reuse at the CSS level** — a semantic
class edited in one place, composable wherever it's needed. That value points to **non-scoped global
`<style>` + globally-unique block names**: it's what lets one component's `button` block be mixed onto
another component's node (a BEM mix, see §7) and lets a block modifier restyle a descendant element
without a framework-specific "deep" selector. BEM's global-uniqueness guarantee is exactly what makes
dropping `scoped` safe — the class names can't collide, so you don't need the build to isolate them.

Reach for **scoped** instead only when a component's styling is genuinely private (a one-off layout that
nothing else should reuse) and you'd rather lean on automatic isolation than on naming discipline — but
note that's closer to Approach A's "co-located, local-only" mindset than to Approach B's reuse goal.

> **`@reference` is required either way.** Whether the `<style>` is scoped or non-scoped global, an
> SFC/component `<style>` is its **own compilation unit** — non-scoped global is **not** the same as the
> entry CSS. Only the file that literally contains `@import "tailwindcss"` can skip `@reference`; every
> other `<style>` that uses `@apply` must start with `@reference "…";`. See `references/build-integration.md`.

### `@apply` grouping order

We group by property category in the canonical order (see `resources/property-order.md` and
`resources/apply-grouping.md`): one `@apply` line per group, and **no** per-group label comments — the
line order conveys the grouping. Then nested states and modifiers.

1. **Layout/position:** `position`, `inset/top/right/bottom/left`, `z`, `display` (flex/grid/block/inline), `flex/grid-*`, `place-*`, `gap`
2. **Sizing:** `w`, `h`, `min-*`, `max-*`, `aspect`
3. **Spacing:** `m*`, `p*`, `space-*`
4. **Background/borders/shape:** `bg-*`, `border*`, `rounded*`, `ring*`, `shadow*`, `outline*`
5. **Typography:** `font-*`, `text-<size>`, `text-<color>`, `leading`, `tracking`, `whitespace`, `truncate`
6. **Effects/motion:** `opacity`, `transition*`, `duration`, `ease`, `transform`, `scale/rotate/translate`, `filter`
7. **Other interaction:** `cursor`, `select-none`, `pointer-events`, `overflow`

Then — nested states (`&:hover`, `&:focus-visible`, `&:active`, `&:disabled`) and modifiers
(`&_primary`, `&_outline`).

### Breakpoints in `@apply`: inline vs `@variant`

A breakpoint variant inside `@apply` (`@apply md:flex-row`) belongs in the **layout** group, same as its
base. For a small 1–2 utility flip (`@apply flex-col md:flex-row`), keeping it **inline** is clearest.
But when one element accumulates **several** same-prefix breakpoint utilities — or one breakpoint flips
multiple property groups — consolidating them into a single `@variant <breakpoint> { @apply … }` block
reads better: keep the prefix-less mobile base on its normal grouped lines, and put only the breakpoint
overrides inside the block.

```scss
.cardGrid {
  @apply grid grid-cols-1 gap-4;
  @variant sm { @apply grid-cols-2; }     // sm and up
  @variant lg { @apply grid-cols-3; }     // lg and up
}
```

`@variant md { @apply … }` is the v4 way to apply a breakpoint inside custom CSS; it compiles to
`@media (width >= 48rem) { … }`, and `@apply` works inside it. (The v3 `@screen md { … }` directive is
**removed** in v4 — the compiler passes it through unrecognized and the wrapped rules are **silently
dropped**.) This is an **optional, equivalent-and-valid** readability alternative, not a mandate — and
don't push viewport responsiveness *wholesale* into SCSS just because you can. See
`docs/custom-utilities-and-layers.md` §4 for `@variant` mechanics.

### Example: button (BEM + `@apply`)

Markup:

```html
<button type="button" class="button button_primary">
  <span class="button-icon"><svg aria-hidden="true"><!-- icon --></svg></span>
  Continue
</button>

<button type="button" class="button button_outline">Cancel</button>
```

SCSS:

```scss
.button {
  @apply inline-flex items-center justify-center gap-2;
  @apply h-10;
  @apply px-4;
  @apply rounded-md;
  @apply text-sm font-medium;
  @apply transition-colors duration-150;
  @apply cursor-pointer;

  &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
  &:disabled      { @apply opacity-50 pointer-events-none; }

  // element
  &-icon {
    @apply inline-flex;
    @apply size-4;
  }

  // modifier: tone/intent separate from the base
  &_primary {
    @apply bg-primary;
    @apply text-primary-foreground;
    &:hover  { @apply bg-primary/90; } // semi-transparency — slash modifier
    &:active { @apply bg-primary/80; }
  }

  &_outline {
    @apply border border-border bg-background;
    @apply text-foreground;
    &:hover { @apply bg-muted; }
  }
}
```

> **v4 notes.** (1) `@apply` works with variants (`@apply hover:underline` is valid), but here
> the states are moved into nested `&:hover {}` for grouping and readability — both ways are correct.
> (2) If this SCSS lives in a scoped `<style>` or a CSS module, the top of the file needs `@reference
> "...";`, otherwise `@apply` won't see the tokens. (3) Keep the base class **neutral** (layout, spacing,
> shared behavior), and move color/intent into modifiers — that way exceptions don't "fight" the base.

### Example: card (BEM + `@apply`)

```html
<article class="cardList-item">
  <h3 class="cardList-itemTitle">Title</h3>
  <p class="cardList-itemDesc">Supporting description text.</p>
</article>
```

```scss
.cardList-item {
  @apply flex flex-col gap-1;
  @apply p-6;
  @apply rounded-lg border border-border bg-card shadow-sm;
  @apply text-card-foreground;

  &_active { @apply border-ring; }                   // element modifier
}

.cardList-itemTitle {
  @apply text-lg font-semibold leading-none tracking-tight;
}

.cardList-itemDesc {
  @apply text-sm text-muted-foreground;
}
```

> Note: `itemTitle`/`itemDesc` are **flat elements of the block** (`cardList-itemTitle`), and
> NOT nested `cardList-item-title`. We avoid `-a-b` chains (elements of elements) by convention.

---

## 4. Good vs bad `@apply`

`@apply` is a narrow adapter, not the primary architecture. Use it surgically.

### ✅ Good

- **Third-party / generated markup** that you don't control (CMS content, third-party widgets,
  DOM rewritten by a script): you need a real CSS class — `@apply` adapts utilities to it.
- **Small repeated patterns**, where extracting the markup would be worse than the duplication itself.
- **Token-oriented CSS:** you want to write your own CSS, but reuse the design tokens and
  the familiar utility syntax.
- **Deliberate Approach B** as a whole: BEM classes with grouped `@apply` — a legitimate choice of
  rungs 4–6 of the ladder (see §1, §6).

### ❌ Bad

- **"Hide all the utilities in CSS"** just to shorten the markup — without a real need for a
  named primitive. This loses co-location and gives nothing in return.
- **Giant semantic wrappers** that are harder to figure out than the original markup;
  page-level one-off classes masquerading as components.
- **Nested `@apply`** duplicating the same property groups across dozens of classes instead of one
  stable primitive.
- `@apply` inside `@keyframes` — forbidden by the engine.

> Heuristic: if you're using `@apply` **en masse** to shorten templates — step back and reconsider
> the abstraction ladder. You probably need rung 2 (extracting the markup), not a CSS wrapper.

---

## 5. Decision tree: utility-first vs BEM + `@apply` for this component

Both approaches are valid and equally useful. The tree helps you choose **deliberately** for a specific case.

```
Start: I'm writing/refactoring a component
│
├─ Is the markup third-party/generated (CMS, third-party widget, DOM rewritten by a script)?
│     └─ YES → you need a real CSS class → BEM + @apply (adapter). [rung 6]
│
├─ Has the repo already adopted one of the conventions (team standard)?
│     └─ YES → follow the existing one. Consistency matters more than personal taste.
│
├─ Does the markup repeat?
│     ├─ NO → utility-first (classes in markup). [rungs 1–3]
│     └─ YES → can the MARKUP be extracted into a reusable fragment? [rung 2]
│            ├─ YES → extract the markup; styles inside it are utility-first. Duplication gone without a CSS abstraction.
│            ├─ NO partial mechanism, but it's plain static HTML
│            │      → add a BUILD-TIME include step (the real rung-2 answer for static HTML). [rung 2]
│            │        NOT BEM + @apply — @apply deduplicates CSS, not markup.
│            └─ NO, and the STYLING (not the markup) is what repeats / the fragment can't be isolated
│                   → BEM + @apply as a single source of style. [rungs 5–6]
│
└─ Complex states / many modifiers / nested selectors?
      ├─ moderate → utility-first with variants (hover:/focus-visible:/...) handles it.
      └─ many intent variants + states, and markup readability matters
             → BEM + @apply: neutral base, intent/states in modifiers.
```

Guiding questions (the tree branches on them):

- **Repeated markup?** No → utilities. Yes → first try to extract the markup (rung 2). In plain static
  HTML with no partial/component mechanism, the rung-2 answer is a **build-time include** that stitches
  the shared fragment into each page — **not** BEM + `@apply` (that deduplicates *CSS*, not *markup*,
  and would leave the HTML copy-pasted). Reach for `@apply` only when it's the *styling* that repeats.
- **Third-party DOM / CMS?** Yes → `@apply` (you need a real class by the render selector).
- **Team convention?** There is one → follow it; the choice is framed as adaptation to the project, not dogma.
- **State complexity?** High + markup readability matters → BEM + `@apply` with a neutral base.

**We emphasize:** no leaf of the tree is "better" than another by default. Utility-first and BEM + `@apply` are
two equal tools; the choice is determined by context, not by a hierarchy of value.

---

## 6. An honest footnote: Tailwind's official position

Be honest about the source. **Officially** Tailwind promotes reuse through
**components / template partials**, and treats `@apply` **narrowly** — as an adapter for inlining utilities into
your own CSS (for example, to override the styles of a third-party library), not as a way to build
a design system.

The direct official wording about duplication (the *Managing duplication* section):

> "for anything that's more complicated than just a single HTML element, we highly recommend using
> template partials so the styles and structure can be encapsulated in one place."

And the only official definition of `@apply` (the *Functions and directives* section) is narrow:

> "Use the `@apply` directive to inline any existing utility classes into your own custom CSS … This
> is useful when you need to write custom CSS (like to override the styles in a third-party library)
> but still want to work with your design tokens."

**However** the goal of this skill is to present **both** approaches as equally valid. So the skill deliberately
treats BEM + `@apply` as a full-fledged choice of the upper rungs of the abstraction ladder (§1), not
as an anti-pattern. Where the "official partial" isn't available, or the team values semantic markup,
BEM + `@apply` with property-grouped `@apply` is a correct, maintainable solution.

---

## 7. Hybrid and migration between approaches

A and B aren't mutually exclusive project modes, but tools on the same abstraction ladder (§1). In a
real codebase they **coexist normally**: the choice is made **at the component level**, not
at the level of the whole repo.

### Combining A and B in one project

A typical working strategy is to distribute the approaches by the nature of the code:

| For what | Approach | Why |
|---|---|---|
| Page layout, sections, one-off blocks (hero, CTA, grids) | **A** (utilities in markup) | No repetition → no CSS abstraction needed; co-location, mobile-first right in the markup. |
| Complex reusable primitives (`button`, `badge`, `input`) with intent variants and states | **B** (BEM + `@apply`) | Stable API, readable markup, edits in one place; neutral base + intent in modifiers. |
| Third-party / generated DOM (CMS, markdown output, third-party widget) | **B** (`@apply` adapter) | Nowhere to put the utilities — you need a real CSS class by the render selector (rung 6, see §4). |
| Small one-off repetition, where extracting the markup would be worse than the duplication | **A** or a narrow `@apply` | Cheap; doesn't breed "semantic wrappers" (§4). |

**The main hybrid rule: don't mix A and B *unsystematically within a single component*.** One
component = one source of truth about its appearance. If a component is solved via B — its appearance lives in
BEM classes with grouped `@apply`, and the markup carries only semantic classes; don't tack on
utility classes for the same properties "in a mix" (this brings back override-rot and breaks
"understandable at a glance"). If a component is solved via A — don't extract half of it into `@apply` without
a reason from §4.

> An acceptable, **systematic** combination within a single node is a separation of responsibility, not
> a mixture: a B-component sets its *own* appearance (`button button_primary`), while an external utility
> positions it *in the context of the parent* (`<button class="button button_primary mt-4 self-end">`).
> Here the utilities are responsible for layout **outside**, not for the primitive's inner appearance — this doesn't break
> the rule.

### BEM mix: two BEM entities on one node

A second, related shape of "systematic combination" is a **BEM mix** — putting **two BEM entities on
one node**: a standalone, reusable block *plus* an element of the block that hosts it. This is how you
position a reusable block inside a parent without coupling the block to one location:

```html
<!-- the parent block (cardList) hosts a reusable block (button) on the same node -->
<a class="button button_primary cardList-action">Open</a>
```

```scss
.button {            // the standalone block: its OWN appearance, margin-free
  @apply inline-flex items-center justify-center h-10 px-4 rounded-md;
  /* … no outer margins / positioning … */
}
.cardList {
  &-action {         // the parent's element: ONLY external geometry for this slot
    @apply mt-4 self-end;
  }
}
```

The rule of the mix: the **standalone block stays margin-free** (it owns only its internal appearance,
so it's droppable anywhere), and the **parent block's element supplies external geometry** (margins,
placement). The two never set the same property — the block decides how it looks, the parent's element
decides where it sits. This is the canonical BEM answer to "I have a reusable affordance and I need it
positioned inside several different parents" (see also the affordance-duplication smell below).

> **Carve-out — visibility/display flips are external, but mind source order.** The "two never set the
> same property" rule is about **appearance** properties (color, border, radius, typography). A
> **visibility/display flip** — `hidden`, or a responsive show/hide such as "hide the CTA on mobile,
> reveal it at `sm`" — is a legitimate **external** concern the host may set on the mix element, even
> though the standalone block also declares a `display` (`inline-flex`). The catch: overriding the
> block's `display` from the mix element only works because the host class compiles **after** the block
> class, and at **equal specificity** (both are single-class selectors) the cascade then falls to source
> order — which is decided by build/module emission order, not guaranteed. To make the flip robust,
> **don't put the `display` flip on the mixed node itself.** Have the host use a **wrapper element it
> owns** (not the block) for the show/hide, so nothing competes with the block's own `display`:
>
> ```html
> <!-- the wrapper the host owns carries the responsive show/hide; the block keeps its own display -->
> <div class="cardList-ctaSlot">
>   <a class="button button_primary">Open</a>
> </div>
> ```
>
> ```scss
> .cardList {
>   &-ctaSlot {                                 // host's wrapper: visibility only
>     @apply hidden;                            // mobile: hidden
>     @variant sm { @apply block; }             // sm and up: shown
>   }
> }
> ```
>
> The block's `display` is never overridden, so the result no longer depends on emission order. (If you
> must flip `display` on the mixed node directly, raise its specificity — e.g. scope the rule under the
> parent block `.cardList .cardList-cta { … }` — rather than relying on order.)

> Smell — **duplicated affordance across blocks.** If the same control (a copy button, an IP/tag chip,
> a badge) keeps reappearing as an ad-hoc element inside several unrelated blocks — and worse, drifts
> in size/color from one block to the next — that's a duplicated affordance, not three elements.
> Extract **one** reusable block that owns all its shared behavior and reuse it (rung 2); when it must
> live inside a parent block, position it with a **BEM mix** as above rather than re-authoring it per
> block. One affordance = one block.

### Incremental A ↔ B migration

Transitioning between approaches **doesn't require rewriting the whole project at once**. Migrate **per component, as
you touch it** (touch-based): when you've opened a component for another task — convert it to the
target approach along the way. The migration boundary is the component boundary, not a file or a page.

The order for the **A → B** migration (utilities → BEM + `@apply`):

1. Give the block a semantic name by the BEM convention (§3): one block per component, elements — flat
   from the block (`button`, `button-icon`, no `-a-b` chains).
2. Move the utilities from the markup into `@apply`, **laid out by property groups** in the canonical order
   (§3, expanded in `resources/apply-grouping.md`, `resources/property-order.md`).
3. Move the states into nested `&:hover/&:focus-visible/&:active/&:disabled`, and tone/intent — into
   modifiers (`&_primary`, `&_outline`); keep the base neutral.
4. In the markup, leave only the semantic classes. The behavior must stay **visually
   identical** — migration doesn't change the appearance, only its place.

Conversely, **B → A** (when the semantic wrapper didn't pay off — see "❌ Bad" in §4): unfold the
grouped `@apply` back into utilities on the element; if the markup repeats — don't breed duplication, but
climb to **rung 2** and extract the markup into a reusable fragment (§1).

Rules for safe incremental migration:

- **Don't leave half-migrated components.** A component is either fully A or fully B —
  otherwise the rule "don't mix within a single component" is broken.
- **Tokens aren't touched.** The names of semantic tokens are canonical and stable across any approach;
  migration only changes *where the classes live*, not the values (`templates/theme.css`).
- **Consistency matters more than taste.** If the repo already has a team standard — migrate *toward
  it*, not away from it (see the tree in §5 and the playbook `workflows/choose-approach.md`).

### A component's tone/variant vocabulary is part of its token contract

When a component exposes a set of tones or variants (a badge's `primary`/`accent`/`success`, a card's
`featured`, a tier's `bronze`/`silver`/`gold`), that vocabulary is **part of the component's contract**,
not an ad-hoc per-screen choice — and it must hold **across both implementations (A and B) and across
every place the component is used**. Define the mapping *once* — meaning → token — and reuse it
everywhere: **one meaning = one token across all uses**. If "the elite tier is the accent tone," it maps
to the same token in the utility-first markup, in the BEM modifier's `@apply`, and on every page; it does
not become one token here and a different one there. Two consequences:

- A drifting mapping (the same meaning resolving to different tokens in different files) is a smell —
  it means the tone was chosen by *appearance*, not by *meaning*. Pin it to one token.
- Don't borrow a token whose *meaning* is something else for the sake of its color — e.g. don't reuse a
  `success`/`warning`/`danger` **status** token as a decorative category color. Status tokens carry
  product state; for categorical decoration use `--color-accent` or a dedicated category token. (Token
  semantics are covered in `references/tokens.md`.)

### A short hybrid example

The layout section is solved via **A** (one-off, doesn't repeat), and the button inside is a reusable
primitive via **B**. The utilities on the `<button>` are responsible only for its place in the section's flow, not for its appearance:

```html
<!-- A: a one-off section — utilities in markup (layout, mobile-first) -->
<section class="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
  <div class="flex flex-col gap-1">
    <h2 class="text-lg font-semibold text-foreground">Newsletter</h2>
    <p class="text-sm text-muted-foreground">Supporting description text.</p>
  </div>

  <!-- B: a reusable primitive; the external utility self-start positions it within the section -->
  <button type="button" class="button button_primary self-start md:self-auto">
    Subscribe
  </button>
</section>
```

```scss
// B: the button's appearance entirely in BEM + grouped @apply (base neutral, intent — in the modifier)
.button {
  @apply inline-flex items-center justify-center gap-2;
  @apply h-10;
  @apply px-4;
  @apply rounded-md;
  @apply text-sm font-medium;
  @apply transition-colors duration-150;
  @apply cursor-pointer;

  &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
  &:disabled      { @apply opacity-50 pointer-events-none; }

  &_primary {
    @apply bg-primary;
    @apply text-primary-foreground;
    &:hover  { @apply bg-primary/90; }
    &:active { @apply bg-primary/80; }
  }
}
```

> What's **systematic** here, not "soup": the class `button button_primary` is the only source of the button's
> *appearance*; `self-start md:self-auto` is the only source of its *position in the section*. The properties don't
> overlap, the responsibility isn't duplicated. This is exactly the hybrid boundary.

---

## See also

- `templates/theme.css` — the canonical `@theme` with semantic tokens (names are stable, values
  swappable per design system).
- `resources/property-order.md` and `resources/apply-grouping.md` — the order of `@apply` groups (expansion of §3).
- `examples/` — each component (`button`, `card`, `input-field`, `badge`, `alert`, `navbar`,
  `modal`, `responsive-grid`) in **both** implementations (A and B).
