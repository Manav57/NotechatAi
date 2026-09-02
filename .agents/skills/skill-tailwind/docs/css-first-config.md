# CSS-first configuration v4 — mental model

> Conceptual breakdown: **where config lives in Tailwind v4 and why**. This is not a syntax reference
> (that's in `references/v4-rules.md`, rules 1–4) and not a template (that's in `templates/entry.css` and
> `templates/theme.css`). Here is the *model in your head*: what unfolds from `@import`, what exactly
> `@theme` produces, when a JS config is actually needed, and how to stop thinking "config-first".
> All token values are placeholders; only the names are stable.

---

## 1. The main shift: config is CSS, not JS

In v3 the source of truth was `tailwind.config.js`: a JS object the build read to learn the
palette, radii, breakpoints, plugins. The CSS file was "dumb" — three `@tailwind` directives into
which the engine injected the generated output. Config and styles lived in **different worlds**.

In v4 this separation is gone. **The config lives in the same CSS where you write your styles.** The
entry point is `@import "tailwindcss"`, tokens are `@theme`, custom utilities are `@utility`, custom
variants are `@custom-variant`. By default there is **no JS file at all**, and it isn't even picked
up if it just sits nearby (see §5).

Mental model: **the CSS file is the single source of truth.** Not "CSS + config", but a single file
(or a chain of `@import`s) that the build reads top to bottom as ordinary CSS with a few extra
at-rules. Most "where do I configure this?" questions in v4 have the answer "in this same CSS, with
the `@theme`/`@utility`/`@custom-variant` directive", not "in a separate JS".

Why this is better for us: tokens become real CSS variables (you can see them in DevTools, they
work at runtime, you can override them in `.dark` or in `@media`), rather than values baked into the
build. Details on tokens as variables — `references/tokens.md` and `docs/design-tokens.md`.

---

## 2. What unfolds from `@import "tailwindcss"`

