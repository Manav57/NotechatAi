# Design tokens and theming in Tailwind v4

A reference on how to **declare**, **name**, and **wire up** design tokens in CSS-first
Tailwind v4 — framework-agnostically (pure CSS/SCSS, no JS runtime). This is the
**implementation** layer: how to correctly express tokens via `@theme`. The concrete **values** are
placeholders for the project's design system; only the **names** are stable.

> Behavior verified against the official Tailwind v4 documentation: the default theme (oklch, a single
> `--spacing: 0.25rem`), the `@theme` modes (`default` / `inline` / `reference`), and the CSS functions
> (`--alpha`, `--spacing`, `--theme`).

---

## 1. The canonical `@theme` set

This is the skill's base theme file (also `templates/theme.css`). The semantic names below are
**canonical**: every example in `examples/`, `resources/`, and utilities like
`bg-background`, `text-foreground`, `border-border`, etc. rely on them. The values are **placeholders**,
replaced to fit the design system; the names are kept stable.

```css
@import "tailwindcss";

/* Class-based dark mode (v4 custom variant) */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Color — SEMANTIC PLACEHOLDERS. Replace the VALUES with the project's design
     tokens / design system; keep the NAMES stable. No brand colors hardcoded. */
  --color-background: oklch(99% 0 0);
  --color-foreground: oklch(21% 0.01 255);

  --color-muted: oklch(96% 0.004 255);
  --color-muted-foreground: oklch(52% 0.01 255);

  --color-card: oklch(100% 0 0);
  --color-card-foreground: oklch(21% 0.01 255);

  --color-border: oklch(92% 0.004 255);
  --color-input: oklch(92% 0.004 255);   /* add when you have form inputs */
  --color-ring: oklch(62% 0.02 255);

  --color-primary: oklch(52% 0.12 255);
  --color-primary-foreground: oklch(99% 0 0);

  --color-accent: oklch(96% 0.004 255);
  --color-accent-foreground: oklch(21% 0.01 255);

  --color-success: oklch(60% 0.13 150);
  --color-success-foreground: oklch(99% 0 0);

  --color-warning: oklch(75% 0.13 80);
  --color-warning-foreground: oklch(24% 0.03 80);

  --color-danger: oklch(58% 0.18 27);
  --color-danger-foreground: oklch(99% 0 0);

  /* Fonts — name by ROLE (heading / body / mono), never by appearance. Do NOT name a
     font token --font-display: `display` is both a CSS property and the @font-face
     `font-display` descriptor, so the name shadows a real CSS keyword. Stacks below are
     placeholder defaults — swap in the design system's families, keep the role names. */
  --font-heading: ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", "Cascadia Code", monospace;

  /* Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
}

/* Dark theme — override the same tokens (values are placeholders too) */
.dark {
  --color-background: oklch(18% 0.01 255);
  --color-foreground: oklch(96% 0.004 255);
  --color-muted: oklch(26% 0.01 255);
  --color-muted-foreground: oklch(68% 0.01 255);
  --color-card: oklch(21% 0.01 255);
  --color-card-foreground: oklch(96% 0.004 255);
  --color-border: oklch(30% 0.01 255);
  --color-input: oklch(30% 0.01 255);
  --color-ring: oklch(62% 0.02 255);
  --color-primary: oklch(70% 0.12 255);
  --color-primary-foreground: oklch(18% 0.01 255);
  --color-accent: oklch(28% 0.01 255);
  --color-accent-foreground: oklch(96% 0.004 255);
  --color-danger: oklch(62% 0.17 27);
  --color-danger-foreground: oklch(99% 0 0);
  /* Darken the browser's native layer (scrollbars/form controls) with the theme — see docs/dark-mode.md §7 */
  color-scheme: dark;
}

@layer base {
  * { @apply border-border; }
  /* Light native layer (scrollbars/form controls) by default; .dark flips it — see docs/dark-mode.md §7 */
  :root { color-scheme: light; }
  body { @apply bg-background text-foreground; }
}
```

