# RTL and logical properties (Tailwind v4)

This is a **conceptual** chapter: why in v4 the default choice is **logical** directional utilities
(`ps-`/`pe-`, `ms-`/`me-`, `start-`/`end-`, `border-s`/`border-e`, `text-start`/`text-end`,
`rounded-s`/`rounded-e`) rather than physical ones (`pl-`/`pr-`, `ml-`/`mr-`, `left-`/`right-`,
`border-l`/`border-r`, `text-left`/`text-right`, `rounded-l`/`rounded-r`); how a single
`dir="rtl"` attribute flips the entire layout; and where **rare** physical overrides are appropriate via
the `rtl:` / `ltr:` variants. All of this is **Tailwind v4 core**, with no plugins or JS runtime. For the full
`@apply` group order go to `references/approaches.md` / `resources/apply-grouping.md`; for
semantic tokens (`bg-card`, `text-foreground`, `border-border`) — see `references/tokens.md`.

---

## 1. The model: "start/end" instead of "left/right"

A logical property describes a position **relative to the writing direction**, not relative to the
screen. The CSS engine resolves "start" and "end" from `direction` (and, for the block axis, from
`writing-mode`) **at runtime**:

```
LTR (dir="ltr")            RTL (dir="rtl")
start = left               start = RIGHT
end   = right              end   = LEFT
```

That is why `ps-4` (padding-inline-**start**) means "padding on the side where the text begins": on the left
in Latin, on the right in Arabic/Hebrew. The physical `pl-4` (padding-**left**) is always literally on the left —
and in RTL it ends up "on the wrong side". A logical utility switches itself; a physical one would have to
be duplicated by hand for each direction.

> The inline axis (along the line) and the block axis (across paragraphs) differ. The direction-dependent
> utilities are specifically those of the **inline axis** (`*-s`/`*-e`, `ps-`/`pe-`, `ms-`/`me-`, `start-`/`end-`, `text-start`/`text-end`).
> Vertical utilities (`pt-`/`pb-`, `mt-`/`mb-`, `top-`/`bottom-`) in ordinary horizontal writing
> are **not** direction-dependent — you do not need to rewrite them for RTL.

---

## 2. Why logical is better for internationalization

The same markup must work in LTR and RTL locales **without a second copy of the styles**. Compare a
button with an icon and padding "toward the text":

```
Physical approach (fragile):  pl-3  → in RTL the padding stays on the LEFT, drifting away from the text on the right.
                              you need: pl-3 ltr-only + pr-3 rtl-override → two utilities, easy to forget.
Logical approach (canonical): ps-3  → "padding on the start side of the line" — correct in both
                              directions WITHOUT overrides.
```

Three practical consequences:

1. **One source of truth.** The layout is described once; the browser changes direction via `dir`. There is no second
   set of `rtl:` classes to get out of sync during edits.
2. **Fewer classes and fewer bugs.** Each "physical + `rtl:` override" pair collapses into a single
   logical utility. Less room for "forgot to override this one icon".
3. **Future localization is almost free.** A component written logically will support an RTL language by
   changing a single attribute on `<html>` — without rewriting the components.

Logical utilities cost nothing in an LTR project: there `ps-4` is identical to `pl-4`. That is why the skill's canon is to
**write logically by default**, even if RTL is not "needed" yet: it does not complicate LTR and leaves the
door open.

---

## 3. How to switch direction: `dir="rtl"` on the root

Direction is a native HTML `dir` attribute, not a Tailwind utility. We put it on the document's root element
(or on a subtree that needs a different locale):

```html
<!-- the whole document in RTL: logical utilities flip automatically -->
<html lang="ar" dir="rtl">
  <body class="bg-background text-foreground">…</body>
</html>
```

```html
<!-- mixed document: an LTR page with an RTL island (e.g. a Hebrew quote) -->
<html lang="en" dir="ltr">
  <body>
    <article>…</article>
    <blockquote lang="he" dir="rtl" class="ps-4 border-s-2 border-border">…</blockquote>
  </body>
</html>
```

No config, plugin, or JS is required for **the direction itself**: change `dir`, and all
logical utilities are recomputed by the browser. Dynamic locale switching (an "AR/EN" button) is
a change of the `dir` attribute value by external code; the styles react on their own.

