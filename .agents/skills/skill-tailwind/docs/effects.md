# Visual effects in Tailwind v4 / 4.1

This is a **conceptual** chapter on styling effects that v4 (and especially v4.1, April 2025)
moved into the core: **text shadows** (`text-shadow-*`), **masks** (`mask-*`), **colored** `drop-shadow-*`,
and the distinction between the three "shadows" — `shadow` (box-shadow) · `inset-shadow` · `ring`. The goal is a mental
model of "which tool is responsible for what and when it is appropriate," not a retelling of tables. Full utility scales
are the official Tailwind documentation; the **canonical declaration order** (where these properties
end up in the rule under `@apply`) is in `resources/property-order.md`; the **set of
design tokens** and the "value → token" heuristic are in `references/tokens.md`.

> The skill is responsible for **technical correctness**, not visual direction. All shadow/mask values
> below are **placeholders for the design system**; only the names and mechanics are stable.
> An effect is appropriate **only if it exists in the design system**; a decorative shadow/mask "to make it
> prettier" is slop (mini-reminder at the end).

---

## 1. Text shadows: `text-shadow-*` (v4.1)

Before v4.1, a text shadow had to be written as an arbitrary value (`[text-shadow:…]`). v4.1 introduced
a full utility scale and a **separate namespace** `--text-shadow-*` in `@theme`.

- **Size scale:** `text-shadow-2xs` · `text-shadow-xs` · `text-shadow-sm` · `text-shadow-md`
  · `text-shadow-lg`; reset is `text-shadow-none`.
- **Color:** `text-shadow-<color>` takes the color from the color namespace just like `bg-*`/`text-*` —
  meaning it works with semantic tokens: `text-shadow-foreground`, `text-shadow-primary`.
- **Slash opacity:** alpha is set on the shadow utility — `text-shadow-lg/50` (like `bg-primary/90`).
  This is the same v4 slash-modifier mechanic, not a separate token.

In the property-order canon, the text shadow belongs to the "text color and decoration" group (see
`resources/property-order.md`, group 34 — the `text-decoration`/`text-shadow` adjacency), meaning under
`@apply` it lives in **typography**, not in the general "shadows/ring" group.

**A — utilities in markup.** A light shadow for text readability over an uneven backdrop:

```html
<h2 class="text-2xl font-semibold text-foreground
           text-shadow-sm text-shadow-foreground/20">
  Heading over a photo
</h2>
```

**B — BEM + `@apply`** (the text shadow goes in the typography line):

```scss
@reference "../app.css";

.heroTitle {
  @apply text-2xl font-semibold text-foreground text-shadow-sm text-shadow-foreground/20;
}
```

### The `--text-shadow-*` namespace in `@theme`

If a project text shadow is part of the design system (it repeats, has a role), we register it **by name**
in the `--text-shadow-*` namespace rather than hardcoding `[text-shadow:…]` throughout the markup (the same logic
of "arbitrary → token" promotion as for colors — `references/tokens.md` §6):

```css
@theme {
  /* values are PLACEHOLDERS for the design system; only the name is stable */
  --text-shadow-card: 0 1px 2px oklch(0% 0 0 / 0.12);
}
```

```html
<span class="text-shadow-card">…</span>   <!-- a name from the namespace yields a utility -->
```

> Resetting the namespace works like any other: `--text-shadow-*: initial` (see `references/tokens.md`
> §4.3). The shadow color and its alpha are separate: `text-shadow-md text-shadow-primary/30`.

---

## 2. Masks: `mask-*` (v4.1)

`mask-*` controls the CSS masking properties (`mask-image` and the accompanying layout/composition).
A mask makes parts of an element transparent via a **mask gradient**: where the mask is opaque the content
is visible, where it is transparent it is hidden. In the order canon these are groups 27 ("Masks" — `mask-image` +
`--tw-mask-*`) and 28 ("mask composition/layout"), right after the background gradients — see
`resources/property-order.md`.

Three families of mask gradients (symmetric to the background gradients `bg-linear`/`bg-radial`/`bg-conic`):

- **Linear by edge:** `mask-t-*`, `mask-b-*`, `mask-l-*`, `mask-r-*` (top/bottom/left/right),
  each with a pair of stops `…-from-<pos>` / `…-to-<pos>` (`mask-b-from-80% mask-b-to-100%`).
- **Radial:** `mask-radial-*` (`mask-radial-from-*`/`-to-*`, shape/size/position —
  `mask-circle`/`mask-ellipse`, `mask-radial-at-center`, etc.).