### Group explanation

| Group | Tokens | Why |
|---|---|---|
| **Surfaces** | `--color-background` / `--color-foreground` | the base page background and default text (via `@layer base body`) |
| **Muted** | `--color-muted` / `--color-muted-foreground` | secondary surfaces and text (captions, placeholders, inactive elements) |
| **Cards** | `--color-card` / `--color-card-foreground` | a raised surface above the background (cards, popovers, panels) |
| **Outlines / inputs** | `--color-border`, `--color-input`, `--color-ring` | borders; input background/border; focus ring. `ring` is kept separate from `border` — focus must not depend on the border color |
| **Action accent** | `--color-primary` / `--color-primary-foreground` | the primary interactive color (main buttons, action links) |
| **Soft accent** | `--color-accent` / `--color-accent-foreground` | hover highlight for items, soft emphasis (not the attention-grabbing primary) |
| **Statuses** | `--color-success`, `--color-warning`, `--color-danger` (+ `*-foreground`) | state semantics: success / warning / error-danger |
| **Fonts** | `--font-heading`, `--font-mono` (add `--font-body` if it differs) | font-family roles → utilities `font-heading` / `font-mono`; named by role, not by look |
| **Radii** | `--radius-sm/md/lg/xl` | a single rounding scale → utilities `rounded-sm/md/lg/xl` |

**The `*-foreground` pairing principle.** Every surface color is paired with a "foreground"
color — the text/icons on top of it. This guarantees contrast within the pair under any value
replacement: the markup writes `bg-card text-card-foreground`, and the contrast is "baked into" the theme itself.

**This set is a starter menu, not a mandate.** The names above are a sensible default vocabulary —
**keep only the tokens that have a real consumer** in the markup, and add the ones a real component
needs. A token with no utility referencing it is dead weight: prune it. For example `--color-input`
is here for completeness — **add it when you have form inputs**, and drop it otherwise. The same goes
for a status token on a project that never surfaces that state. Conversely, when a component truly needs
a new role (a dedicated category color, a soft status surface), introduce a named token rather than
reaching for an arbitrary value (see §6 on promotion).

**Status tokens mean STATE, not appearance.** `--color-success` / `--color-warning` /
`--color-danger` (and a `--color-info` if you add one) are **reserved for state feedback** — a
validation result, an alert level, an operation's outcome. They are **not** a palette of "green / amber /
red swatches" to reach for when you need a few distinct decorative colors. For **categorical
decoration** — pricing tiers, tags, labels, brand accents, anything where the color carries
*category*, not *meaning* — use `--color-accent` for a single neutral highlight, or introduce
**dedicated category tokens** (`--color-tier-bronze`, `--color-tier-gold`, `--color-tag-feature`, …;
ordinary `@theme` tokens, still fully themeable and dark-overridable). Overloading a status token for
decoration couples an unrelated category to state semantics, and the meaning drifts: the moment "tier
X = danger" is an appearance choice, the next implementer maps it differently and the contract breaks.
A token is named by what it **means**, never by what it looks like.

**Several ORDERED categories/tiers → a dedicated categorical SCALE, not one accent.** The single
`--color-accent` above handles **one** neutral highlight (mark *this* item as featured). But some UIs have
a row of **ordered, mutually-distinct categories** — pricing/donation tiers (bronze → silver → gold →
platinum), severity rungs that are *labels* not live state, ranked badges, plan levels. Here one accent is
not enough: you cannot differentiate five tiers with a single highlight token, and the status palette is
**off-limits** (mapping "tier 3 = warning" re-couples category to state — see above). The positive answer
is a **small dedicated categorical scale**: either an ordinal ramp `--color-tier-1 … --color-tier-n` or a
set of named category tokens (`--color-tier-bronze`, `--color-tier-gold`, …). These are ordinary `@theme`
tokens — they expand into utilities (`bg-tier-1`, `text-tier-gold`), stay themeable, and live in the same
brand/multi-brand switching machinery as everything else.

