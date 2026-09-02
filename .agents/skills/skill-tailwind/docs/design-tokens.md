# Design tokens: the mental model

A conceptual breakdown — **why** design tokens are needed at all and **why** they are structured the
way they are in Tailwind v4. This is not a reference: the full canonical set of names, light/dark values, and
utilities live in `references/tokens.md` (the implementation how-to) and `resources/tokens-table.md`
(the "name → role → utility → light → dark" table). Here you'll find the models that make those tables
meaningful: the abstraction hierarchy, contrast pairs, color-space choice, `@theme` forms,
and the "when `arbitrary`, when a token" heuristic.

> The single thesis it all reduces to: **a token is a name for a role, not for a value.** Markup and
> `@apply` reference the role (`bg-primary`), the value changes under the hood. Everything else is a
> consequence of this thesis.

---

## 1. Why a semantic token instead of a raw color

Picture two buttons. The first is written as `bg-blue-600 text-white`, the second as
`bg-primary text-primary-foreground`. Visually, in the moment, they're identical. The difference shows up over
**time**: when the brand swaps blue for indigo, when a dark mode is added, when the designer
decides the "primary action" should now be a bit less saturated.

`bg-blue-600` is a **fact about pixels**. It knows nothing about *why* the button is blue. To
recolor, you'd have to find every occurrence of `blue-600` across the codebase and decide, in each place:
is this blue the "primary action", or a "link", or a "highlighted row"? The semantics are lost; they
have to be reconstructed by eye.

`bg-primary` is a **fact about intent**. It says "this is the primary interactive accent." Recoloring
is a single edit of the `--color-primary` value in `@theme`; the meaning isn't lost in the process, because it's
encoded in the name. A raw color describes *how it looks*; a semantic token describes *what it
is*. That's why the rule in markup is `bg-primary`, not `bg-blue-600` and not
`bg-[oklch(52%_0.12_255)]`.

A raw color is appropriate in exactly one case — when the value has **no** role beyond a single node
(one-off geometry, a single exception). On that boundary, see §6.

---

## 2. The hierarchy: Brand → Semantic → Component

The semantic layer isn't the only one. It helps to see three levels of abstraction and understand who
references whom. The arrow means "gets its value from."

```
Brand (palette raw material)   Semantic (role/intent)          Component (targeted freedom)
  --brand-blue-600     ──────►   --color-primary        ──────►   --color-button-bg
  oklch(52% 0.12 255)            = var(--brand-blue-600)           = var(--color-primary)
   "this particular blue"         "primary action"                  "the background of this exact button"
```

- **Brand** — abstract brand palette values: `--brand-blue-600`, the gray scale, accent
  tones. This is the vocabulary of *colors as such*. Neither markup nor `@apply` reference the brand
  layer — it's raw material.
- **Semantic** — a *role*, not a color: `--color-primary`, `--color-danger`, `--color-muted`. Only
  this level lands in `@theme` as a utility name and only it appears in markup. It changes
  rarely: roles are more stable than their concrete visual embodiment.
- **Component** — a narrow variable for a specific component, when it needs its **own**
  degree of freedom (`--color-button-bg`), equal by default to the semantic token. It's introduced
  **only when genuinely necessary** — otherwise superfluous names proliferate with no benefit.

Why separate Brand and Semantic if you could just write oklch straight into `--color-primary`? Because
they are two **different axes of change**. "Swap the brand blue for indigo" is a brand-layer edit.
"Make links primary instead of accent" is a mapping edit at the semantic layer. When they're kept apart,
each change is local:

```css
@theme {
  /* Semantic references brand — change the brand, and semantics and all utilities follow automatically */
  --color-primary: var(--brand-blue-600);
  --color-primary-foreground: var(--brand-white);
}
```

> In a small project the brand layer can be omitted and values written straight into the semantic tokens — that's
> the norm, and it's exactly how the canonical `templates/theme.css` looks. The hierarchy is a tool against
> complexity, not a mandatory ritual. The component layer is even more of a last resort.