- **Conic:** `mask-conic-*` (`mask-conic-from-*`/`-to-*`, angle `mask-conic-<angle>`).

**Composition.** Multiple masks combine (several edges at once) — controlled by
`mask-composite` through the utilities `mask-add` / `mask-subtract` / `mask-intersect` / `mask-exclude`.
This allows, for example, a fade at the top and bottom simultaneously.

### A typical case: "edge fade"

The most common practical workflow is to gently "dissolve" the bottom edge of a scrollable block, to
indicate that the content continues, without a hard clipping line.

**A — utilities:** the content disappears over the last 20% of the height.

```html
<div class="h-64 overflow-y-auto
            mask-b-from-80% mask-b-to-100%">
  <!-- long content: the bottom edge fades smoothly -->
</div>
```

**B — BEM + `@apply`** (the mask belongs to the "background/borders/shape" styling group):

```scss
@reference "../app.css";

.fadeList {
  @apply h-64;
  @apply overflow-y-auto;
  @apply mask-b-from-80% mask-b-to-100%;
}
```

> The radial variant is a soft vignette / circular image fade:
> `mask-radial-from-65% mask-radial-to-100%`. Composition of two edges (top + bottom at once):
> `mask-t-from-90% mask-b-from-90% mask-add`. Threshold values are tailored to the specific design.

A mask works in the **alpha channel** and adds no "ink" — it is not an overlay darkening but a cutout of
transparency. That is why it is cheaper and more honest than a gradient pseudo-element on top (which paints the
background color and breaks on a non-standard background / in dark mode).

---

## 3. Colored `drop-shadow-*`

`drop-shadow-*` is a **filter** (`filter: drop-shadow(...)`), not a `box-shadow`: the shadow follows the
**actual shape** of the content (the outline of a transparent PNG/SVG, an icon, an uneven edge), not the
rectangle of the box. In the property order this is group 39 "Filters" (see `resources/property-order.md`),
meaning under `@apply` it is the **effects/motion** group, separate from `box-shadow` (group 37).

v4.1 added **color** to the filter shadow: `drop-shadow-<color>` (previously the filter-shadow color could not be set
with a utility). The color comes from the same color namespace — so it works with tokens.

**A — an icon with a colored shadow following its real silhouette:**

```html
<svg class="size-10 text-primary
            drop-shadow-md drop-shadow-primary/40" aria-hidden="true">…</svg>
```

**B — BEM + `@apply`** (the filter shadow in the effects group):

```scss
@reference "../app.css";

.glyph {
  @apply size-10;
  @apply text-primary;
  @apply drop-shadow-md drop-shadow-primary/40;
}
```

> When the shape is **rectangular** (card, button, panel) — that is `shadow-*` (box-shadow), which is
> cheaper. `drop-shadow-*` is justified when the shadow must trace a **non-rectangular** outline.

---

## 4. The three "shadows" people confuse: `shadow` · `inset-shadow` · `ring`

Different properties with different roles — it is important not to substitute one for another.

| Utility | CSS under the hood | What it does | Token namespace |
|---|---|---|---|
| `shadow-*` | `box-shadow` (outer) | lifts the box above the background (elevation) | `--shadow-*` |
| `inset-shadow-*` | `box-shadow inset` | inner shadow — "indentation," inner contour | `--inset-shadow-*` |
| `ring-*` | `box-shadow` as a spread ring | an opaque ring around the box (focus, selection) | `--shadow-*` + `--tw-ring-*` |
| `drop-shadow-*` | `filter: drop-shadow()` | a shadow following the actual shape (§3) | `--drop-shadow-*` |

The first three (`shadow`/`inset-shadow`/`ring`) all live in one canonical group 37 "Shadows and ring"
(`resources/property-order.md`) and under `@apply` go in the **background/borders/shape** group (box styling).
`drop-shadow` is a **filter** (group 39 / effects) — do not confuse them.

**Key v4 differences the model forgets:**

- **`ring` defaults to 1px and `currentColor`** (in v3 it was 3px and blue). Set the color and width
  explicitly: `ring-2 ring-ring`. This is the same gotcha as with `border` (see `references/v4-rules.md` §16) —
  we hang the focus ring on `--color-ring`, separate from `--color-border`, so that focus does not depend on the
  border color (`references/tokens.md` §1).