```css
@theme {
  /* An ORDERED categorical ramp — a separate axis from status, sized to the number of tiers.
     Values are placeholders; pick hues that read as distinct categories, not as success/warning/danger. */
  --color-tier-1: oklch(72% 0.04 250);   /* lowest rung  */
  --color-tier-2: oklch(70% 0.07 200);
  --color-tier-3: oklch(75% 0.10 145);
  --color-tier-4: oklch(80% 0.12 90);
  --color-tier-5: oklch(78% 0.14 50);    /* top rung     */
  /* Pair each with a *-foreground if labels sit on the tier color (see the *-foreground principle). */
}
```

> **Mirror the status-pair rule for dark mode.** Exactly like the status pairs in
> `templates/theme.css`, if you keep a tier scale it must get **`.dark` overrides** (and a contrast-checked
> `*-foreground` wherever text sits on a tier color) — otherwise the tiers keep their light values against a
> dark backdrop and the contrast is unverified. As always, only introduce the scale (and only as many rungs
> as the UI actually shows) when a real ordered-category component consumes it; an N-tier ramp with no
> consumer is dead weight (see the starter-menu note above).

**Why oklch.** The default Tailwind v4 palette in `theme.css` is entirely in oklch — a perceptually
uniform space: the same lightness shift yields the same visual difference,
without losing the palette's width (P3). We keep the theme in the same coordinate system as the engine.

**Fonts are named by ROLE, never by appearance — and never `--font-display`.** A `@theme` token name
*becomes a utility class* (`--font-heading` → `font-heading`), so pick names that describe the role the
family plays: `--font-heading`, `--font-body`, `--font-mono`, `--font-brand`. Do **not** name a font token
`--font-display`: `display` is both a CSS property *and* the `@font-face` `font-display` descriptor, so the
name shadows a real CSS keyword — it still compiles, but it reads ambiguously and is the one name to avoid.
The stacks in the canonical set are placeholder defaults; swap in the design system's families and keep the
role names stable. (Emit semantics — when to reach for `@theme inline` for a static font stack — are in §4.2.)

**Radii as utilities.** The names `--radius-sm/md/lg/xl` are expanded by the engine into the utilities
`rounded-sm/md/lg/xl`. This is part of the v4 renames (the default `rounded-sm` became `rounded-xs`),
but in our theme we specifically override `sm/md/lg/xl` to fit the project scale.

> **Caution — redefining a built-in scale token is a GLOBAL reinterpretation.** Overriding a token
> that already backs a whole utility scale — `--radius-*`, `--shadow-*`, `--blur-*`, `--text-*`,
> `--spacing` — changes the meaning of **every** utility on that scale at once. Shrinking `--radius-md`
> by one notch silently re-rounds every `rounded-md` in the project; it is a deliberate site-wide design
> decision, not a local tweak, and should carry a comment saying so. If you only need **one extra**
> value, **add a new named token** rather than bending a standard step — e.g.
> `--radius-blocky: 0.25rem;` (→ `rounded-blocky`) leaves `rounded-md` untouched for everyone else.
> Same logic for a single bespoke shadow or blur: name it, don't repurpose a standard rung.

**Transparency — a slash modifier, not a separate token.** For a darkened primary
write `bg-primary/90`, for a modal backdrop — `bg-foreground/50`. We do not introduce
`--color-primary-90`: the opacity modifier is applied by the engine on the fly (see §4 on the alpha scale,
for when semi-transparent **named** shades are nonetheless needed as tokens).

---

## 2. Token hierarchy: Brand → Semantic → Component

Three levels of abstraction. Markup and `@apply` reference **only the semantic level** —
it is stable, while the specifics and the brand can be changed under the hood.

```
Brand (abstract values)                 Semantic (role/purpose)            Component (targeted)
  --brand-blue-600  ───────────────►      --color-primary  ──────────────►   --color-button-bg
  oklch(52% 0.12 255)                      = var(--brand-blue-600)            = var(--color-primary)
```