The canonical semantic set (which roles exactly, under which names) — `references/tokens.md`
and `resources/tokens-table.md`; it's deliberately not duplicated here.

---

## 3. The `*-foreground` pairs: contrast baked into the theme

Every surface color comes paired with a "foreground" color — the text and icons placed on top of it:
`primary` + `primary-foreground`, `card` + `card-foreground`, `muted` + `muted-foreground`. This isn't
naming cosmetics, it's an **accessibility (a11y) invariant**.

The idea: contrast is a property of the **pair**, not of an individual color. "Blue" by itself is neither contrasty
nor non-contrasty — it's contrasty *relative to* what's written on it. If the markup always
writes the surface and its foreground **together** (`bg-card text-card-foreground`), then sufficient
contrast becomes a property of the **theme**, not of each markup author's discipline. The designer
guarantees contrast once — in the values of the pair; the markup gets it for free under any value
swap and in any theme.

```html
<!-- contrast is "baked into" the pair: plug in any theme values — the text stays readable -->
<div class="bg-card text-card-foreground">…</div>
<div class="bg-primary text-primary-foreground">…</div>
```

The anti-pattern is `bg-card text-foreground`: two **different** pairs are mixed. In light mode you might
get lucky, but when `card` is overridden in `.dark` (or in a high-contrast theme) nothing guarantees
that the global `foreground` stays readable on this particular surface. The rule is simple:
**take a surface — take its own `-foreground`.**

This is also why `ring` is separated from `border`: the focus ring must not depend on the border color.
The breakdown of this and other pairs (including `input`, statuses) — `references/tokens.md`.

---

## 4. Why oklch

The color space isn't a matter of taste; the choice has an engineering rationale, and it's dictated by the
engine: the entire default Tailwind v4 palette is written in **oklch** (22 color ramps,
the Tailwind v4 defaults). Keeping your own theme in the same coordinate system
means not fighting the engine.

What oklch gives you conceptually (the format is `oklch(L C H)`: lightness, chroma, hue):

- **Perceptual uniformity in lightness.** The same shift in `L` yields the same *visual*
  difference — regardless of hue. That's why a shade scale (`50…950`) or a dark mode can be built
  predictably: "darker by this much" means the same thing for blue and for red. In HSL it's
  not so — there the same lightness shift feels different across hues.
- **Independent axes.** You can change saturation (`C`) without touching perceived lightness, and
  rotate hue (`H`) while holding brightness. These are exactly the operations needed when building themes.
- **Wide gamut (P3).** oklch addresses a wider color gamut than sRGB-bound hex —
  colors don't "hit the ceiling" on modern displays.

Practical takeaway: write new theme values in oklch, and mix colors **in linear
space** (`in oklab`) — on this, see §5.1. Hex/rgb in theme values isn't a compile error, but it's
a departure from the engine's coordinate system; you don't do it without a reason.

---

## 5. The three `@theme` forms and the two operations on the namespace

`@theme` looks like a single block, but it has **emit modes**, and the chosen mode determines whether
you can later override the token at runtime (read: switch the theme). This is the most common point
of confusion. The behavior of `@theme` (modes `default` / `inline` / `reference`) is documented in
the official Tailwind documentation (Theme variables); details on the emit modes — in
`references/tokens.md`.

### 5.1 The alpha scale via `color-mix()`

Before multiplying tokens — a word on translucency. In 90% of cases you need the **slash modifier**:
`bg-primary/90`, `bg-foreground/50`, `border-border/60`. The engine applies the alpha on the fly, **no new
token needed** — don't introduce `--color-primary-90`.

A named alpha scale is justified only when specific translucent steps are
**reused** and need their own **name** (that is, they've become part of the design system — this is the
promotion from §6). Then they're derived from the base token, so a single edit of the base recolors the whole
scale:

```css
@theme {
  --color-primary-100: color-mix(in oklab, var(--color-primary) 10%, transparent);
  --color-primary-200: color-mix(in oklab, var(--color-primary) 20%, transparent);
}
```

Mix `in oklab` (linear space), not `in srgb` — this aligns with the oklch palette and
gives even transparency without muddy intermediate tones. More on this — `references/tokens.md` §4.

### 5.2 `@theme` / `@theme inline` / `@theme reference` / `@theme default`

The key question when choosing a form: **should the token stay an overridable variable at
runtime?** The answer determines whether dark mode works through it.

| Form | What it does | When to use |
|---|---|---|
| `@theme { … }` | emits `--color-*` into `:root` **and** generates utilities; the value stays `var(--…)` | the default; everything **themeable** (colors that `.dark` overrides) |
| `@theme inline { … }` | **inlines** the value straight into the utility instead of `var(--…)` — there's no variable in `:root`, no runtime override | static things referencing another variable (`--font-sans: var(--font-base), system-ui`), where the double indirection isn't needed |
| `@theme reference { … }` | the token is **registered but NOT emitted** as a variable — it only generates utilities | shared theme files / inclusion via `@reference`, to avoid duplicating variables |
| `@theme default { … }` | a **default** value, overridable by a user token of the same name | this is how the built-in theme is declared in `theme.css`; rarely needed in your own code |

The main practical consequence concerns `inline` and dark mode. If a token's value is
`var(--something)`, then a plain `@theme` gives the utility `var(--color-x)`, which itself equals
`var(--something)` — **double indirection**, and both layers are overridable. `@theme inline`
collapses this to one level — but you then **cannot** override such a token via `.dark { --color-x: … }`,
the value is inlined into the utility.

Takeaway: for **themeable colors use a plain `@theme`** — indirection through a variable is precisely
the mechanism of dark mode (`.dark` changes the `var` value, the utility follows). `inline` is
for statics like the font stack. Spelled out, with references to `theme.ts` — `references/tokens.md`
§4.2; the mechanics of dark mode itself (`@custom-variant dark` + overriding the same names) —
`references/tokens.md` §3 (the conceptual breakdown — `docs/dark-mode.md`).

### 5.3 Resetting the namespace: `--color-*: initial`

The default v4 palette is 22 "rainbow" ramps. If the design system is self-contained, these defaults only
get in the way: nothing stops an author from writing `bg-purple-500` past the tokens. Resetting the namespace
disciplines the team — leaving **only** your own semantic names:

```css
@theme {
  --color-*: initial;            /* wipe the ENTIRE group of default colors */
  --color-background: oklch(99% 0 0);
  --color-primary:    oklch(52% 0.12 255);
  /* …only the canonical semantic set… */
}
```

`--color-*: initial` wipes the `--color-*` group; `--*: initial` wipes **all** namespaces
(including spacing/radii/fonts — then you reintroduce them yourself). It's a trade-off: discipline in
exchange for losing the convenient defaults. Apply it deliberately. Details — `references/tokens.md` §4.3.

---

## 6. The promotion heuristic: `arbitrary` → token (before → after)

Not every value has to be a token, and not every "magic number" is a sin. The boundary runs along
**meaning and repetition**, not "prettiness."

**Leave it `arbitrary`** — when the value occurs exactly once and carries no role beyond
this node: a unique geometry, a one-off exception.

```css
/* before: a one-off offset/color in exactly one place — honestly leave it arbitrary */
.alert_icon { @apply text-[oklch(58%_0.18_27)]; }
```
(A CSS variable in an arbitrary value is written `text-(--brand)`, **not** `text-[--brand]` — this is v4.)

**Promote it to a token** — given any of three signs:
1. **Duplication** — the same literal appeared ≥2–3 times;
2. **Role/name** — there's a meaning behind the value that gets spoken out loud in words ("this is the danger color",
   "this is the control radius");