- **`ring` ≠ `outline`.** `ring` is a `box-shadow` ring (drawn in the shadow flow, respects
  `border-radius`); `outline` is a real CSS outline. For focus indication the skill canon is
  `focus-visible:outline-2 focus-visible:outline-ring` or `focus-visible:ring-2 ring-ring`
  (see `docs/variants-and-states.md` §3); what matters is that the **focus ring is visible**, and which of the two —
  is a styling choice.
- **`shadow-sm` in v4 ≠ "the smallest shadow."** The scale is shifted by one step: the lightest is `shadow-xs`,
  the former `shadow-sm` now looks like `shadow-xs` (`references/v4-rules.md` §12). This silently changes the look when
  migrating from v3.

```html
<!-- card elevation + a visible focus ring (different roles — different utilities) -->
<article class="rounded-lg bg-card p-4 shadow-sm
                focus-visible:outline-2 focus-visible:outline-ring">…</article>

<!-- an "indented" field: an inner shadow instead of an outer one -->
<div class="rounded-md bg-input inset-shadow-2xs">…</div>
```

Shadow tokens are also taken from the design system: a repeating elevation → a name in `--shadow-*`
(`--shadow-card`, `--shadow-popover`), not a one-off `[box-shadow:…]` (the promotion heuristic —
`references/tokens.md` §6).

---

## 5. Mini-reminder: an effect from the design system vs slop

The v4.1 effects (text shadows, masks, colored filter shadows) are powerful and therefore especially easy to slide
into AI slop. The boundary is simple: **the effect reflects a design-system decision or carries a function** — appropriate;
**the effect is added "for looks"** — slop.

**Appropriate (there is a reason):**

- A shadow/elevation **from the scale** of the design system (`--shadow-*`, `--text-shadow-*`), applied by role
  (a card is lifted, a popover is above the card).
- A mask as a **functional edge fade**: a scroll indicator, soft media framing — where
  a hard clip is worse for UX.
- `text-shadow` for the **readability** of text over a photo/gradient (contrast, not decoration).
- A colored `drop-shadow` under a **non-rectangular** outline (icon/illustration), when the shape requires a
  filter rather than a box-shadow.
- `ring` for a **visible focus indicator** (accessibility) — this is a function, not decoration.

**Slop (no reason — we do not do it):**

- Shadows/glows "to look modern" that are not in the design system; multicolored "glows" under
  every element.
- Masks as an end in themselves: decorative cutouts, "holes," blobs with no framing/fading function.
- Excessive multilayer `text-shadow` (neon text), garish colored drop-shadows under ordinary
  UI icons.
- Hardcoding `[box-shadow:…]` / `[text-shadow:…]` / `[mask-image:…]` instead of a token when it repeats/has meaning
  (this violates "value → token," `references/tokens.md` §6).
- Substituting roles: `ring` instead of `border` for a static frame, `drop-shadow` under a rectangular
  card instead of the cheaper `shadow-*`.

> The filter rule before adding an effect: **"Is this from the design system or does it carry a function (contrast /
> framing / elevation / focus)?"** If not — do not add it. If the value repeats or has a role —
> promote it into a token (`--shadow-*` / `--text-shadow-*` / `--drop-shadow-*`) rather than breeding arbitrary values.

---

## Checklist (quick self-check)

- [ ] Text shadow — the `text-shadow-*` utility (+ color `text-shadow-<color>`, alpha `…/50`), not
      `[text-shadow:…]`; repeat/meaning → a token in `--text-shadow-*` (`references/tokens.md` §6).
- [ ] Edge mask — `mask-t/b/l/r-from-*/-to-*` (or `mask-radial-*`/`mask-conic-*`); several
      edges — via composition (`mask-add`/`mask-subtract`/…).
- [ ] Colored `drop-shadow-<color>` — only for a **non-rectangular** outline; a rectangle —
      `shadow-*` (cheaper).
- [ ] Do not confuse the roles: `shadow` (elevation) · `inset-shadow` (indentation) · `ring` (ring/focus) ·
      `drop-shadow` (by shape, this is a filter).
- [ ] `ring` is set explicitly for width and color (`ring-2 ring-ring`) — the v4 default is 1px/`currentColor`.
- [ ] Remember the scale shift: the lightest shadow is `shadow-xs`, not `shadow-sm` (`references/v4-rules.md` §12).
- [ ] Order under `@apply`: `text-shadow` — in typography, `shadow`/`inset-shadow`/`ring` — in
      background/borders/shape, `drop-shadow` — in effects (`resources/property-order.md`).
- [ ] The effect has a reason (design system / function), not added "for looks" (§5).