- **Brand** — the "raw" values of the brand palette (`--brand-blue-600`, the grayscale,
  accent tones). They live separately; neither markup nor `@apply` reference them **directly**.
- **Semantic** — a *role*, not a color: `--color-primary`, `--color-danger`, `--color-muted`.
  Only this level enters `@theme` as a utility name. Changes rarely.
- **Component** — a narrow, targeted variable, for when a component needs its own degree of freedom
  (`--color-button-bg`), equal to the semantic token by default. Introduce it **only when there is a
  real need** — otherwise you breed superfluous names.

```css
@theme {
  /* Semantic REFERENCES brand. Change the brand — the semantics and all utilities follow it. */
  --color-primary: var(--brand-blue-600);
  --color-primary-foreground: var(--brand-white);
}
```

> Rule: **in markup — semantics only.** `bg-primary`, not `bg-brand-blue-600` and not
> `bg-[oklch(52%_0.12_255)]`. This is the "contract": design changes the brand layer, the implementation
> touches not a single line of HTML/SCSS.

**A component's "tone vocabulary" is part of the token contract.** When a component exposes a set of
variants by tone (a badge with `success` / `warning` / `danger` states, a tier chip with
`bronze` / `gold` / `platinum`), the mapping *variant → token* must be **defined once and reused
everywhere** — across pages, across both approaches (utility-first and BEM+`@apply`), across every
re-implementation. One meaning = one token. If "Admin = danger" in one place and "Admin = warning" in
another, the mapping is appearance-driven (a tell that a status token is being used for decoration —
see §1). Keep the categorical vocabulary on dedicated `--color-tier-*` / `--color-accent` tokens so it
stays stable and never collides with the state vocabulary.

---

## 3. Dark mode: `@custom-variant dark` + overriding the same variables

Two independent steps — don't confuse them.

**Step 1 — the variant.** Register a class-based dark variant (instead of v3's `darkMode: "class"`):

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Now `dark:bg-card`, `dark:text-foreground` fire when an element is inside
`.dark`. `:where(...)` keeps specificity at zero — overrides are predictable.
(An alternative is the built-in `dark` based on `prefers-color-scheme`; for a manual toggle you need
exactly the class-based variant above.)

**Step 2 — overriding the tokens.** The dark palette is **the same semantic names** with
different values inside `.dark`. The markup does not change at all: `bg-card text-card-foreground`
works in both themes, because the variables are resolved at runtime.

```css
.dark {
  --color-background: oklch(18% 0.01 255);
  --color-foreground: oklch(96% 0.004 255);
  --color-card: oklch(21% 0.01 255);
  --color-card-foreground: oklch(96% 0.004 255);
  /* ...the same set of names, different values... */
}
```

> Why a `.dark` block and not `@theme`: values inside `@theme` go into `:root` and apply
> globally; dark overrides must live under the `.dark` selector so they can be switched at runtime.
> `@theme` defines the *names and utilities*, `.dark { ... }` — the *values for a context*.

Multiple themes (for example, "high-contrast") — the same technique: another selector class with the same
set of names. The utilities and markup remain untouched. Generalizing this technique to N brands is
covered in §3A.

---

## 3A. Multi-brand theming: N token sets via a class / `[data-theme]`

The dark mode from §3 is a special case of a more general pattern: **one and the same semantic
set of names, with a switchable set of values**. If `.dark` is the "second set of values", then a
brand is the "third, fourth, Nth set". The mechanics are identical: `@theme` declares the *names and
utilities* once, and each brand overrides the *values of the same variables* under its own
selector. The markup (`bg-primary`, `text-foreground`, `rounded-md`) doesn't know which brand is
active — it references only the semantics.

**The switch — a class or `[data-theme]` on `<html>`.** Two equally valid ways to attach the
theme context to the document root; inside is the same override block:

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* NAMES + UTILITIES are declared ONCE. The values here are default placeholders
     (e.g. brand A as the base). NOT inline — otherwise runtime switching will break. */
  --color-background: oklch(99% 0 0);
  --color-foreground: oklch(21% 0.01 255);
  --color-primary:    oklch(52% 0.12 255);   /* brand A placeholder */
  --color-primary-foreground: oklch(99% 0 0);
  --radius-md:        0.375rem;
}