> `dir` is a native attribute, just like `lang`. Specify `lang` alongside it: it affects hyphenation, typography,
> and accessibility (screen readers). The attribute controls direction; Tailwind merely supplies utilities
> that **respect** that direction.

---

## 4. The `rtl:` / `ltr:` variants — for RARE physical overrides

Logical utilities cover the vast majority of cases. But sometimes the **visual** itself is direction-dependent,
not the layout: an arrow glyph, a decorative gradient, an icon that must be **mirrored** in RTL. For such
pinpoint cases there are the built-in `rtl:` and `ltr:` variants (part of v4 core) — they apply a utility only
in the corresponding direction:

```html
<!-- a "forward" arrow: points toward the END of the line. In RTL we flip it horizontally. -->
<button class="inline-flex items-center gap-2 px-4 h-10 rounded-md bg-primary text-primary-foreground">
  <span>Next</span>
  <svg class="size-4 rtl:-scale-x-100" aria-hidden="true">…</svg>
</button>
```

The key priority rule:

```
Is this LAYOUT (padding/margin/position/border/alignment/rounding)?
├── Yes → logical utility (ps-/pe-, ms-/me-, start-/end-, border-s/-e, text-start/-end, rounded-s/-e).
│        rtl:/ltr: are NOT needed here — the browser flips it itself.
└── No → Is this a direction-dependent VISUAL (mirror a glyph/icon, flip a gradient)?
    ├── Yes → pinpoint rtl:/ltr: (rtl:-scale-x-100, rtl:rotate-180, ltr:bg-linear-to-r…).
    └── No → nothing: the utility is direction-agnostic (color, font size, vertical padding).
```

> **Anti-pattern:** duplicating layout as `pl-4 rtl:pr-4 rtl:pl-0`. This is exactly what logical
> utilities eliminate — write `ps-4`. Reserve the `rtl:`/`ltr:` variants for cases where there is no
> logical equivalent (mirroring a glyph, flipping a directional gradient).

---

## 5. Table: physical → logical (inline axis)

The skill's canon: in new code the default is the **right column**. Keep physical utilities only
for knowingly single-direction UI or for pinpoint `rtl:`/`ltr:` visual overrides (§4).

| Property | Physical (LTR-only) | Logical (canonical) | CSS under the hood |
|---|---|---|---|
| Inline-start padding | `pl-*` | `ps-*` | `padding-inline-start` |
| Inline-end padding | `pr-*` | `pe-*` | `padding-inline-end` |
| Inline-start margin | `ml-*` | `ms-*` | `margin-inline-start` |
| Inline-end margin | `mr-*` | `me-*` | `margin-inline-end` |
| Position from inline-start | `left-*` | `start-*` | `inset-inline-start` |
| Position from inline-end | `right-*` | `end-*` | `inset-inline-end` |
| Border on the start side | `border-l*` | `border-s*` | `border-inline-start` |
| Border on the end side | `border-r*` | `border-e*` | `border-inline-end` |
| Corner rounding at start | `rounded-l-*` | `rounded-s-*` | `border-start-*-radius` |
| Corner rounding at end | `rounded-r-*` | `rounded-e-*` | `border-end-*-radius` |
| Text alignment to start | `text-left` | `text-start` | `text-align: start` |
| Text alignment to end | `text-right` | `text-end` | `text-align: end` |

Not in the table because they are **direction-agnostic** (no need to rewrite for RTL): `pt-`/
`pb-`, `mt-`/`mb-`, `top-`/`bottom-`, `text-center`, `text-justify`, as well as `px-`/`py-`/`mx-`/`my-`
(they are already two-sided on their own axis). Print is a separate, orthogonal topic: the `print:` variant (also
v4 core) has nothing to do with direction.

---

## 6. Example A (utility-first): a notification card, correct in LTR and RTL

Logical utilities for the entire layout; not a single `rtl:` override was needed. Color semantics
come from the canonical tokens (`references/tokens.md`).

