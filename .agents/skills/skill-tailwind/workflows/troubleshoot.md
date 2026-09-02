# Workflow — diagnosing "it compiled, but it doesn't work"

> Purpose: an agent-executable playbook for the case where a Tailwind v4 build **succeeded without
> error**, but the result isn't what you expect — a class doesn't apply color, the theme doesn't
> switch, a custom token produces no utility, the variant stack is "backwards," a border is invisible.
> These are the most expensive bugs: the compiler stays silent while the look/behavior quietly "drift"
> (especially with v3 inertia still in your head).
>
> Format — a diagnostic table **Symptom → Likely cause → Check → Fix**. Rule tables are **not
> duplicated** here: each row points to the source of truth. Subtle "silent" breakages —
> `references/gotchas.md`; Wrong→Correct→Why triples — `references/v4-rules.md`; dark mode
> mechanics — `docs/dark-mode.md`; scanner/bundle and delivery modes — `docs/performance-and-bundle.md`.
>
> Token names are canonical and stable (`bg-primary`/`text-primary-foreground`, `bg-card`/
> `text-card-foreground`, `border-border`, `ring-ring`/`outline-ring`, `rounded-sm/md/lg/xl`);
> values are design-system placeholders.

---

## How to use

1. Find the row by **symptom** (left column) — the phrasings are deliberately "as the eye sees it."
2. Verify the **likely cause** with the **Check** column — it's a concrete action (grep, open
   DevTools, look at the entry CSS), not a guess.
3. Apply the **fix** and cross-check against the source at the end of the row (§ of a file).
4. If a symptom matches several rows — go top to bottom: rows are ordered from the most frequent
   and "silent" to the rarer ones.

> Diagnostic meta-rule: the v4 compiler **stays silent** about most of these errors because they
> are syntactically valid. So we don't check "is there a build error," but **does the engine see what
> we meant** — like `grep`, not like an interpreter (`docs/performance-and-bundle.md` §1).

---

## 1. The class is in the markup, but there's no style (no CSS was generated for it)

| Symptom | Likely cause | Check | Fix |
| --- | --- | --- | --- |
| The class is in `class=`, but in DevTools the element has **no matching rule** (not "overridden," but absent entirely) | The class name is built dynamically (concatenation/interpolation) — there's no full literal in the source, so the scanner didn't extract it | Grep the project for the **full** class string (`text-danger-foreground`, not `text-`); if it isn't found whole — it's assembled from pieces (`` `text-${tone}-foreground` ``, `'bg-' + name`) | Replace name assembly with a **value → full class name mapping** (whole literals in the source). The safelist `@source inline("…")` is only a last resort for names from data/CMS/runtime. See `references/gotchas.md` §9, `references/v4-rules.md` §17, `docs/performance-and-bundle.md` §2 |
| The style works in dev but **disappeared in prod** | Same dynamic name: in dev it accidentally matched a literal from elsewhere, in prod it didn't | Build the prod bundle and grep the output CSS for the rule; if the rule is missing — the name isn't literal | Same fix — full literals; see `docs/performance-and-bundle.md` §2 |
| Classes from **third-party markup / a non-standard directory** aren't found (a UI kit in `node_modules`, vendor templates) | The path is outside the auto-detect zone — the scanner respects `.gitignore` and skips `node_modules`, binaries, lock files | Check whether the markup lies outside the source tree or under `.gitignore`; there's no `@source` for this path in the entry CSS | Add `@source "../node_modules/ui-lib/**/*.html";` (quoted; an explicit `@source` **bypasses** ignore rules). The exception is `@source not "…"`. See `references/gotchas.md` §7, `references/v4-rules.md` §17, `docs/performance-and-bundle.md` §3 |
| A partial literal (`text-`, `hover:`, `bg-`) "ought to" produce something, but doesn't | Partial literals are **not** candidates — the engine needs the full class name | Make sure the **whole** name appears in the code, not just a prefix | Write full names; see `docs/performance-and-bundle.md` §2 |

---

## 2. Dark mode doesn't switch (or switches halfway)

