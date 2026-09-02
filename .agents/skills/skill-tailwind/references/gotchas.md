# Tailwind v4 — subtle gotchas

A reference for what most often breaks "silently" in Tailwind v4: it compiles without an error,
but behaves differently than you expect (especially if you still think in v3). The format is scannable
items with mini "before / after" or "won't work / correct" examples. This is the implementation layer: where appropriate,
token names are canonical semantic ones (`bg-primary`, `border-border`, etc.), and values are
design-system placeholders.

---

## 1. Variant stack applies left-to-right (inverted from v3)

In v4 the variant chain reads **left to right** — the reverse of v3. For most simple
combinations the result is the same, but order matters when variants nest inside one another
(`group-*`, `peer-*`, `*`, `**`, pseudo-elements).

```html
<!-- v3 thinking: "first ::before, then hover" -->
<!-- v4: reads LEFT TO RIGHT -->
<div class="before:hover:content-['x']">…</div>   <!-- v4: ::before, then :hover -->
<div class="hover:before:content-['x']">…</div>   <!-- v4: :hover, then ::before -->
```

Practical rule: write variants in the order they should "wrap" —
the left one applies first, the right one is inside it. If an effect "got lost" after migrating from v3,
the first thing to do is reverse the order in the stack.

---

## 2. `@theme` variables must be top-level

The body of `@theme` may contain **only** custom property declarations (`--color-*`, `--radius-*`, …)
and `@keyframes`. No nested selectors, `@media`, or `:root` inside — otherwise it's a compile error.
You cannot "switch" the theme inside `@theme`.

```css
/* WON'T WORK: nested selector/media inside @theme */
@theme {
  --color-background: oklch(99% 0 0);
  .dark { --color-background: oklch(18% 0.01 255); } /* error */
  @media (min-width: 48rem) { --radius-lg: 1rem; }    /* error */
}

/* CORRECT: tokens are top-level in @theme; themes/overrides use plain selectors OUTSIDE */
@theme {
  --color-background: oklch(99% 0 0);
  --radius-lg: 0.5rem;
}
.dark {                 /* dark override of the same names — outside @theme */
  --color-background: oklch(18% 0.01 255);
}
```

Adjacent fork: `@theme` is for tokens that should **generate utilities/variants**
(`--color-primary` → `bg-primary`, `text-primary`, …). If a variable is needed as "just a CSS var"
and should NOT spawn classes — put it in `:root`, not in `@theme`.

---

## 3. CSS variable in an arbitrary value: `bg-(--var)`, not `bg-[--var]`

To substitute a CSS variable into a utility, use the **paren** syntax
`utility-(--var)`. The old v3 form with square brackets `[--var]` is not read as a reference
to a variable in v4.

```html
<!-- WON'T WORK in v4 -->
<div class="bg-[--brand] text-[--ink]">…</div>

<!-- CORRECT -->
<div class="bg-(--brand) text-(--ink)">…</div>

<!-- with a value type hint, when ambiguous -->
<p class="text-(length:--step) leading-(--lh)">…</p>
```

Square brackets remain for **literal** arbitrary values (`top-[117px]`,
`grid-cols-[1fr_2fr]`, `[mask-type:luminance]`) — but not for variable references.

---

## 4. Resetting transforms: `scale-none` / `rotate-none` / `translate-none`

In v4 transforms are composed from separate pieces. To cancel a specific transform
(for example, on a state), use the named per-axis resets, not the blanket `transform-none`,
which removes the entire composition at once.

```html
<!-- want: lifted by default, no shift on active -->
<button class="-translate-y-0.5 active:translate-none …">…</button>

<!-- resetting individual transforms -->
<div class="rotate-3 hover:rotate-none">…</div>
<div class="scale-105 active:scale-none">…</div>
```

`transform-none` still exists and disables transforms entirely — but if you only need to remove
the rotation/scale/translation, the targeted `*-none` utilities are more predictable and don't wipe out neighboring axes.

---

## 5. Default border and ring color is `currentColor`

Preflight v4 sets `border: 0 solid`, and the default border and `ring` color is now **`currentColor`**,
not `gray-200`/`blue-500` as in v3. Two consequences:

- `border` without a width set draws nothing (`border-width` = 0).
- The border/ring take the element's text color until you set the color explicitly.

```html
<!-- the v3 expectation of a "gray border" no longer works -->
<div class="border">…</div>                 <!-- width 0 → nothing; and color = currentColor -->

<!-- CORRECT: set the width AND the color from a token -->
<div class="border border-border">…</div>
<input class="ring-1 ring-ring" />          <!-- the default ring-width in v4 is 1px -->
```