```html
<!-- works the same under <html dir="ltr"> and <html dir="rtl"> -->
<div role="status"
     class="flex items-start gap-3
            ps-4 pe-10 py-3
            rounded-md border-s-2 border-border bg-card text-card-foreground
            text-sm">
  <svg class="size-5 shrink-0 text-muted-foreground" aria-hidden="true">…</svg>
  <p class="text-start">File saved.</p>
  <!-- the close button is pinned to the END of the line: end-2, not right-2 -->
  <button type="button" aria-label="Close"
          class="absolute end-2 top-2 inline-flex size-7 items-center justify-center
                 rounded-sm text-muted-foreground
                 hover:bg-muted hover:text-foreground
                 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
    ×
  </button>
</div>
```

Compare with the physical notation: `pl-4 pr-10`, `border-l-2`, `right-2`, `text-left` — all of this in RTL
would turn out mirror-wrong and would require a pair of `rtl:` overrides for each utility.

---

## 7. Example B (BEM + `@apply`): the same component, logically

The same logical utilities, but inlined into a semantic class via `@apply`, grouped by the
`property-order` canon (layout → sizing → padding → background/borders/shape → typography → effects →
interaction; then states). The skill's BEM default: block / element `block-element` / element modifier `block-element_modifier` (element `-`, modifier `_`; configurable per project — see `references/approaches.md`).

```scss
@reference "../app.css"; /* the entry CSS that defines your @theme tokens — NOT "tailwindcss" (that exposes only the default theme and would drop bg-card/border-border) */

.notice {
  @apply relative flex items-start gap-3;
  @apply ps-4 pe-10 py-3;
  @apply rounded-md border-s-2 border-border bg-card;
  @apply text-sm text-card-foreground text-start;

  &-icon  { @apply size-5 shrink-0 text-muted-foreground; }
  &-text  { @apply text-start; }

  &-close {
    /* position toward the END of the line — logical end, not right */
    @apply absolute end-2 top-2;
    @apply inline-flex size-7 items-center justify-center;
    @apply rounded-sm text-muted-foreground;
    &:hover         { @apply bg-muted text-foreground; }
    &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
  }
}
```

The behavior of A and B is identical: both expand in the engine into the same logical CSS properties,
which the browser resolves from `dir`. Choosing A vs B is about organization (the decision tree in SKILL.md), not
about direction support: it is the same either way.

---

## 8. Connecting with the rest of the skill

- **Tokens are orthogonal to direction.** `border-s border-border`, `ps-4`, `text-start` freely
  combine with semantic colors/radii from `references/tokens.md` — a logical utility sets the
  *side*, the token sets the *value*. Dark mode and RTL are independent and combine without conflicts.
- **The `@apply` group order** for logical padding/borders is the same canon as for physical ones
  (`references/approaches.md`, `resources/apply-grouping.md`): `ps-`/`pe-` go in the "padding" group,
  `border-s`/`border-e` — in the "background/borders/shape" group.
- **States and variants** combine as usual: `rtl:`/`ltr:` are stackable variants just like any other,
  read left to right (`references/gotchas.md` §1; conceptually — `docs/variants-and-states.md`).
- **Review.** When reviewing code, physical `pl-`/`pr-`/`ml-`/`mr-`/`left-`/`right-`/`text-left`/
  `text-right` in a direction-dependent layout is a reason to suggest the logical equivalent (unless
  it is intentionally single-direction UI).

---

## Checklist (quick self-check)

- [ ] Inline layout (padding/margin/position/border/rounding/alignment) — with logical utilities (`ps-`/`pe-`, `ms-`/`me-`, `start-`/`end-`, `border-s`/`border-e`, `rounded-s`/`rounded-e`, `text-start`/`text-end`), not physical ones.
- [ ] Direction is set with the native `dir="rtl"`/`dir="ltr"` on the root (or a subtree), not with a utility or a JS class.
- [ ] Layout is NOT duplicated as `pl-4 rtl:pr-4` — that is an anti-pattern, replaced by `ps-4`.
- [ ] The `rtl:`/`ltr:` variants — only for a direction-dependent VISUAL (mirror a glyph/icon, flip a gradient), not for layout.
- [ ] Vertical utilities (`pt-`/`pb-`, `top-`/`bottom-`) were not touched for RTL — they are direction-agnostic.
- [ ] `lang` is specified alongside `dir` (hyphenation, typography, screen readers).