3. **Centralized edit** — it's going to be changed during a redesign or theme swap.

```css
/* after: the color repeated and acquired the meaning "danger" → promotion into @theme */
@theme { --color-danger: oklch(58% 0.18 27); }
.alert_icon { @apply text-danger; }
```

The sign of the reverse move (leave it `arbitrary`): a unique geometry of a single node with no
reuse. This same ladder and the "where should the color/token live" tree are in `SKILL.md`
(decision tree 2) and `references/tokens.md` §6 — here it's given a conceptual unfolding.

---

## 7. §3A — mapping an EXTERNAL design system into `@theme`

This is the skill's central stance, and it's conceptual, not technical: **the skill is an
implementation layer, not a source of visual values.** When a project has a design system, a `DESIGN.md`,
or ready-made tokens — we don't **override** them, we **map** them into `@theme`. Tailwind here
is wiring, not the designer.

```
design system / DESIGN.md / ready-made tokens  →  @theme (name mapping)  →  utilities / BEM+@apply
        (source of values)                          (Tailwind wiring)        (implementation)
```

The conflict-resolution rule: in a dispute "the skill's convention" vs the design system —
**the design system wins**. The skill insists only on Tailwind v4 technical correctness
(v4 syntax, slash opacity, visible focus, the full set of states, no AI-slop), while
yielding the concrete **values**. No hardcoding brand colors "off the cuff", no AI-slop
defaults (purple-blue gradients, glass cards, excessive rounding, decorative blobs) —
precisely because the values don't belong to us.

**How to map (not override).** The design system declares its own variables (named however it
likes) — we merely **bind** our canonical semantic names to them. The values stay
on its side; an edit there flows automatically into the utilities.

```css
/* design-system.css declared its own --ds-* — this is NOT our file, we don't touch it:
   :root { --ds-surface: …; --ds-surface-raised: …; --ds-text: …; --ds-action: …; } */

@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* MAPPING: our stable names REFERENCE the DS tokens. We don't hardcode values. */
  --color-background:      var(--ds-surface);
  --color-foreground:      var(--ds-text);
  --color-card:            var(--ds-surface-raised);
  --color-card-foreground: var(--ds-text);
  --color-primary:         var(--ds-action);
}
```

Note: this is exactly the Brand → Semantic pattern from §2, only the Brand layer belongs to a **third-party**
design system. We don't **invent** dark mode either: if the DS switches its own `--ds-*` inside
`.dark` (or another context) — our names follow it automatically, since they
reference it. We introduce our own `.dark` block with concrete oklch **only** where the DS gives no dark
values.

> A nuance with `inline` (from §5.2): to remove the double indirection `--color-x → --ds-x → value`, you can
> `@theme inline { --color-background: var(--ds-surface); }`. But then runtime switching of our
> token is lost — switching has to happen **on the `--ds-*` side**. For systems that change
> `--ds-*` themselves by context, that's fine and even desirable.

No references to specific external skills/brands by name — only formulations and variable
mapping. The implementation procedure for the mapping — `references/tokens.md` §5; the step-by-step
playbook — `workflows/introduce-design-tokens.md`.

---

## Where to look next

- **The full canonical token set** (name → role → utility → light/dark) — `resources/tokens-table.md`.
- **The implementation how-to** (ready-made `@theme`, `.dark`, `@theme inline/reference`, color-mix,
  namespace reset, DS mapping) — `references/tokens.md`.
- **A ready-made theme file** — `templates/theme.css`; the entry point — `templates/entry.css`.
- **The "A vs B" and "where the color/token lives" decision trees** — `SKILL.md`.
- **Tokens in live markup** (how `bg-card`/`text-card-foreground` look in both approaches) —
  `examples/` (for instance, `examples/card/card.utility.html` and `examples/card/card.bem.scss`).
- **Related concepts** — `docs/dark-mode.md`, `docs/css-first-config.md`.
