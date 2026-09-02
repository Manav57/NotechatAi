# Performance and bundle size (Tailwind v4)

This is a **conceptual** chapter: a mental model of how the oxide engine finds classes
(**literal scanning of sources as text**), why dynamically assembled names
(`text-${color}-500`, concatenation) "silently" disappear and how to do it right, why
`@source` is needed for non-standard paths, and why the utility-first approach yields a small bundle while
abusing `@apply` bloats it. Along the way we debunk outdated v3 myths about `purge`/JIT:
in v4 these are engine automatics. We don't duplicate reference tables — for syntax go to
`references/v4-rules.md` (rule 17) and `references/gotchas.md` (§7, §9); scanner
behavior follows the Tailwind v4 engine defaults. All token values in the examples are placeholders; the names are stable.

---

## 1. The core model: the scanner reads sources as text, not as code

In v4 CSS building is handled by **oxide** — a Rust scanner (Tailwind v4 engine
default behavior). Its job in one phrase: it **reads project files as plain text and
looks for strings that look like class names**. For each candidate it finds, the engine generates
exactly one CSS rule. Whatever isn't present in the source as a literal string isn't in the output either.

This is the cause of two things at once:

- **a small bundle** — only what actually appears in the code is generated (§4);
- **"disappearing" dynamic classes** — a name assembled by concatenation doesn't exist as a string,
  so the scanner doesn't see it (§2).

The key consequence of the model: **the scanner doesn't execute code**. It knows nothing about your variables, props,
template expressions, or ternaries. It doesn't "understand" that `` `text-${color}-500` `` *might* become
`text-red-500`. It sees the substrings `text-` and `-500` at the edges of the expression and finds no
complete class name between them. Keep exactly this in mind: **think like `grep`, not like
an interpreter.**

> Technically the scanner extracts candidates as literal substrings from the source files (see
> the official Tailwind documentation — Detecting classes in source files). But for the applied model
> the rule "a literal class substring in the file text" is enough.

---

## 2. Why dynamic names aren't found (and how to do it right)

The most common and most "silent" mistake: a class name is assembled from parts. It compiles without error,
in dev mode it sometimes even works (if such a class happens to appear somewhere else), and in prod
the style silently vanishes.

```html
<!-- NOT FOUND: the full string "text-danger-foreground" doesn't exist in the source -->
<span class="text-{{ tone }}-foreground">…</span>

<!-- assembled by concatenation / interpolation — also not found -->
<!-- `bg-${color}-500`, 'border-' + side, [`p-${n}`] -->
```

Between `text-` and `-foreground` there's a "hole" for the scanner: not a single complete literal. CSS for
`text-danger-foreground` is not generated. This behavior is identical across any stack and any
templating engine — it's not about the framework, but about the engine reading text.

### Three ways to fix it (in order of preference)

1. **Map the value → the full class name.** Don't assemble the string; pick it as a whole from
   a table. Each possible name is present in the source as a **complete literal** — the scanner sees them.

   ```html
   <!-- before: class="text-{{ tone }}-foreground" -->
   <!-- after: tone picks a FULL string from the pre-enumerated ones -->
   <!-- tone=danger  → "text-danger-foreground"
        tone=success → "text-success-foreground"
        tone=muted   → "text-muted-foreground"   -->
   <span class="text-danger-foreground">…</span>
   ```

   In markup terms this is a dictionary "value → ready-made class", where the values on the right are static
   strings. This is almost always enough.

2. **Enumerate the variants in full** somewhere in the template/markup (for example, all branches of a ternary
   written as full classes). All the scanner cares about is that each name appears literally
   at least once.

3. **The safelist `@source inline(…)`** — a last resort, when a name truly cannot be written
   literally (it comes from data/CMS, is computed at runtime). It bloats the output, so use it only
   after options (1)–(2) have fallen through (see §3 and `references/v4-rules.md`, rule 17).