The single line `@import "tailwindcss";` is not "magic" but an ordinary CSS module import that
internally unfolds into a cascade-layer declaration and three sub-imports:

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css"      layer(theme);
@import "tailwindcss/preflight.css"  layer(base);
@import "tailwindcss/utilities.css"  layer(utilities);
```

Key to the model: **the `@layer` order sets the cascade**, and it is fixed — `theme → base →
components → utilities`. What's inside each layer:

- **`theme`** — the engine's default design tokens as CSS variables (palette in oklch, a single
  `--spacing`, the `--text-*`, `--radius-*`, `--shadow-*` scales, breakpoints, etc.). Your `@theme`
  (§3) adds/overrides variables right here.
- **`base`** — Preflight (the modern reset). An important consequence: `border`/`ring` are drawn
  with `currentColor` by default, not the gray from v3 (see `references/v4-rules.md`, rule 16).
- **`components`** — a reserved layer. Empty on its own; this is where the semantic
  class-components of Approach B go (`@layer components { … }`).
- **`utilities`** — all utilities (`bg-*`, `flex`, `p-4`, …) and your `@utility`.

Why layers matter: utilities sit **later** than base in the cascade, so a utility class always
overrides an element's base style without a specificity race. And `@layer components` (layer B) comes
**before** utilities — so a single utility in the markup can always override a class-component
precisely. This is not an accident but the reason both of the skill's approaches coexist
conflict-free.

> Anti-pattern: `@tailwind base; @tailwind components; @tailwind utilities;` — dead in v4. Only
> `@import "tailwindcss";` (`references/v4-rules.md`, rule 1).

---

## 3. `@theme` — declaring tokens that generate utilities

`@theme` is the block where you declare design tokens **as top-level CSS variables**. Its sole job is
to populate the engine's design system with your values.

```css
@theme {
  --color-primary: oklch(52% 0.12 255);        /* value is a placeholder */
  --color-primary-foreground: oklch(99% 0 0);
  --radius-md: 0.375rem;
}
```

### What exactly gets generated

A token name is not an arbitrary variable but a **contract**: its namespace (`--color-*`, `--radius-*`,
`--spacing`, `--font-*`, …) tells the engine **which family of utilities to generate**. By declaring
`--color-primary`, you get the entire set for free:

| You declared | You got the utilities |
| --- | --- |
| `--color-primary` | `bg-primary`, `text-primary`, `border-primary`, `ring-primary`, `fill-primary`, `outline-primary`, … + slash opacity `bg-primary/90` |
| `--radius-md` | `rounded-md` (and the logical `rounded-s-md`, …) |
| `--spacing` (one token) | the entire numeric scale `p-4`, `mt-2`, `gap-6` — computed as `calc(var(--spacing) * N)`, not stored as a list |

Hence two consequences for the model:

1. **Token name = utility name.** That's why the skill fixes *canonical semantic names*
   (`primary`, `muted`, `card`, `border`, `ring`, `danger`, …) — these are exactly what become class
   names in the markup. The full canon — `resources/tokens-table.md`, the ready-made set —
   `templates/theme.css`.
2. **`@theme` accepts only top-level `--custom-properties`** (and `@keyframes`). You cannot nest a
   variable under a selector or `@media` inside `@theme`. If a variable should *not* generate a
   utility (an ordinary helper CSS variable), its place is in `:root`, not in `@theme`
   (`references/v4-rules.md`, rule 2).

### `@theme` vs `:root` vs `@theme inline`

- **`@theme { --color-x: … }`** — generates a utility AND emits the variable into `:root`. The default.
- **`:root { --x: … }`** — an ordinary variable; does NOT generate a utility. For helper values.
- **`@theme inline { … }`** — the value is substituted into utilities *directly*, without `var(--…)`.
  Needed when a token references another variable that you override in `.dark` (otherwise the utility
  would "freeze" the light value). The breakdown of the `@theme inline` + `.dark` pairing —
  `references/tokens.md`.

> Dark mode in our template is done by overriding the **same** tokens inside `.dark { … }` — that
> is, the same `bg-card` utility picks up a different variable value depending on the theme.
> See `templates/theme.css` and (conceptually) `docs/dark-mode.md`.

---

## 4. Entry-CSS structure: what to put where

The canonical skeleton — `templates/entry.css` (the entry point) + `templates/theme.css` (the tokens).
A mental map of "what's in which file and in what order":

```
entry.css                      ← the ONLY entry point into the build
├── @import "tailwindcss"      ← the core: unfolds the layers theme→base→utilities (§2)
├── @import "./theme.css"      ← your tokens and dark overrides (extracted separately)
│     theme.css:
│       @custom-variant dark … ← declaring the dark mode variant
│       @theme { --color-* … } ← tokens → utilities (§3)
│       .dark { --color-* … }  ← overriding the same tokens
│       @layer base { … }      ← the project's global base rules
├── @custom-variant …          ← your custom variants (opt.)
├── @utility …                 ← your custom utilities (opt.)
└── @source / @source inline   ← scan paths and safelist (opt.)
```

Placement rules (order matters — it's an ordinary CSS cascade):

- **`@import "tailwindcss"` — always first.** Then the tokens. Everything else after, so it can see
  the theme.
- **`@theme`** — in `theme.css` (or in entry, if you don't split). The token declaration.
- **`@custom-variant`** — next to the entry. Declaring variants like the class-based `dark` or your
  own `hocus`. More on variants — `docs/variants-and-states.md`,
  `docs/custom-utilities-and-layers.md`.
- **`@utility`** — in entry, after the imports. Custom utilities (NOT `@layer utilities` — rule 7
  in `references/v4-rules.md`).
- **`@layer components`** — this is where Approach B class-components (BEM + `@apply`) go. See
  `references/approaches.md`.
- **`@apply` in a separate CSS module / scoped `<style>`** — requires `@reference "…/entry.css"` at
  the top of the file, otherwise the theme is "not visible" and the build fails (`references/v4-rules.md`, rule 15).
- **`@source` / `@source inline(…)`** — at the bottom. Non-standard scan paths and a safelist for
  names assembled dynamically (`references/v4-rules.md`, rule 17).

> Why `theme.css` is extracted separately: tokens are the most frequently edited and most "designerly"
> part of the config. Keeping it in one file is convenient for mapping an external design system (we
> *map* it in `@theme`, not override it — see SKILL.md §3A). If you prefer a single file —
> `templates/entry.css` explains how to collapse the imports.

---

## 5. `@config` — when a JS config is actually needed

By default there is no JS config, and **it is not picked up automatically** (unlike v3). This is
deliberate: CSS-first covers almost every case. The JS config is a **v3 compatibility layer**, not
the main path.

It's needed only for genuine *dynamics* that can't be expressed in static CSS:

- token values **computed in JS** at build time (generating a palette programmatically);
- **ecosystem plugins** shipped as JS functions;
- programmatic generation of themes / safelists.

If it really is needed, we hook it in with an **explicit directive** from the CSS entry:

```css
@import "tailwindcss";
@config "../tailwind.config.js";   /* hooked in ONLY this way, not by auto-pickup */
@plugin "@tailwindcss/typography"; /* a JS plugin — via a separate directive */
```

A ready-made commented skeleton (with the note "usually not needed") — `templates/tailwind.config.js`.
The rules and rationale — `references/v4-rules.md`, rule 3.

> Anti-pattern: creating `tailwind.config.js` "out of habit", without real JS dynamics. This pulls in
> the compatibility layer and complicates the config. Always try `@theme` / `@utility` /
> `@custom-variant` first (`references/v4-rules.md`, the NEVER list).

---

## 6. `@source` and `@plugin` — briefly

Two helper directives whose purposes are often confused:

- **`@source "…"`** — controls *class detection*, not the theme. By default the engine walks the
  project tree itself (respecting `.gitignore`, excluding `node_modules`). `@source` is needed to:
  - add a non-standard path: `@source "../node_modules/some-ui-lib";`
  - exclude a path: `@source not "../legacy";`
  - **safelist** names assembled by concatenation: `@source inline("bg-primary bg-danger");`
    (supports brace expansion: `inline("{bg,text}-{primary,danger}")`).

  Why a safelist: the scanner looks for **literal** strings and does not execute code, so `bg-${tone}`
  is never found. The full breakdown — `references/v4-rules.md`, rule 17, and (conceptually)
  `docs/performance-and-bundle.md`.

- **`@plugin "…"`** — hooks in a JS plugin from the ecosystem (part of the compatibility layer, like
  `@config`). Used only when you need functionality that CSS-first doesn't cover.

Both are optional; their commented-out stubs are already in `templates/entry.css`.

---

## 7. Common mistakes: "config-first" thinking from v3

The most common class of mistakes is carrying over v3 reflexes, where the config was "the main thing"
and CSS was derived.

- **"First I'll open `tailwind.config.js`".** In v4 the first thing you open is the **CSS entry** and
  edit `@theme`. There probably is no config file — and there shouldn't be.
- **"I'll add a color to `theme.extend.colors`".** That's JS thinking. In v4 — `--color-primary: …`
  in `@theme`; the `bg-primary` utility appears on its own (§3).
- **"I'll put my utility in `@layer utilities { .x {} }`".** In v4 — `@utility x { … }`, otherwise
  the engine won't sort it in the cascade and won't give it variants (`hover:x`). Rule 7.
- **"The config will be picked up by itself since the file is sitting nearby".** There is no
  auto-pickup — you need an explicit `@config` (§5). Rule 3.
- **"`important: true` / `prefix` go in the config".** Now these are *import* parameters:
  `@import "tailwindcss" important;` and `@import "tailwindcss" prefix(tw);`. Don't confuse the global
  `important` with the per-utility suffix `bg-danger!` — these are different things (rule 13).
- **"A token and an ordinary variable are the same thing".** No: everything that lives in `@theme`
  **generates a utility**. Helper variables — in `:root` (§3).

The root of all these mistakes is one: in v3 the config described the system *outside* CSS. In v4
**CSS is the config**. Keep exactly this in mind — and most of the gotchas disappear.

---

## 8. Minimal working entry + theme

A condensed working minimum (full, commented versions — `templates/entry.css` and
`templates/theme.css`; here is a compact slice of the same model).

**`entry.css`** — the entry point:

```css
@import "tailwindcss";
@import "./theme.css";