| Symptom | Likely cause | Check | Fix |
| --- | --- | --- | --- |
| The `.dark` class is on `<html>`, but colors don't change | No class-based variant is declared: without `@custom-variant dark (...)`, the `dark` variant is tied to `prefers-color-scheme`, not to a class | Grep the entry CSS for `@custom-variant dark` | Add `@custom-variant dark (&:where(.dark, .dark *));` to the entry CSS. See `docs/dark-mode.md` §2 (step 1) |
| The variant is declared, `.dark:*` works in markup, but the **overall background/text doesn't darken** | The **semantic token values** aren't overridden in `.dark` — only the variant was declared (step 1 without step 2) | Grep for a `.dark { --color-… }` block; check that it has the same set of names as in `@theme`/`:root` | Override the same names (`--color-background`, `--color-foreground`, …) with dark values inside `.dark { … }`. See `docs/dark-mode.md` §2 (step 2), §3 |
| Some nodes don't darken even though `.dark` is set | Those nodes use **literals** (`bg-white`, `#fff`, `bg-[oklch(…)]`) or `dark:` classes instead of tokens; the theme can't reach them | Grep the nodes for literal colors and for `dark:bg-*`/`dark:text-*` | Switch them to semantic tokens (`bg-card`, `text-card-foreground`, `border-border`) — then the theme switches them "for free." See `docs/dark-mode.md` §1, §4 |
| A dark override value "carries no weight" / a regular class overrides it | The override was placed inside `@theme` (it lands in `:root`, globally) or the specificity is broken | Check: dark values are in `.dark { … }` **outside** `@theme`, not nested inside `@theme` | Move `.dark` overrides out of `@theme` (nested selectors are forbidden there). See `references/gotchas.md` §2, `docs/dark-mode.md` §2 |
| The page flashes the light theme before the dark one applies (FOUC) | The theme-init script isn't in `<head>` synchronously before the content | Check that the `.dark` toggle is set in `<head>` **before** `<body>` | Move the anti-FOUC init into `<head>` as a synchronous `<script>`. See `docs/dark-mode.md` §6 |
| Tokens went dark, but the **scrollbar/native controls stayed light** | `color-scheme` isn't declared — tokens color your CSS, but not the browser's native layer | Grep for `color-scheme` / `scheme-dark` in `.dark`/`:root` | Add `color-scheme: dark;` to the `.dark` block (or the `scheme-dark` utility on `<html>`). See `docs/dark-mode.md` §7 |

---

## 3. A custom token produces no utility (`bg-brand` etc. doesn't exist)

| Symptom | Likely cause | Check | Fix |
| --- | --- | --- | --- |
| You declared a variable, but the utility (`bg-brand`, `text-step`) isn't generated | The variable isn't in `@theme` (or is nested under a selector/`@media`) — only a top-level `@theme` produces utilities | Open the entry CSS: is the variable **inside** `@theme` and at the top level of its body (not in `:root`, not under `.dark`, not under `@media`)? | Move the declaration into a top-level `@theme`. If the variable **shouldn't** spawn a utility — then it shouldn't be in `@theme`; keep it in `:root`. See `references/gotchas.md` §2, `references/v4-rules.md` §2 |
| The variable is in `@theme`, but the utility is still "wrong" / lacks the right prefix (`bg-`/`text-`/`border-`) | Wrong **namespace** in the name: utilities are produced by namespace (`--color-*` → `bg-/text-/border-/ring-`, `--radius-*` → `rounded-*`, `--font-*` → `font-*`, `--spacing` → padding/sizes) | Match the token name's prefix against the target utility: for a color utility the name must begin with `--color-` | Rename by namespace (`--brand` → `--color-brand`, which gives `bg-brand`). Name canon — `references/v4-rules.md` §2, the set — `templates/theme.css` |
| `@theme { .dark { … } }` or `@theme { @media … }` — the build fails or the token is ignored | A `@theme` body accepts **only** custom properties and `@keyframes`; nested selectors/media are not allowed | Check the `@theme` body for nested `{ }` blocks | Move overrides/media outside as regular selectors (`.dark { … }`, `@media { :root { … } }`). See `references/gotchas.md` §2 |

---

## 4. `@apply` fails or silently does nothing

