# Wiring Tailwind v4 into a build

A reference for **how Tailwind v4 actually runs over your CSS** — which integration to choose, and the
one pitfall that breaks Approach B (BEM + `@apply` in a preprocessor) **silently, with no build error**.
This layer is agnostic: everything below is about CSS and the toolchain, not about any JS framework.
JS frameworks appear only as a brief aside, because the pitfall happens to bite hardest in
component/single-file-component setups.

> The headline rule, stated once: **for any setup where component styles are compiled as separate
> modules through a preprocessor (e.g. `sass`), use `@tailwindcss/postcss`** — not `@tailwindcss/vite`.
> PostCSS runs *after* the preprocessor on every CSS module, so `@apply` / `@reference` actually expand.
> The Vite plugin skips preprocessor modules and ships them raw. The full reasoning is in §2.

---

## 1. Choosing an integration

Tailwind v4 ships several ways to run the engine. They are not interchangeable once a **preprocessor**
enters component styles — pick by how your CSS is authored and compiled.

| Setup | Use | Why |
| --- | --- | --- |
| One plain entry CSS (`@import "tailwindcss"` + `@theme`), no preprocessor, no per-component CSS modules | the **Tailwind CLI** (`npx @tailwindcss/cli -i app.css -o out.css`) or **Lightning CSS** | Simplest. One file in, one file out. No bundler needed. |
| A bundler, all CSS authored as **plain `.css`** (entry CSS + plain `.css` component/scoped styles) | **`@tailwindcss/vite`** | The fast first-party bundler plugin. It transforms `.css` (and `&lang.css`) ids, which is exactly what plain CSS produces. |
| A bundler where **component styles are compiled through a preprocessor** (e.g. `<style lang="scss">`, `*.module.scss`, any `sass`/SCSS partial that gets emitted as its own CSS module) and contain `@apply` / `@reference` | **`@tailwindcss/postcss`** | PostCSS runs *after* the preprocessor on **every** CSS module, so `@apply` expands in preprocessed scoped styles too. `@tailwindcss/vite` would skip them (see §2). |
| Any bundler that already uses PostCSS, or where you want one plugin to cover both the entry CSS and preprocessed modules | **`@tailwindcss/postcss`** | The safe default when a preprocessor is anywhere in the component-style pipeline. v4 has `postcss-import` + `autoprefixer` built in — do not add them separately. |

Decision in one line: **plain CSS everywhere → CLI / Lightning CSS / `@tailwindcss/vite`. A preprocessor
in component styles → `@tailwindcss/postcss`.**

> Approach A (utility-first) writes everything in markup, so its only CSS is usually the plain entry file —
> any integration works. Approach B (BEM + `@apply`) puts `@apply` into component/scoped CSS, which is
> exactly where the preprocessor pitfall lives. **If you ship Approach B through a preprocessor, the
> integration is not a free choice — it must be `@tailwindcss/postcss`.**

---

## 2. The pitfall: `@tailwindcss/vite` silently skips preprocessor styles

This is the single most expensive build mistake in Approach B, because it produces **no error**.

**Verifiable behavior.** `@tailwindcss/vite` only transforms modules whose id **ends in `.css`** or
**contains `&lang.css`** (plus inline `<style>` ids). That filter is in the plugin's transform stage —
it is the published, observable behavior of the plugin, not a guess.

**What that means for preprocessor styles.** When a component's scoped style is written in a preprocessor
language, the bundler tags its module id with the *language*, not `.css`. A `<style lang="scss">` block (or
a `*.module.scss`, or any SCSS partial emitted as its own module) produces an id containing **`&lang.scss`**
— which does **not** match `\.css$` and does **not** contain `&lang.css`. So `@tailwindcss/vite`
**skips the module entirely**.

The preprocessor still runs (sass compiles the nesting, strips comments, concatenates `&-`/`&_`
selectors), but **Tailwind never sees the result**. The `@apply` directives and the `@reference` line
ship to the browser **raw and unexpanded** — `.button { @apply inline-flex … }` and
`@reference "../app.css";` land literally in the output CSS. Browsers ignore the unknown `@apply` /
`@reference` at-rules, so the component renders **unstyled**, and:

- the build **exits 0** — no error, no warning;
- dev mode can *look* fine if the same utilities happen to be generated elsewhere;
- "the build passed" is **not** proof it worked.

