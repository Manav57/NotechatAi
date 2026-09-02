# Editor and tooling setup for Tailwind v4

A reference for the tools that make working with Tailwind v4 predictable: **automatic class
sorting** (`prettier-plugin-tailwindcss`) and **editor support** (the Tailwind CSS IntelliSense
extension). This layer is agnostic — none of it is tied to a JS framework; it all works over
plain HTML and CSS/SCSS. The tooling is supplementary: it does **not** replace the `@apply`
grouping discipline from Approach B (see below), but complements it at the markup level.

---

## 1. `prettier-plugin-tailwindcss` — automatic class sorting

The official Prettier plugin from the Tailwind team. It reorders classes in attributes (`class`,
`className`, etc.) into a **canonical order** — the same one the engine uses to sort the generated
CSS (see `resources/property-order.md`). The result: identical class order across the whole
project, less diff noise, and no arguing about manually sorting utilities in markup.

What's important to understand:

- The plugin sorts **only classes in markup** (the order of tokens in an attribute). The cascade
  itself does **not** depend on the order of classes in an attribute (see
  `resources/property-order.md`) — sorting is for readability and a stable diff, not for style
  priority.
- It is the **only** Prettier plugin that must load **last**: it reorders classes after all other
  formatting.
- It recognizes custom functions/attributes via the `tailwindFunctions` and `tailwindAttributes`
  options (useful when classes are assembled by a helper rather than sitting in `class` directly).

### v4 nuance: `tailwindStylesheet`, not a path to a JS config

The main difference from v3. In Tailwind v3 the plugin found the theme via a path to
`tailwind.config.js` (the `tailwindConfig` option). In **v4** the source of truth is the
**entry CSS** with `@import "tailwindcss"` and `@theme` tokens, so the plugin must be pointed at
the CSS file via the **`tailwindStylesheet`** option:

```jsonc
// .prettierrc.json
{
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./src/styles/app.css"
}
```

Where `./src/styles/app.css` is your entry CSS, roughly like this:

```css
/* src/styles/app.css — entry CSS, pointed to by tailwindStylesheet */
@import "tailwindcss";

@theme {
  --color-primary: oklch(/* placeholder — replace with your design system value */ 60% 0.15 250);
  --radius-lg: 0.5rem;
  /* the rest of the project's semantic tokens */
}
```

Why the plugin needs this: to correctly sort **custom** utilities and recognize the names from
your `@theme` tokens (`bg-primary`, `rounded-lg`, etc.), the plugin must read the same theme as
the build. If you specify the old v3 option `tailwindConfig` (a path to a JS config) in a v4
project without a real `@config`, the plugin won't find the theme and will sort only the built-in
classes.

> Edge case: if a project **intentionally** keeps a JS config via `@config "..."` (only with real
> JS dynamics — see `references/v4-rules.md`), the entry CSS still includes it, and you should
> still point the plugin at that entry CSS via `tailwindStylesheet`, not `tailwindConfig`.

### Example of a complete configuration

```jsonc
// .prettierrc.json
{
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./src/styles/app.css",

  // optional: if classes are assembled by a helper (cva/clsx/cn — optional aside),
  // list it so the strings inside are sorted too
  "tailwindFunctions": ["clsx", "cva", "cn"]
}
```

Run it with ordinary Prettier (`prettier --write .`); the plugin needs no separate command. For
auto-formatting on save, enable Prettier as the default formatter in your editor.

---

## 2. Tailwind CSS IntelliSense — editor support

The official Tailwind CSS extension (Tailwind CSS IntelliSense). For working with classes it
provides:

- **Autocompletion** of class names and values — including your `@theme` tokens (`bg-primary`,
  `text-muted-foreground`), variants (`hover:`, `focus-visible:`, `@md:`, `not-*`, `in-*`) and
  values in the arbitrary syntax (`bg-(--brand)`).
- **Hover preview** — hovering over a class shows which CSS declarations it expands to (handy for
  checking v4 renames: `shadow-xs`, `rounded-xs`).
- **Linting** — highlighting of conflicting classes (two utilities on the same property), invalid
  names, and syntax errors in `@apply`/`@theme`.
- **Color hints** — a preview of color tokens right in the class string.

The extension reads the same theme from the entry CSS as the build, so your semantic tokens are
picked up by autocompletion without separate configuration in most cases. If autocompletion
doesn't see the tokens — check that the entry CSS with `@import "tailwindcss"` is actually part of
the project and (if needed) specify the path in the extension's settings.

> Tip for Approach B: in an `@apply` line inside a scoped `<style>` / CSS module, the linter
> expects `@reference "tailwindcss";` — without it `@apply` will be flagged as an error (see
> `references/approaches.md`).

---

## 3. ESLint plugin: status as of mid-2025

There is also an ESLint plugin for Tailwind classes, but as of **mid-2025** its v4 support clearly
**lagged** behind core (v4 syntax, `@theme` tokens, and new variants were not fully recognized).
The practical takeaway:

- **Rely** on the combination of **Prettier sort** (`prettier-plugin-tailwindcss`) **+
  IntelliSense** — this covers class sorting and linting in a v4 project more reliably.
- If the ESLint plugin is used anyway, treat its v4 warnings as indicative and cross-check against
  the IntelliSense hover preview and the official Tailwind documentation.

(A tool's status changes over time — this is a snapshot for the stated period, not a permanent
property.)

---

## 4. Class sorting ≠ `@apply` grouping

A key boundary of responsibility, so as not to confuse two different tools:

| | `prettier-plugin-tailwindcss` | Manual `@apply` grouping (Approach B) |
|---|---|---|
| **Where** | classes in **markup** (the `class` attribute) | `@apply` lines inside a class component in SCSS/CSS |
| **What it does** | reorders tokens into one canonical order | splits utilities into meaningful groups with comments |
| **Who performs it** | automatically, the formatter | a human, deliberately |
| **Why** | a stable diff, a single order in markup | source readability "at a glance" |

Automatic sorting **complements** but does **not** replace the `@apply` grouping discipline:

- In **Approach A** (utilities in markup) the plugin does all the ordering work for you — no manual
  layout required.
- In **Approach B** (BEM + `@apply`) you still lay out `@apply` into meaningful groups **yourself**
  (layout → sizing → spacing → background/borders/shape → typography → effects → interaction, then
  states, then modifiers) — this is done for human readability, and the formatter won't group it
  for you. The canonical property order is `resources/property-order.md`; the practical seven
  groups and a worked example are in `resources/apply-grouping.md`.

In other words, both tools rely on the **same** canonical property order, but operate at different
levels: the plugin at the markup attribute level, manual grouping at the level of `@apply` lines in
the component source.

---

## Related material

- The canonical property order (the shared basis for sorting and grouping) — `resources/property-order.md`.
- The seven practical `@apply` groups and a worked example — `resources/apply-grouping.md`.
- When `@apply` is appropriate at all and the "good/bad `@apply`" rule — `references/approaches.md`.
- v4 syntax and renames that the IntelliSense hover checks — `references/v4-rules.md`.
