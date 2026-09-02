# Tokens table — canonical semantic tokens

The skill's table of canonical tokens: **variable name → role → example utility → light → dark**.

> ⚠️ **All values are PLACEHOLDERS.** Only the variable **names** are stable. The concrete `oklch(…)`
> values are replaced to fit the project's design system: if there is a `DESIGN.md` / ready-made tokens — **map**
> them into `@theme` under these names, rather than redefining the semantics. The skill is responsible for wiring
> a token into Tailwind, not for choosing the color.
>
> This content matches `templates/theme.css`. Translucency is a slash modifier on the
> utility (`bg-primary/90`); there are no separate `*-opacity-*`.

## Colors (semantic colors)

Colors come in pairs of "surface + contrasting text on it" (`*` / `*-foreground`).

| Variable | Role | Example utility | Light (placeholder) | Dark (placeholder) |
| --- | --- | --- | --- | --- |
| `--color-background` | base page background | `bg-background` | `oklch(99% 0 0)` | `oklch(18% 0.01 255)` |
| `--color-foreground` | primary text on the background | `text-foreground` | `oklch(21% 0.01 255)` | `oklch(96% 0.004 255)` |
| `--color-muted` | muted surface (secondary blocks) | `bg-muted` | `oklch(96% 0.004 255)` | `oklch(26% 0.01 255)` |
| `--color-muted-foreground` | secondary/muted text | `text-muted-foreground` | `oklch(52% 0.01 255)` | `oklch(68% 0.01 255)` |
| `--color-card` | card surface | `bg-card` | `oklch(100% 0 0)` | `oklch(21% 0.01 255)` |
| `--color-card-foreground` | text inside a card | `text-card-foreground` | `oklch(21% 0.01 255)` | `oklch(96% 0.004 255)` |
| `--color-border` | border color | `border-border` | `oklch(92% 0.004 255)` | `oklch(30% 0.01 255)` |
| `--color-input` | border/background of input fields | `bg-input` · `border-input` | `oklch(92% 0.004 255)` | `oklch(30% 0.01 255)` |
| `--color-ring` | focus ring/outline color | `ring-ring` · `outline-ring` | `oklch(62% 0.02 255)` | `oklch(62% 0.02 255)` |
| `--color-primary` | primary action accent | `bg-primary` | `oklch(52% 0.12 255)` | `oklch(70% 0.12 255)` |
| `--color-primary-foreground` | text on primary | `text-primary-foreground` | `oklch(99% 0 0)` | `oklch(18% 0.01 255)` |
| `--color-accent` | soft accent/hover surface | `bg-accent` | `oklch(96% 0.004 255)` | `oklch(28% 0.01 255)` |
| `--color-accent-foreground` | text on accent | `text-accent-foreground` | `oklch(21% 0.01 255)` | `oklch(96% 0.004 255)` |
| `--color-success` | "success" status (surface) | `bg-success` | `oklch(60% 0.13 150)` | `oklch(60% 0.13 150)` * |
| `--color-success-foreground` | text on success | `text-success-foreground` | `oklch(99% 0 0)` | `oklch(99% 0 0)` * |
| `--color-warning` | "warning" status | `bg-warning` | `oklch(75% 0.13 80)` | `oklch(75% 0.13 80)` * |
| `--color-warning-foreground` | text on warning | `text-warning-foreground` | `oklch(24% 0.03 80)` | `oklch(24% 0.03 80)` * |
| `--color-danger` | "error/danger" status | `bg-danger` | `oklch(58% 0.18 27)` | `oklch(62% 0.17 27)` |
| `--color-danger-foreground` | text on danger | `text-danger-foreground` | `oklch(99% 0 0)` | `oklch(99% 0 0)` |

\* In the canonical `templates/theme.css`, the `.dark` block does not override all status tokens.
`success` and `warning` in dark mode **inherit** their values from `@theme` (there is no separate `.dark` override
for them) — add them to `.dark` under the same names if needed.

## Radii (radius)

The names are stable; the values are placeholders. The `rounded-*` utilities reference `--radius-*`.