Skill canon: always specify `border-border` (or another semantic token) explicitly. In the base
layer you can wire this once:

```css
@layer base {
  * { @apply border-border; }   /* a single default border color for the project */
}
```

---

## 6. `@apply` in a component/SFC `<style>` (scoped or not) / CSS module requires `@reference` (and the right build plugin)

`@apply`, `@variant`, and references to theme tokens only work where the compiler "sees" your
theme. Each component/single-file-component `<style>` and each CSS module is its **own compilation
unit** — compiled in isolation, with no automatic access to your theme. Without `@reference` you get
an "unknown class" error.

**It is the separate compilation unit that matters — not the word `scoped`.** A component `<style>`
needs `@reference` whether it is `scoped` or a **non-scoped global** block; both are still separate
units. Only the file that literally contains `@import "tailwindcss"` — your entry CSS — already has
the theme and skips `@reference`. A non-scoped global component `<style>` is **not** the entry CSS,
so the tempting reasoning "it's global, therefore it behaves like the entry CSS, therefore no
`@reference`" is wrong (you get an unknown-class build error or an unstyled component).

```css
/* In a separate component stylesheet / CSS module */
@reference "../app.css";   /* the ENTRY CSS where @import "tailwindcss" AND your @theme tokens live */

.card-title {
  @apply text-card-foreground;  /* now the tokens are available, CSS variables aren't duplicated */
}
```

**Point `@reference` at your entry CSS, not at `"tailwindcss"`.** It must resolve to the file that
defines your `@theme` tokens (the one with `@import "tailwindcss"` plus your customizations).
`@reference "tailwindcss"` loads only the **default** theme — it silently drops your custom tokens, so
`@apply bg-card` / `border-border` / `bg-primary` over a project token will fail or fall back. Use the
bare `@reference "tailwindcss"` form **only** when the block touches no custom tokens.

**The path is relative to the source file, so its depth changes with nesting.** A component two
folders deep needs `@reference "../../styles/app.css"`; one folder deep needs `@reference
"../styles/app.css"`; and a **top-level shell file that sits beside the entry CSS** uses a `./`
prefix — `@reference "./styles/app.css"` — not `../`. The number of `../` is not a constant; count
from each file. To stop these prefixes from drifting as files move, **prefer a build alias**
(e.g. `@reference "@/styles/app.css"`) configured in your bundler — one stable target everywhere
instead of brittle relative chains. (A JS-import alias like `~/` or `@/` resolves in `import`
statements but not always inside a preprocessor string such as an SCSS `@reference`; confirm your
bundler rewrites it there, otherwise the relative path is unavoidable.)

**Which plugin actually expands `@apply` in those blocks.** `@reference` only tells the compiler where
the theme is; something still has to *run* Tailwind over the style block. The toolchain choice matters
when component/SFC styles (scoped or not) are written in a **preprocessor** language (e.g. `sass`):

- `@tailwindcss/postcss` runs **after** the preprocessor on every CSS module — including preprocessed
  component styles — so `@apply` expands. This is the recommended path for component-framework files
  that use a preprocessor in their `<style>` blocks.
- `@tailwindcss/vite` only transforms modules whose id ends in `.css` (or `&lang.css`); a preprocessed
  component style (id containing `&lang.scss`) is **skipped silently** — `@apply` / `@reference` ship
  to the browser **raw and unexpanded, with no build error**, and the component renders unstyled. Plain
  `.css` component styles are fine with it.

> The component-framework angle here is just an aside — the same rule holds for any standalone CSS
> module or `<style>` block. See `references/build-integration.md` for the full plugin decision (which
> plugin to wire up, the preprocessor pitfall, and verifying the *compiled* CSS contains no raw
> `@apply`).

Nuances:
- `@reference` connects the theme **by reference** — it doesn't re-inline the styles themselves, it only gives
  access to tokens/utilities for `@apply`.
- Only the entry CSS — the file that literally contains `@import "tailwindcss"` — skips `@reference`.
  Every other unit (a component `<style>`, scoped or non-scoped global, and every CSS module) needs it.
- `@apply` is forbidden inside `@keyframes`; you can't mix CSS mixins and utilities in a single `@apply`.

---

## 7. Safelist and non-standard sources: `@source` / `@source inline(...)`

The scanner walks the project automatically, **respecting `.gitignore`** and excluding `node_modules`, `.git`,
binaries, lock files. When classes live outside this zone or are assembled dynamically — you need an
explicit `@source`.