/* Brand A — the CLASS approach on <html class="brand-a"> */
.brand-a {
  --color-background: oklch(99% 0 0);
  --color-foreground: oklch(21% 0.01 255);
  --color-primary:    oklch(52% 0.12 255);   /* placeholder: brand A accent */
  --color-primary-foreground: oklch(99% 0 0);
}

/* Brand B — the [data-theme] approach on <html data-theme="b"> */
[data-theme="b"] {
  --color-background: oklch(98% 0.01 95);
  --color-foreground: oklch(22% 0.02 95);
  --color-primary:    oklch(58% 0.16 25);    /* placeholder: brand B accent */
  --color-primary-foreground: oklch(99% 0 0);
  --radius-md:        0.5rem;                 /* brand B has a different rounding scale */
}
```

In markup you switch with a single attribute/class on the root — `<html class="brand-a">` or
`<html data-theme="b">`; everything else (utilities, BEM+`@apply`) stays unchanged.
The choice between `class` and `[data-theme]` is a matter of taste and the project's existing
conventions: the class is shorter in selectors, while `[data-theme]` explicitly separates the "theme axis"
from other classes and is more convenient for a finite number of mutually exclusive values
(`light` / `dark` / `b` / `high-contrast`).

**Themes are orthogonal.** Brand (`.brand-a` / `[data-theme="b"]`) and lightness (`.dark`) are two
independent axes. They can be combined: `<html data-theme="b" class="dark">` yields the dark variant of
brand B, provided the corresponding values are set inside `.dark` (or `[data-theme="b"].dark`).
Under each selector, override **only** the tokens that actually differ — the rest are
inherited from `@theme`.

**Where `@theme inline` is appropriate and where it's harmful.** This is the key choice for multi-branding:

| Scenario | Form | Why |
|---|---|---|
| A themeable token that changes between brands (color, radius) | regular `@theme { … }` | the value is emitted as `var(--color-…)`; the brand selector overrides the variable at runtime — this is exactly the switching mechanism |
| A static value, identical across all brands (font stack, fixed easing) | `@theme inline { … }` | the value is "imprinted" into the utility, there is no variable in `:root` — saves indirection where there is nothing to switch |

> **The harm of `inline` for switching.** `@theme inline` substitutes the value **directly into the utility**
> instead of `var(--…)`, so no variable remains in `:root` — and `.brand-a { --color-primary: … }`
> then **affects nothing**: the `bg-primary` utility carries the imprinted value, not a reference.
> Therefore **declare any token that differs between brands/themes with a regular `@theme`**,
> and reserve `inline` for what is decidedly not themeable. Details of the `@theme` forms are in §4.2.

Mapping to external `--ds-*` variables (§5) combines with this technique: if the design system
itself switches its `--ds-*` per brand, our names follow it automatically; if not —
we introduce brand selectors with concrete values, as above.

---

## 4. `color-mix()` for an alpha scale, `@theme inline/default/reference`, resetting the namespace

### 4.1 An alpha scale via `color-mix()` (oklab)

When you need **named** semi-transparent shades of a single semantic color (thin
backdrops, hover backgrounds), derive them from the base token via `color-mix` — one edit to the base
recolors the whole scale:

```css
@theme {
  --color-primary-50:  color-mix(in oklab, var(--color-primary)  5%, transparent);
  --color-primary-100: color-mix(in oklab, var(--color-primary) 10%, transparent);
  --color-primary-200: color-mix(in oklab, var(--color-primary) 20%, transparent);
}
```

We mix `in oklab` (a linear space for mixing) — this aligns with the engine's oklch palette
and gives smooth transparency without muddy intermediate tones.

> When the slash modifier is enough — use it (`bg-primary/10`), it doesn't breed tokens.
> A named alpha scale is justified only if specific steps are reused and they
> need their own **name** (that is, they have become part of the design system — see §6 on promotion).

### 4.1a A subtle/soft status surface — a governed token pair, not an ad-hoc tint

A "soft status" pill (a tinted background with a legible status-colored label) is a recurring need:
a faint success/warning/danger surface, not the loud solid fill. The **wrong** way is to tint the solid
hue ad hoc and put the *same solid hue* on top as text — `bg-success/15 text-success`,
`bg-warning/20 text-warning`. That pair is ungoverned: the foreground is the full-strength hue on a
washed-out version of itself, its contrast is unverified, it depends on whatever sits behind the
translucent layer, and it drifts per implementation.

Instead, **define the soft surface as a token pair** — a `*-subtle` background and a matching
`*-subtle-foreground` whose contrast you check *once*, exactly like the `*-foreground` principle in §1.
Derive the surface from the base status token via `color-mix` so one edit recolors the whole scale, and
give it a **legible** foreground (a darker shade of the same hue in light mode, lighter in dark mode):

```css
@theme {
  /* Soft status surfaces — contrast-checked pairs, derived from the solid status tokens. */
  --color-success-subtle: color-mix(in oklab, var(--color-success) 15%, transparent);
  --color-success-subtle-foreground: oklch(40% 0.10 150);   /* legible on the tint */

  --color-warning-subtle: color-mix(in oklab, var(--color-warning) 18%, transparent);
  --color-warning-subtle-foreground: oklch(38% 0.07 80);

  --color-danger-subtle: color-mix(in oklab, var(--color-danger) 15%, transparent);
  --color-danger-subtle-foreground: oklch(42% 0.14 27);
}