| Variable | Role | Example utility | Value (placeholder) |
| --- | --- | --- | --- |
| `--radius-sm` | small rounding (badges, small chips) | `rounded-sm` | `0.25rem` |
| `--radius-md` | base rounding (buttons, fields) | `rounded-md` | `0.375rem` |
| `--radius-lg` | large rounding (cards) | `rounded-lg` | `0.5rem` |
| `--radius-xl` | very large (modals, large panels) | `rounded-xl` | `0.75rem` |

## Official `@theme` namespaces

The tables above are the **skill's semantic canon** (names we define ourselves). Below is the full
list of **official `@theme` namespaces** in Tailwind v4: the variable group name → what it configures
→ an example utility it powers. Any token inside a namespace automatically generates the
corresponding utilities. The values in the examples are illustrative placeholders.

| Namespace | Purpose | Example utility |
| --- | --- | --- |
| `--color-*` | colors (background, text, borders, rings, fills) | `bg-primary` · `text-foreground` · `border-border` |
| `--font-*` | font families | `font-sans` · `font-mono` |
| `--font-weight-*` | font weight | `font-medium` · `font-bold` |
| `--text-*` | font sizes (+ paired `line-height`) | `text-sm` · `text-lg` |
| `--tracking-*` | letter spacing (letter-spacing) | `tracking-tight` · `tracking-wide` |
| `--leading-*` | line height (line-height) | `leading-snug` · `leading-relaxed` |
| `--spacing` | the single base step of the spacing/sizing scale | `p-4` · `gap-2` · `w-8` (computed from it) |
| `--breakpoint-*` | breakpoints for responsive variants | `md:flex` · `lg:grid` |
| `--container-*` | named container widths + container queries | `max-w-md` · `@md:flex` |
| `--radius-*` | corner radii | `rounded-md` · `rounded-xl` |
| `--shadow-*` | outer shadows (box-shadow) | `shadow-sm` · `shadow-lg` |
| `--inset-shadow-*` | inner shadows (inset box-shadow) | `inset-shadow-sm` |
| `--drop-shadow-*` | filter shadows (filter: drop-shadow) | `drop-shadow-md` |
| `--text-shadow-*` (4.1) | text shadows (text-shadow) | `text-shadow-sm` · `text-shadow-lg` |
| `--blur-*` | blur (filter: blur / backdrop-blur) | `blur-sm` · `backdrop-blur-md` |
| `--perspective-*` | 3D transform perspective | `perspective-near` · `perspective-distant` |
| `--aspect-*` | aspect ratios | `aspect-video` · `aspect-square` |
| `--ease-*` | transition timing functions (timing function) | `ease-in-out` · `ease-out` |
| `--animate-*` | named animations (tied to `@keyframes`) | `animate-spin` · `animate-pulse` |

> **Resetting a namespace.** `--name-*: initial` wipes all default values of a specific group
> (for example, `--color-*: initial` removes the 22 built-in color ramps, leaving only your
> semantic names; `--font-*: initial` — the built-in font families). A full reset of all
> namespaces is `--*: initial` (in which case you set up spacing, radii, fonts, and the rest from scratch yourself).
> Apply it deliberately: a reset enforces discipline (project tokens only) but deprives you of convenient defaults.
> More on the forms of `@theme` (`default` / `inline` / `reference`) — in `references/tokens.md`, §4.

## How to use

- **Utility-first approach (A):** write classes directly in the markup — `bg-card text-card-foreground
  border border-border rounded-lg`.
- **BEM + `@apply` (B):** the same tokens via `@apply` in SCSS, grouped —
  `@apply bg-card text-card-foreground; @apply border border-border rounded-lg;`.
- **Translucency:** a slash modifier on the utility — `bg-primary/90`, `text-foreground/70`,
  `border-border/50`. No `bg-opacity-*`.
- **Dark mode:** the class-based variant `@custom-variant dark (&:where(.dark, .dark *));`; the same
  tokens are overridden inside `.dark { … }`. The utilities do not change — the variable values do.
- **Substituting a design system:** replace `oklch(…)` with the project's values, keeping the names. This way
  the same skeleton works with any palette without touching the markup and `@apply`.