> Partial class literals do **not** create them: `text-`, `bg-`, `hover:` by themselves are not
> candidates. The scanner needs the full name. A detailed "won't work / correct" breakdown —
> `references/gotchas.md` §9; in one line — `resources/gotchas-list.md`.

### Optional sidebar: if you're in a JS framework

This rule is agnostic, but in the JS stack it has a ready idiom. Type-safe component variants
(CVA / class-variance-authority) and conditional classes (`clsx`/`cn`) keep **full
class strings** right in the code — the compiler and the scanner see them literally. That is, CVA/`cn` are
not "magic for dynamics" but a way to organize that same "value → full name" map from
option (1). Never use them to *glue* names together from pieces.

---

## 3. `@source`: non-standard paths and the safelist

By default the engine walks the project tree itself, **respecting `.gitignore`** and excluding `node_modules`,
`.git`, binaries, and lock files (source autodetection — Tailwind v4 engine default behavior).
The manual `content` list from v3 is no longer needed
(see §5). `@source` is needed in two situations where autodetection "doesn't reach":

```css
/* 1. Scan a path that would otherwise be ignored (e.g. a third-party marked-up UI
      library inside node_modules). An explicit @source BYPASSES gitignore/ignore rules. */
@source "../node_modules/some-ui-lib/**/*.html";

/* exclude a path from scanning */
@source not "../legacy/**/*";

/* 2. Safelist: force-generate classes that don't exist literally in the code.
      Brace-expansion is supported. */
@source inline("bg-{primary,accent,danger}");
@source inline("{,hover:,focus-visible:}bg-primary/{80,90}");
```

The "when to use which" model:

- **a class lies outside the autodetection zone** (third-party markup, a non-standard directory) → `@source "…"`
  on the path. This is about *where to look*; the theme is not touched in the process.
- **a name is assembled dynamically and can't be written literally** → `@source inline("…")`. This is
  about *what to force*. It's a last resort: every listed class lands in the bundle
  regardless of whether it's used or not — hence it bloats the output. Always try the
  full-name mapping first (§2).

> Paths in `@source` **must be quoted**; the directive cannot have a body. Full syntax and
> Wrong→Correct→Why — `references/v4-rules.md` (rule 17); subtleties — `references/gotchas.md` §7.

---

## 4. Why the utility-first approach yields a small bundle

A utility class (Approach A) is a **shared resource**. The rule for `flex` is generated
**once** for the entire build, no matter how many thousands of elements use it. A thousand buttons with
`inline-flex items-center gap-2 px-4 rounded-md bg-primary` add not a thousand copies to the CSS, but
one rule per unique utility. The bundle size grows with the **number of unique
utilities**, not with the number of markup elements — and it quickly plateaus: new screens
reuse the same `flex`, `px-4`, `rounded-md` that already exist.

Hence the practical effect: the more a project relies on utilities, the **slower** its CSS grows.
Combined with literal scanning (§1) — only the subset of utilities actually encountered lands in the bundle,
minified by Lightning CSS (§5). This is the "small CSS that doesn't grow" of the utility-first
philosophy (`references/approaches.md`, the abstraction ladder).

### How `@apply` breaks this

`@apply` inlines utilities **into** your rule — that is, it **copies** their declarations into each
component class. Class reuse is lost: five components, each with its own
`@apply flex items-center …`, produce **five physical copies** of the same declarations instead of
one shared utility.

```scss
/* Bloats: the same declarations are copied into EVERY class */
.card   { @apply flex items-center gap-2 p-4 rounded-md; }
.panel  { @apply flex items-center gap-2 p-4 rounded-md; }
.tile   { @apply flex items-center gap-2 p-4 rounded-md; }
/* three copies of flex/items-center/gap-2/p-4/rounded-md instead of one shared utility */
```

That's why abusing `@apply` (especially as a way to "build a design system" out of dozens of
`.btn-primary` classes) is a path to **bigger** CSS than utility-first markup, not smaller.
This is one of the arguments for why components are preferable to `@apply`
(abusing `@apply` duplicates and bloats CSS).