**The fix.** Use `@tailwindcss/postcss`. PostCSS runs after the preprocessor on every CSS module —
including preprocessed scoped/component styles — so by the time Tailwind runs, the module is plain CSS
and `@apply` expands normally. After the swap there should be **0 raw `@apply` and 0 literal
`@reference`** anywhere in the compiled output.

**Plain `.css` scoped styles are fine.** A scoped style written in plain CSS (id contains `&lang.css`,
not `&lang.scss`) **is** transformed by `@tailwindcss/vite`. The pitfall is specific to a *preprocessor*
lang — it is not "the Vite plugin can't do scoped styles", it is "the Vite plugin doesn't pick up the
*preprocessor* module."

> **Aside (JS frameworks).** This bites component/single-file-component setups hardest, because their
> `<style lang="scss">` blocks are precisely the preprocessor modules the Vite plugin skips — and this holds
> whether the block is `scoped` or a **non-scoped global** style (Approach B often drops `scoped` because
> globally-unique BEM names make it unnecessary). `scoped` changes selector isolation, not which plugin must
> run. The rule is framework-agnostic: it is about *any* CSS module compiled through a preprocessor, not about
> the framework or the `scoped` keyword. The same `@apply`-must-expand requirement holds for a standalone
> `*.module.scss` or any SCSS partial that becomes its own emitted module.

---

## 3. Verify the *compiled* CSS, not the exit code

Because the failure is silent, **the only reliable check is to scan the built CSS** — never trust
"build passed."

- Grep the production output for `@apply` and `@reference`. A correctly-built Approach-B project has
  **zero** of either anywhere in the build — they are author-time directives that must be gone after
  compilation.
- **Use a glob-safe scan that walks the whole output tree.** A shell wildcard like `*.css` can silently
  expand to nothing (depending on shell/expansion, and especially with no top-level `.css` files), so the
  check reports "clean" while never actually scanning anything. Drive the file list with `find` instead, and
  cover **all** emitted chunks — not just the public CSS bundle, but server-rendered style chunks and JS
  chunks that may inline CSS:

  ```sh
  # zero matches in author code = correctly compiled
  find <output-dir> -name "*.css" -print0 | xargs -0 grep -nE "@apply|@reference"

  # also sweep JS/server chunks for inlined raw directives (expect zero)
  find <output-dir> -type f \( -name "*.css" -o -name "*.js" -o -name "*.mjs" \) -print0 \
    | xargs -0 grep -nE "@apply|@reference"
  ```

  Both commands should print **nothing** for your own code. (A framework's own built-in error pages may
  contain unrelated tokens; what matters is zero raw `@apply` / `@reference` in *your* compiled styles.)
- If you find a raw `@apply` / `@reference` in the output, your integration is not running Tailwind over
  that module (almost always: `@tailwindcss/vite` + a preprocessor component style → switch to
  `@tailwindcss/postcss`).
- A quick smoke test: open the rendered component. If a BEM-classed element is completely unstyled while
  utility-classed markup elsewhere works, suspect a skipped preprocessor module.

---

## 4. The per-compilation-unit `@reference` rule

A separate concern from *which plugin runs* is *where each compilation unit finds your theme*. Any CSS
that is compiled as **its own module** (a component/SFC `<style>` — **scoped or not** — a CSS module, an
imported SCSS partial) does **not** automatically see your `@theme` tokens. It needs a `@reference` line at
the top.

**`scoped` is irrelevant here — the criterion is "separate compilation unit", not "scoped".** Scoping is
about *selector isolation* (a framework rewrites selectors with a per-component attribute); it has nothing
to do with whether Tailwind has loaded your theme into that module. A **non-scoped global** component style
block (e.g. `<style lang="scss">` with no `scoped` keyword, common in Approach B where globally-unique BEM
block names make scoping unnecessary) is **still its own compilation unit** and still needs `@reference`.
Reasoning "my `<style>` is global, therefore it behaves like the entry CSS, therefore no `@reference`
needed" is **wrong** — it produces an unknown-class build error or an unstyled component. The decisive line:
**non-scoped global ≠ entry CSS — only the file that literally contains `@import "tailwindcss"` skips
`@reference`.** Every other unit (scoped `<style>`, non-scoped global `<style>`, CSS module, SCSS partial)
needs one.

Three rules, all enforced per compilation unit:

1. **Point `@reference` at your entry CSS — the file that defines your `@theme` tokens** — not at
   `"tailwindcss"`. The entry CSS is the one with `@import "tailwindcss"` plus your customizations.

   ```scss
   @reference "../styles/app.css";   /* ENTRY CSS with @import "tailwindcss" + your @theme tokens */

   .card { @apply rounded-lg bg-card text-card-foreground; }
   ```

   `@reference "tailwindcss"` loads only the **default** theme and **silently drops your custom tokens** —
   so `@apply bg-card` / `border-border` / `bg-primary` over a project token will fail or fall back. Use
   the bare `@reference "tailwindcss"` form **only** when the block touches no custom tokens.

2. **The path is depth-relative — it changes with the file's nesting.** `@reference` is resolved relative
   to the **source file** it sits in, so its `../` prefix depends on how deep that file lives:

   ```scss
   /* file at the source root      */  @reference "./styles/app.css";
   /* component one folder deep     */  @reference "../styles/app.css";
   /* component two folders deep    */  @reference "../../styles/app.css";
   ```

   A framework **shell file at the source root** (e.g. an app root component living *beside* the styles
   folder, not inside `components/`) therefore uses the `./` form (`@reference "./<entry>.css"`), while the
   nested components below it use `../…` — same entry file, different prefix purely because of depth.

   **Watch the root vs nested case.** A top-level shell file that sits *at* the source root (the same level
   as the styles folder, not inside a `components/` subfolder) uses `./`, **not** `../` — a common slip
   when most components are one level down and the `../` form looks "normal". Move the file and the prefix
   must change with it. (Framework path aliases like `~/` or `@/` used in *JS imports* generally do **not**
   resolve inside an `@reference` string — it is a CSS-author-time path — so a bundler-level CSS alias, see
   rule 3, is the only way to escape depth-relative paths.)

3. **Prefer a build alias to stop the `../` chains from drifting.** Configure a bundler alias (e.g. `@` or
   `~` → your source root) and reference one stable target everywhere:

   ```scss
   @reference "@/styles/app.css";   /* same line in every component, regardless of depth */
   ```

   One stable target beats brittle `../` chains that break every time a file moves.

> The entry CSS itself (which already has `@import "tailwindcss"`) needs **no** `@reference` — only
> separate compilation units do. `@reference` connects the theme *by reference*: it exposes tokens and
> utilities for `@apply` without re-inlining the styles. (For the surrounding `@apply` rules — forbidden
> inside `@keyframes`, grouped by property order — see `references/gotchas.md` §6 and
> `references/approaches.md` §3.)

---

## 5. Name the actually-configured plugin in your setup docs

A recurring documentation defect: a project's README / setup docs name one plugin while the config wires
another (commonly: docs say `@tailwindcss/vite`, the config actually uses `@tailwindcss/postcss`). This is
worse than a cosmetic mismatch — it teaches the next author the **wrong** integration, and if they "fix"
the config to match the docs they re-introduce the §2 pitfall.

Rule: **your setup docs must name the integration your build is actually configured with.** When you state
the build, state which plugin runs (`@tailwindcss/postcss` vs `@tailwindcss/vite` vs the CLI / Lightning
CSS), and — if you use a preprocessor in component styles — *why* it is `@tailwindcss/postcss` (so the
choice is not "fixed" away later). One source of truth: the config is canonical; the docs describe it.

---

## Quick checklist

- [ ] Plain CSS everywhere? CLI / Lightning CSS / `@tailwindcss/vite` are all fine.
- [ ] A preprocessor (`sass`/SCSS) in component styles (scoped **or** non-scoped global) with `@apply`? →
  **`@tailwindcss/postcss`**.
- [ ] Whole output tree scanned with a **glob-safe** `find … | xargs … grep` (CSS **and** JS/server chunks):
  **0 raw `@apply`, 0 literal `@reference`** in your code (not just "build passed").
- [ ] Every separate compilation unit — component `<style>` (scoped or not), CSS module, SCSS partial —
  starts with `@reference "<entry CSS with your @theme>"`; only the file with `@import "tailwindcss"` skips it.
- [ ] `@reference` path is correct for the file's depth (`./` for a shell file *at* the source root,
  `../`/`../../` for nested components), or routed through a build alias.
- [ ] Setup docs name the plugin the build is **actually** configured with.