/* Dark theme — re-check the pair against the dark backdrop and override accordingly. */
.dark {
  --color-success-subtle: color-mix(in oklab, var(--color-success) 22%, transparent);
  --color-success-subtle-foreground: oklch(85% 0.12 150);
  --color-warning-subtle: color-mix(in oklab, var(--color-warning) 24%, transparent);
  --color-warning-subtle-foreground: oklch(88% 0.10 80);
  --color-danger-subtle: color-mix(in oklab, var(--color-danger) 22%, transparent);
  --color-danger-subtle-foreground: oklch(82% 0.13 27);
}
```

Markup (or `@apply`) then writes the **pair**, never a mismatched solid-on-tint:

```html
<span class="rounded-sm bg-success-subtle px-2 py-0.5 text-success-subtle-foreground">Online</span>
```

> **The rule:** a status pill is **either** the solid pair `bg-<status> text-<status>-foreground`
> **or** a defined `*-subtle` + `*-subtle-foreground` pair — **never** `bg-<status>/NN text-<status>`.
> The lightness values above are placeholders; verify the contrast of each pair against your real
> values in both themes. As with the alpha scale, only promote a soft surface to a token when you
> actually reuse it; a one-off faint tint can stay a slash modifier *if* its foreground is a
> contrast-checked color, not the base hue.

### 4.2 `@theme default` vs `@theme inline` vs `@theme ... reference`

The same `@theme`, but with different emit semantics (see the official Tailwind documentation — Theme variables):

| Form | What it does | When |
|---|---|---|
| `@theme { ... }` | a regular token: emits `--color-*` into `:root` **and** generates utilities | the default; almost always this |
| `@theme default { ... }` | a **default** value that is overridden by a user token of the same name | this is how Tailwind's built-in theme is declared; you rarely need it |
| `@theme inline { ... }` | the value is **substituted directly into the utility** instead of `var(--…)` — no variable in `:root`, runtime override is impossible | reach for it specifically when a token **references another variable** and you don't want double indirection (`--font-sans: var(--font-base), system-ui;`). For a plain *literal* that is never themed, plain `@theme` and `@theme inline` emit the **same** utility value, so either is fine |
| `@theme reference { ... }` (or `@import "tailwindcss" reference`) | the token is **registered but NOT emitted** as a CSS variable — it only generates utilities | shared theme files / a `@reference` import in isolated styles, to avoid duplicating variables |

The practical consequence of `inline`: if the token's value is `var(--something)`, then in a regular
`@theme` the utility gets `var(--color-x)`, which itself equals `var(--something)` — double
indirection, and both layers are overridable. `@theme inline` "imprints" the value into the utility: a single
level, but overriding via `.dark { --color-x: ... }` is then **impossible**. For themeable
colors we take a regular `@theme` (indirection through a variable is the very mechanism of dark mode);
`inline` earns its keep precisely when the token **references another variable** and you want to
collapse that double indirection. For a plain literal that is never themed (a fixed font stack, a fixed
easing), there is **no difference in the emitted utility** between plain `@theme` and `@theme inline` —
both bake the same value — so either form is correct; choose plain `@theme` if you'd still like the
variable visible in `:root`, or `inline` if you don't.

**Naming `--font-*` tokens.** A `@theme` token name **becomes a utility class name** (`--font-heading`
→ `font-heading`). Avoid font names that **shadow a real CSS keyword or descriptor** — most notably
`--font-display` (`display` is both a CSS property *and* the `@font-face` `font-display` descriptor): the
clash is only nominal (it still compiles), but it reads ambiguously. Prefer role-based names such as
`--font-heading`, `--font-body`, `--font-mono`, or `--font-brand`.

### 4.3 Resetting the namespace: `--color-*: initial`

The default v4 palette is 22 color ramps. If the design system is self-contained and the "rainbow"
defaults only get in the way (the risk of `bg-purple-500` bypassing the tokens), clear the entire color namespace and
keep **only** your own semantic names:

```css
@theme {
  --color-*: initial;          /* remove ALL default colors */

  --color-background: oklch(99% 0 0);
  --color-foreground: oklch(21% 0.01 255);
  --color-primary: oklch(52% 0.12 255);
  /* ...only the canonical semantic set... */

  /* --*: initial;  // full reset of all namespaces — for a minimal project */
}
```

`--color-*: initial` wipes the `--color-*` group; `--*: initial` — all tokens whatsoever (including
spacing/radii/fonts — then you re-introduce them yourself). Apply the reset deliberately: it
disciplines the team (tokens only), but deprives you of convenient defaults.

---

## 5. If the project already has a design system / `DESIGN.md` / ready-made tokens (§3A)

**The skill is an implementation layer, not a source of visual values.** When the project has a
design system, a `DESIGN.md`, or ready-made tokens — we do **not** override them, but **map**
them into `@theme`. The flow of responsibility:

```
design system / DESIGN.md / ready-made tokens  →  @theme (name mapping)  →  utilities / BEM+@apply
        (source of values)                          (Tailwind wiring)          (implementation)