```css
/* Scan a directory that would otherwise be ignored (e.g. third-party markup) */
@source "../vendor/ui-kit/**/*.html";

/* Exclude a path from scanning */
@source not "../legacy/**/*";

/* Safelist: force-generate classes that don't exist literally in the code.
   Brace expansion is supported. */
@source inline("bg-{primary,accent,danger}");
@source inline("{,hover:,focus:}bg-primary/{80,90}");
```

When to use `@source inline(...)`: only if the class truly cannot be written literally
(comes from data/CMS, assembled at runtime). It's a last resort — it bloats the output;
first try rewriting to full class names (see §9).

---

## 8. `hover:` only fires on devices with real hover

In v4 the `hover:` variant is wrapped in `@media (hover: hover)` — meaning on touch devices (which have no
hovering pointer) hover styles **are not applied**. This removes "stuck hover" on mobile,
but breaks patterns where hover carried the only visual state.

```html
<!-- On a touch screen there will be NO hover style — provide a state for focus/active too -->
<button class="bg-primary hover:bg-primary/90 focus-visible:bg-primary/90 active:bg-primary/80">
  …
</button>
```

Skill rule: interactive components must carry a **full set of states**
(`hover` / `focus-visible` / `active` / `disabled`), not just `hover`. Accessible `focus-visible` is
mandatory. If you need to bring hover back for all devices — override the variant via
`@custom-variant`.

---

## 9. Class detection is literal: dynamic names aren't found

The scanner looks for class **substrings** as plain text; it doesn't execute code. A name assembled
by concatenation or interpolation never forms a full literal → no CSS is
generated for it (the class "silently" doesn't work).

```html
<!-- WON'T BE FOUND: there's no full "text-danger" literal in the source -->
<span class="text-{{ tone }}-foreground">…</span>
<!-- assembled as `bg-${color}-500` / 'border-' + side — also won't be found -->

<!-- CORRECT: map the value → FULL class name -->
<!-- tone=danger  → "text-danger-foreground"
     tone=success → "text-success-foreground"  (full strings, statically visible) -->
<span class="text-danger-foreground">…</span>
```

Cured three ways (in order of preference): (1) store full class names in a value map;
(2) list the variants in full somewhere in the markup/template; (3) as a last resort —
the `@source inline(...)` safelist (§7). Partial literals (`hover:`, `text-`) don't create classes
on their own.

---

## 10. Modern browser baseline (not polyfilled)

v4 requires modern browsers and relies on native CSS features (cascade layers, `@property`,
`color-mix()`, `oklch()`, container queries). Minimum: **Safari 16.4+, Chrome 111+,
Firefox 128+**. v4 isn't meant for older browsers — it's a deliberate engine choice, not a bug.

Related "new" mechanisms this affects:
- Container queries: a parent `@container`, children `@sm:` / `@md:` (not just viewport `sm:`).
- Enter animations via `@starting-style` → the `starting:` variant (e.g. for the native `<dialog>`).
- Opacity — the slash modifier (`bg-primary/90`), implemented via `color-mix()`.

```html
<dialog class="opacity-0 starting:open:opacity-0 open:opacity-100 transition-opacity">…</dialog>
```

If legacy-browser support is critical — that's a project-level constraint, not something
fixed by a Tailwind setting.

---

## Cheat-sheet checklist (quick self-check)

- [ ] Variant stack is in left-to-right order (double-check `group-*`/`before:`/`after:`).
- [ ] In `@theme`, only `--variables` and `@keyframes`; themes/media go outside.
- [ ] CSS variables in values via `bg-(--var)`, not `bg-[--var]`.
- [ ] Targeted transform reset: `scale-none` / `rotate-none` / `translate-none`.
- [ ] `border` without `border-<color>` takes `currentColor`; set `border-border` explicitly.
- [ ] In any component `<style>` (scoped OR non-scoped global) / CSS module — its own compilation unit — `@reference "<entry CSS>"` (not `"tailwindcss"`) comes before `@apply`; only the entry CSS with `@import "tailwindcss"` skips it; preprocessor component styles need `@tailwindcss/postcss`.
- [ ] Non-standard sources — `@source`; safelist — `@source inline(...)` only as a last resort.
- [ ] `hover:` doesn't work on touch — there's `focus-visible` / `active` / `disabled`.
- [ ] No dynamically assembled class names — only full literals.
- [ ] The Safari 16.4+ / Chrome 111+ / Firefox 128+ baseline is accounted for.