| Symptom | Likely cause | Check | Fix |
| --- | --- | --- | --- |
| The build fails with "unknown utility / class" on `@apply` in a **scoped `<style>` / CSS module** | In an isolated style block the theme isn't connected — the compiler doesn't "see" the tokens/utilities | There's no `@reference "…"` to the entry CSS at the start of this style file | Add `@reference "../app.css";` (the path to the file with `@import "tailwindcss"`) at the start of the module. In a single entry CSS, `@reference` isn't needed. See `references/gotchas.md` §6, `references/v4-rules.md` §15 |
| `@apply` inside `@keyframes` doesn't work / errors | `@apply` is **forbidden** in `@keyframes` | Grep `@keyframes` for a nested `@apply` | Rewrite the frames with plain CSS declarations (no `@apply`). See `references/gotchas.md` §6 |
| `@apply` to a token works in some files, not in others | Some files are isolated modules without `@reference`, some are the entry CSS (where it's there "out of the box") | Separate the files: entry vs scoped/module; check `@reference` in the scoped ones | Add `@reference "…"` to every isolated file. See `references/v4-rules.md` §15 |
| All the CSS with `@apply` "silently" didn't run, with no errors | The project is built via the **Play CDN** (`@tailwindcss/browser@4`) — there `@apply` is unavailable (as is `@plugin`) | Grep the HTML for `@tailwindcss/browser` / `cdn.jsdelivr…/browser@4` | Switch to a build (`@tailwindcss/cli` / `-vite` / `-postcss`) — only there is `@apply` available (all of Approach B). The CDN is just for dev/prototyping. See `docs/performance-and-bundle.md` §6 |
| You can't mix a mixin and utilities in one `@apply` | In a single `@apply` you can't combine CSS mixins and Tailwind utilities | Check the `@apply` line for a mix of your own classes and utilities | Split into separate declarations. See `references/gotchas.md` §6 |

---

## 5. The variant stack behaves "backwards"

| Symptom | Likely cause | Check | Fix |
| --- | --- | --- | --- |
| After migrating from v3, the effect "got lost" in nested variants (`group-*`, `peer-*`, `*`, `**`, `before:`/`after:`) | In v4 the variant stack applies **left to right** (the reverse of v3): the leftmost wraps first, the rightmost is innermost | Take the problematic class and read the stack left to right; compare with how the selector should "wrap" | Reverse the order of variants in the stack (`before:hover:` ≠ `hover:before:`). For simple combinations the result is the same — check specifically the nested/order-sensitive ones. See `references/gotchas.md` §1, `references/v4-rules.md` §18 |

---

## 6. A border / ring is invisible or "the wrong color"

| Symptom | Likely cause | Check | Fix |
| --- | --- | --- | --- |
| `border` is set, but **no border is visible** | Preflight v4: `border` without a width gives `border-width: 0` (and the default color is `currentColor`, not `gray-200` as in v3) | Check whether the element has both a **width** (`border` is enough for 1px) and a **color** (`border-<token>`) | Set the color explicitly: `border border-border`. A single default can be baked in: `@layer base { * { @apply border-border; } }`. See `references/gotchas.md` §5, `references/v4-rules.md` §16 |
| The border/ring is **colored as the text**, not neutrally | The default border and `ring` color in v4 is `currentColor` | In DevTools the border's color matches the element's `color` | Specify a semantic color (`border-border`, `ring-ring`/`outline-ring`). See `references/v4-rules.md` §16 |
| The `ring` is thinner than you expect | The default `ring` width in v4 is **1px** (it was 3px in v3) | Compare against your v3 expectation | Set the width explicitly (`ring-2`) and the color (`ring-ring`). See `references/v4-rules.md` §16 |

---

## 7. A CSS variable in an arbitrary value isn't substituted

| Symptom | Likely cause | Check | Fix |
| --- | --- | --- | --- |
| `bg-[--brand]` / `text-[--ink]` doesn't substitute the variable (the style is empty or wrong) | In v4 the v3 square-bracket form is **not** read as a CSS variable reference | Grep the markup for `\b(bg|text|border|fill|stroke|…)-\[--` | Switch to the bracket-paren syntax: `bg-(--brand)`, `text-(--ink)`. With a fallback — `bg-(--brand,var(--color-muted))`; with a type — `text-(length:--step)`. Square brackets remain only for **literal** values (`top-[117px]`). See `references/gotchas.md` §3, `references/v4-rules.md` §14 |

---

## If no row matched

- Double-check that this is actually **v4** (not v3): `@import "tailwindcss"` instead of
  `@tailwind base/...`, the `@tailwindcss/postcss`/`-vite`/`-cli` plugin, config in `@theme`. The full
  v3→v4 map — `references/v4-rules.md`, flat — `resources/v3-to-v4-cheatsheet.md`.
- Check against the browser baseline: v4 doesn't polyfill native features (Safari 16.4+ / Chrome 111+ /
  Firefox 128+). The "works for me, not for the user" symptom is often about an old browser.
  See `references/gotchas.md` §10.
- Run the quick self-check checklist at the end of `references/gotchas.md` ("Cheat-sheet checklist") and
  the dark mode checklist in `docs/dark-mode.md` §8.

## See also

- Subtle "silent" engine breakages (full "won't work / correct" breakdowns) — `references/gotchas.md`.
- Wrong→Correct→Why triples for each v4 rule — `references/v4-rules.md`.
- Gotchas one-liners — `resources/gotchas-list.md`.
- Dark mode mechanics (two steps, token-driven, `color-scheme`, toggle) — `docs/dark-mode.md`.
- The scanner as `grep`, dynamic names, `@source`, CDN vs build modes — `docs/performance-and-bundle.md`.
- Reviewing Tailwind code as a procedure — `workflows/review-tailwind.md`.