```

In a conflict between "how the skill prefers it" and the design system — **the design system wins**.
The skill insists only on Tailwind v4 technical correctness, and yields on values.

**How to map (not override).** The design system exposes its own variables (named however) —
we merely **link** our canonical semantic names to them. The values
remain on the design system's side; an edit there automatically flows into the utilities.

```css
/* design-system.css declared its own variables (this is NOT our file, we don't touch it):
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
  /* MAPPING: our stable names REFERENCE the design system's tokens.
     We do NOT hardcode the values — they belong to the design system. */
  --color-background:      var(--ds-surface);
  --color-foreground:      var(--ds-text);
  --color-card:            var(--ds-surface-raised);
  --color-card-foreground: var(--ds-text);
  --color-primary:         var(--ds-action);
  --radius-md:             var(--ds-radius-control);
}
```

We also **don't invent** the dark mode: if the design system switches its `--ds-*` inside
`.dark` (or another context) — our names follow it automatically, since they reference
its variables. We introduce our own `.dark` block with concrete oklch values **only** where the design system
provides no dark values.

> Notes on `inline`: if you want to remove the double indirection (`--color-x → --ds-x → value`),
> you can `@theme inline { --color-background: var(--ds-surface); }`. But then runtime switching of
> our token is lost — switching has to happen **on the `--ds-*` side**. For systems
> that switch their `--ds-*` by context themselves, this is fine and even desirable.

No references to specific external skills/brands by name — only formulations and variable
mapping.

---

## 6. Promotion heuristic: arbitrary → token

Not every value has to be a token, and not every "magic number" is a sin. The ladder:

1. **A one-off exception → an arbitrary value.** You need a non-standard offset in exactly one place,
   with no meaning beyond that node — write it pointwise: `top-[3px]`, `w-[37rem]`,
   `bg-[oklch(52%_0.12_255)]`. This is more honest than introducing a token "just in case".
   - A CSS variable in an arbitrary value is written `bg-(--brand)`, **not** `bg-[--brand]`.
2. **Repetition / meaning emerged / a joint redesign → promote to a token.** The value occurs
   ≥2–3 times, OR there is a role behind it ("this is the danger color", "this is the control radius"), OR it
   is going to be changed centrally during a redesign — introduce a name in `@theme` and replace the
   arbitrary value with a semantic utility.

```css
/* before: a one-off exception — fine to leave arbitrary */
.alert_icon { @apply text-[oklch(58%_0.18_27)]; }