> This is **not** a ban on Approach B. BEM+`@apply` remains an equal choice for the sake of readability and
> markup reuse (`references/approaches.md`). The point is about *abuse*: about
> "good/bad `@apply`" and about where stopping at rungs 4–6 is justified — see the same file. The bundle
> size under Approach B is a deliberate trade-off, not an oversight.

---

## 5. v3 myths about purge/JIT: in v4 it's automatic

A large layer of "best practices" from the v3/v2 era is outdated in v4 because the engine does it itself.
Many of them are "true in essence, but the implementation has changed": manual purge/JIT from v3 is no longer needed in v4 — the engine does it itself.

| v3/v2 myth | v4 reality |
| --- | --- |
| "Enable JIT / `mode:'jit'` so only the needed classes go into the bundle" | oxide works this way **by default**; there's nothing to "enable" — only what's encountered is generated (§1). |
| "Configure `content` paths, otherwise purge won't work" | **Source autodetection** respects `.gitignore`; a manual `content` is usually not needed. Non-standard cases — via `@source` (§3). |
| "Add PurgeCSS / the `purge:` key" | `purge:` is **v2** syntax, removed back in v3. No external PurgeCSS: tree-shaking is built into the engine. |
| "Don't forget to minify prod CSS in a separate step" | Minification is native **Lightning CSS** in v4; autoprefixer and `postcss-import` are built in too (see `resources/gotchas-list.md`). |

The main mindset shift: in v3 a "small bundle" was the **result of configuration** (purge + content +
JIT). In v4 it's an **engine default property** — a consequence of literal scanning. Your task
has shifted from "configure purge" to "**write classes so the scanner sees them**" (full literals,
§2) and "**hint the scanner about non-standard places**" (`@source`, §3). Brotli/critical inline CSS is
a general web optimization on top of an already small file, not a Tailwind specific
(for v4 it's often redundant — it's simpler to inline the whole file).

---

## 6. CDN vs build: where `@apply` is available and where it isn't

Tailwind v4 has two delivery modes, and they are **not interchangeable**. This matters precisely for
the skill, because Approach B actively uses `@apply` (BEM classes with inlined utilities), and the
availability of `@apply` directly depends on the mode.

**Play CDN (`@tailwindcss/browser@4`)** — compiling Tailwind **in the browser** via a single `<script>`.
This is a **dev/prototype-only** mode: quickly open a page, play with classes, show a
demo without a toolchain. Limitations compared to a build:

- **`@apply` is unavailable** (as are other CSS-build-level directives). Any of your CSS with `@apply`
  on the CDN **silently does nothing** — and that's **all of Approach B**. Only Approach A
  (utilities in markup) lives on the CDN.
- **Plugins via `@plugin` are limited** — first-party `@tailwindcss/typography`,
  `@tailwindcss/forms` can't be hooked up properly via the CDN.
- Compilation runs on every page open at runtime — this is **slower** and not for prod.

```html
<!-- DEV/prototype ONLY. Don't drag into prod. @apply and @plugin do NOT work here. -->
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
```

**Build (prod)** — Tailwind is compiled ahead of time, before it's served to the user, by one of
the first-party tools:

- `@tailwindcss/cli` — a standalone CLI build (no bundler);
- `@tailwindcss/vite` — a plugin for Vite;
- `@tailwindcss/postcss` — a plugin for the PostCSS pipeline.

Only in build mode are `@apply`, `@plugin`, a full entry CSS, and minification
(Lightning CSS, §5) available. **Approach B is possible exclusively with a build.**

