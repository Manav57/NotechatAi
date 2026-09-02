# Canonical CSS property order in Tailwind v4

> **Source of truth:** the canonical property order of the Tailwind v4 engine — a fixed
> sequence of ~430 CSS properties (and the related `--tw-*` custom properties), described
> in the official Tailwind documentation. This is the **only** authoritative order; everything below is a
> coarse-grained, grouped summary of that same sequence, not its verbatim reproduction.

## What it is and why

The canonical order defines the order in which the engine arranges CSS declarations. This
sequence is used in two places:

1. **Sorting generated CSS.** When Tailwind compiles utilities into rules, it
   orders the resulting declarations by this list, so the output is deterministic
   and readable.
2. **`@apply` expansion.** When utilities are inlined via `@apply`, the resulting properties land in the rule
   in this same canonical order — regardless of the order in which you listed the classes.

Practical takeaway: **the order of tokens within a single `@apply` line does not affect the cascade** — the engine
lays the properties out by the canon anyway. So the value of manual `@apply` grouping (Approach B) is
**source readability for a human**, not priority control. By grouping `@apply` by meaning
(see `apply-grouping.md`), we arrange the lines in the same spirit as the canonical array: layout
first, then sizing, spacing, styling, typography, effects.

> ⚠️ The cascade between **separate** rules/utilities is decided by layer order (`@layer theme, base,
> components, utilities`) and specificity, not by this sequence. The canonical order
> controls the declaration order **within a single rule**.

## Coarse-grained order summary (groups in the correct sequence)

Below is the canonical order, collapsed into meaningful groups. The sequence of groups and their
inner blocks matches the engine's canonical order (top to bottom).