/* after: the color recurred and acquired the meaning "danger" → promotion to a token */
@theme { --color-danger: oklch(58% 0.18 27); }
.alert_icon { @apply text-danger; }
```

Signs it's time to promote: (a) duplication of a single literal; (b) the value has a **role/name**
in mind ("accent", "card border"); (c) it is edited centrally on a theme change.
The opposite sign (leave it arbitrary): the unique geometry of a single node without reuse.

---

## 7. Table: token → role → example utility

| Token (`@theme`) | Role | Example utility |
|---|---|---|
| `--color-background` | page background | `bg-background` |
| `--color-foreground` | primary text/icons | `text-foreground` |
| `--color-muted` | muted surface | `bg-muted` |
| `--color-muted-foreground` | secondary text | `text-muted-foreground` |
| `--color-card` | raised surface | `bg-card` |
| `--color-card-foreground` | text on a card | `text-card-foreground` |
| `--color-border` | outlines/dividers | `border-border` |
| `--color-input` | input background/border | `bg-input` |
| `--color-ring` | focus ring | `ring-ring` / `outline-ring` |
| `--color-primary` | primary action | `bg-primary` |
| `--color-primary-foreground` | text on primary | `text-primary-foreground` |
| `--color-accent` | soft highlight | `bg-accent` |
| `--color-accent-foreground` | text on accent | `text-accent-foreground` |
| `--color-success` | "success" state | `bg-success` / `text-success` |
| `--color-success-foreground` | text on success | `text-success-foreground` |
| `--color-warning` | "warning" state | `bg-warning` / `text-warning` |
| `--color-warning-foreground` | text on warning | `text-warning-foreground` |
| `--color-danger` | "danger/error" state | `bg-danger` / `text-danger` |
| `--color-danger-foreground` | text on danger | `text-danger-foreground` |
| `--font-heading` | heading font role | `font-heading` |
| `--font-mono` | monospace font role | `font-mono` |
| `--radius-sm` | small rounding | `rounded-sm` |
| `--radius-md` | base rounding | `rounded-md` |
| `--radius-lg` | large rounding | `rounded-lg` |
| `--radius-xl` | very large rounding | `rounded-xl` |

Transparency — a slash modifier on the utility: `bg-primary/90`, `bg-foreground/50`,
`border-border/60`. The base spacing step in v4 is a single `--spacing: 0.25rem` (the entire numeric
scale `p-4`, `gap-2` is computed from it via `--spacing()`, not stored as a list).