> **Caveat for Approach B with a preprocessor.** `@tailwindcss/vite` is often called *the* path for
> bundlers, but it only transforms modules whose id ends in `.css` (or `&lang.css`). When `@apply` lives
> in a component-style block written in a preprocessor language (`<style lang="scss">`, id `&lang.scss`),
> the Vite plugin **silently skips it** — the raw `@apply`/`@reference` ship to the browser with **no
> error** and the component renders unstyled. To keep `<style lang="scss">` (so `&-`/`&_` BEM nesting
> works), use `@tailwindcss/postcss`, which runs *after* the Sass preprocessor on every CSS module. Plain
> `.css` scoped styles are fine with either. Full plugin decision — `references/build-integration.md`.

> The main warning: **don't drag Play CDN into prod and don't expect `@apply` there.** If the project
> has BEM classes with `@apply` (Approach B) or hooked-up `@plugin` — the CDN mode will "lose" them
> without an error. A prototype on the CDN is fine; production is build-only.

### Relation to bundle size

The delivery mode and bundle size are about the same thing in essence (§4). A build reuses utilities
and keeps the CSS small; on the CDN there's no "bundle" size as such (compilation at runtime), but
there are no prod optimizations either. And in any mode remember: **reuse of utilities keeps CSS
small, while abusing `@apply` duplicates declarations and bloats CSS** (§4). That is, the choice
"CDN vs build" decides *whether* `@apply` is available at all, and §4 decides *how not to abuse it* when
it is available.

---

## 7. Practical rules (checklist)

- **Think like `grep`.** The source must contain the **full class name** as a literal string. If
  a name can't be "selected with the mouse" as a whole in the code — the scanner won't find it.
- **No concatenation/interpolation of names.** `` `text-${c}-500` ``, `'bg-' + name`, `p-${n}` are
  forbidden. Map value → full class name (§2).
- **Handle dynamics via mapping, not via the safelist.** `@source inline(…)` is a last resort for
  names from data/CMS/runtime; it bloats the output (§3).
- **Non-standard paths — `@source "…"`** (quoted); exclusions — `@source not "…"`. An explicit
  `@source` bypasses `.gitignore` — that's how you scan third-party UI libraries in `node_modules` (§3).
- **Utilities are reused — that's exactly the small bundle.** Size grows with the number of *unique*
  utilities, not elements (§4).
- **`@apply` copies declarations.** Each `@apply` duplicates utilities into the rule; Approach B is
  a deliberate trade-off, not "free". Don't build a design system out of dozens of `@apply` classes (§4,
  `references/approaches.md`).
- **Don't "enable JIT" and don't configure purge/`content`.** In v4 tree-shaking and minification
  (Lightning CSS) are default (§5).
- **Play CDN — dev/prototype only.** On the CDN there's **no `@apply`** (so no Approach B) and
  `@plugin` is limited. Prod — a build (`@tailwindcss/cli` / `-vite` / `-postcss`). Don't drag the CDN
  into prod and don't expect `@apply` there (§6).
- **CVA/`cn` (if you're in JS) keep full strings**, they don't glue them together — this is a mapping variant from
  §2, not a way to bypass the scanner's literalness.

---

## See also

- `@source` / `@source inline(…)` syntax (Wrong→Correct→Why) — `references/v4-rules.md`, rule 17.
- Scanner and dynamic-name gotchas ("won't work / correct") — `references/gotchas.md` §7, §9.
- Gotchas in one line — `resources/gotchas-list.md` (the "Class detection" section).
- The abstraction ladder and "good/bad `@apply`" — `references/approaches.md`.
- Where `@source`/`@plugin` live in the entry CSS — `docs/css-first-config.md` §6.
- Installation, the build entry point (entry CSS), and the toolchain — `docs/getting-started.md`.
- Which build plugin to wire up (and the `@tailwindcss/vite` vs preprocessor pitfall) — `references/build-integration.md`.
- Why `@apply` (Approach B) is unavailable on Play CDN and works only with a build — §6.
- Scanner behavior (oxide, autodetection, pre-processors) — Tailwind v4 engine default behavior.
- In v4 manual purge/JIT from v3 is no longer needed — the engine does it itself; abusing `@apply` duplicates and bloats CSS.