| # | Group | Properties (in canonical order, abbreviated) |
|---|--------|-----------------------------------------------|
| 1 | **Container context** | `container-type` |
| 2 | **Visibility / pointer** | `pointer-events`, `visibility` |
| 3 | **Positioning** | `position`; then `inset`, `inset-inline/-block`, `inset-*-start/-end`, `top`, `right`, `bottom`, `left` |
| 4 | **Layer and flow order** | `isolation`, `z-index`, `order`; `grid-column*`, `grid-row*`; `float`, `clear` |
| 5 | **Outer spacing (margin)** | `margin`, `margin-inline/-block`, `margin-*-start/-end`, `margin-top/-right/-bottom/-left` |
| 6 | **Box model and display** | `box-sizing`, `display` |
| 7 | **Sizing** | `field-sizing`, `aspect-ratio`, `height`, `max-height`, `min-height`, `width`, `max-width`, `min-width` |
| 8 | **Flex item** | `flex`, `flex-shrink`, `flex-grow`, `flex-basis` |
| 9 | **Tables** | `table-layout`, `caption-side`, `border-collapse`, `border-spacing` |
| 10 | **Transforms** | `transform-origin`; `translate` (+ `--tw-translate-*`), `scale` (+ `--tw-scale-*`), `rotate` (+ `--tw-rotate-*`), `--tw-skew-*`, `transform`; `zoom` |
| 11 | **Animation** | `animation` |
| 12 | **Cursor / touch / resize** | `cursor`; `touch-action` (+ `--tw-pan-*`, `--tw-pinch-zoom`); `resize` |
| 13 | **Scroll** | `scroll-snap-*`, `scroll-margin-*`, `scroll-padding-*`, `scrollbar-*` |
| 14 | **Lists** | `list-style-position/-type/-image` |
| 15 | **Appearance / columns** | `appearance`; `columns`, `break-before/-inside/-after` |
| 16 | **Grid container** | `grid-auto-columns/-flow/-rows`, `grid-template-columns/-rows` |
| 17 | **Flex/grid layout (container)** | `flex-direction`, `flex-wrap`, `place-content`, `place-items`, `align-content`, `align-items`, `justify-content`, `justify-items`, `gap`, `column-gap`, `row-gap`, `--tw-space-*-reverse` |
| 18 | **Divide (separators)** | `divide-x-width`, `divide-y-width`, `--tw-divide-y-reverse`, `divide-style`, `divide-color` |
| 19 | **Self alignment** | `place-self`, `align-self`, `justify-self` |
| 20 | **Overflow / overscroll** | `overflow`, `overflow-x/-y`, `overscroll-behavior*`, `scroll-behavior` |
| 21 | **Rounding (radius)** | `border-radius` + all logical/corner variants (`border-start-start-radius` … `border-bottom-left-radius`) |
| 22 | **Border widths** | `border-width`, `border-inline/-block-width`, `border-*-start/-end-width`, `border-top/-right/-bottom/-left-width` |
| 23 | **Border style** | `border-style` + logical/side variants |
| 24 | **Border color** | `border-color` + logical/side variants |
| 25 | **Background color** | `background-color` |
| 26 | **Background image / gradients** | `background-image` + `--tw-gradient-*` (position/stops/from/via/to) |
| 27 | **Masks** | `mask-image` + `--tw-mask-*` (edge / linear / radial / conic) |
| 28 | **Background (layout)** | `box-decoration-break`, `background-size/-attachment/-clip/-position/-repeat/-origin`; `mask-composite/-mode/-type/-size/-clip/-position/-repeat/-origin` |
| 29 | **SVG fill** | `fill`, `stroke`, `stroke-width` |
| 30 | **Object** | `object-fit`, `object-position` |
| 31 | **Inner spacing (padding)** | `padding`, `padding-inline/-block`, `padding-*-start/-end`, `padding-top/-right/-bottom/-left` |
| 32 | **Text alignment** | `text-align`, `text-indent`, `vertical-align` |
| 33 | **Font and metrics** | `font-family`, `font-feature-settings`, `font-size`, `line-height`, `font-weight`, `letter-spacing`, `text-wrap`, `overflow-wrap`, `word-break`, `text-overflow`, `hyphens`, `white-space`, `tab-size` |
| 34 | **Text color and decoration** | `color`, `text-transform`, `font-style`, `font-stretch`, `font-variant-numeric`, `text-decoration-*`, `text-underline-offset`, `text-shadow` (+ `--tw-text-shadow-*`, v4.1), `-webkit-font-smoothing` |
| 35 | **Placeholder / caret / accent** | `placeholder-color`, `caret-color`, `accent-color`, `color-scheme` |
| 36 | **Opacity / blending** | `opacity`, `background-blend-mode`, `mix-blend-mode` |
| 37 | **Shadows and ring** | `box-shadow` + `--tw-shadow*`, `--tw-ring-*`, `--tw-inset-*`, `--tw-ring-offset-*` |
| 38 | **Outline** | `outline`, `outline-width/-offset/-color` |
| 39 | **Filters** | `--tw-blur/-brightness/-contrast/-drop-shadow/...`, `filter`; then `--tw-backdrop-*`, `backdrop-filter` |
| 40 | **Transitions** | `transition-property`, `transition-behavior`, `transition-delay`, `transition-duration`, `transition-timing-function` |
| 41 | **Other** | `will-change`, `contain`, `content`, `forced-color-adjust` |

> The full, verbatim order (~430 entries, including all `--tw-*` intermediate variables)
> is defined by the Tailwind v4 engine. The table above is a navigation map of that same sequence,
> not a replacement for it.

## Relation to Approach B (BEM + `@apply`)

The canonical order is the basis for **manual `@apply` grouping**. The seven practical groups from
`apply-grouping.md` are a coarsening of the columns of this table:

- layout/position (groups 1–4, 16–20) → **group 1** in `apply-grouping`;
- sizing (7–8) → **group 2**;
- margin/padding/space spacing (5, 31) → **group 3**;
- background/borders/shape/shadows (21–28, 37–38) → **group 4**;
- typography (32–35) → **group 5**;
- effects/motion (10–11, 36, 39–40) → **group 6**;
- interaction (12, 20) → **group 7**.

Details and a worked example are in **`apply-grouping.md`**.