/* custom variants/utilities/safelist — as needed, below the imports:
   @custom-variant hocus (&:hover, &:focus);
   @utility content-grid { display: grid; }
   @source inline("bg-primary bg-danger");                                  */
```

**`theme.css`** — tokens and dark mode:

```css
@import "tailwindcss";

/* class-based dark mode: override the dark variant */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* values are PLACEHOLDERS; the names are stable */
  --color-background: oklch(99% 0 0);
  --color-foreground: oklch(21% 0.01 255);

  --color-card: oklch(100% 0 0);
  --color-card-foreground: oklch(21% 0.01 255);

  --color-primary: oklch(52% 0.12 255);
  --color-primary-foreground: oklch(99% 0 0);

  --color-border: oklch(92% 0.004 255);
  --color-ring: oklch(62% 0.02 255);

  --radius-md: 0.375rem;
}

/* dark mode — the same tokens, different values */
.dark {
  --color-background: oklch(18% 0.01 255);
  --color-foreground: oklch(96% 0.004 255);
  --color-card: oklch(21% 0.01 255);
  --color-card-foreground: oklch(96% 0.004 255);
  --color-primary: oklch(70% 0.12 255);
  --color-primary-foreground: oklch(18% 0.01 255);
  --color-border: oklch(30% 0.01 255);
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

This is enough for `bg-background`, `text-foreground`, `bg-card`,
`bg-primary text-primary-foreground`, `border border-border`, `rounded-md`, the slash opacity
`bg-primary/90`, and dark mode via the `.dark` class on the root to work in the markup. The full
canonical token set (success/warning/muted/accent/input, etc.) — in `templates/theme.css` and
`resources/tokens-table.md`.

---

## See also

- Wrong→Correct→Why syntax for each directive — `references/v4-rules.md` (rules 1–4, 7, 13, 15, 17).
- Tokens as a design system (the semantic set, `.dark`, `@theme inline`) — `references/tokens.md`, `docs/design-tokens.md`.
- Subtle gotchas (`bg-(--var)`, `@reference`, `@source`, currentColor) — `references/gotchas.md`.
- Templates — `templates/entry.css`, `templates/theme.css`, `templates/tailwind.config.js`.
