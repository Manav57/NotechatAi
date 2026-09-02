# Tailwind v4 first-party plugins: `typography` and `forms`

Reference for the two official (first-party) Tailwind plugins that make sense in a
**framework-agnostic** context (plain HTML + CSS/SCSS): `@tailwindcss/typography` and
`@tailwindcss/forms`. The focus is **what the plugin does**, **when to reach for it**, **what to watch for**,
and **when it isn't needed**. No third-party/branded packages — only the first-party
`@tailwindcss/*` ecosystem.

> In v4, plugins are loaded **from CSS** via the `@plugin "…"` directive — a JS config (`tailwind.config.js`)
> is not required for this (see `references/v4-rules.md` §3 on `@config`/`@plugin` and
> `docs/css-first-config.md`). The values plugins read (colors, radii, typography) come
> from the canonical `@theme` — see `references/tokens.md`.

---

## 1. When a plugin is actually needed (and when it isn't)

A plugin is an **additional layer of styles**, not the first tool. Before `@plugin`, walk down the
abstraction ladder from `references/approaches.md` §1: markup under your own control is almost
always styled with **utilities** (Approach A) or **BEM + `@apply`** (Approach B) without plugins.

A plugin is justified in **narrow** scenarios:

| Plugin | Scenario it solves | Why not "by hand" |
|---|---|---|
| `@tailwindcss/typography` | Style a **third-party/generated** HTML stream (CMS/markdown output) whose nodes you can't add classes to. | Dozens of tags (`h1`–`h6`, `p`, `ul`, `ol`, `blockquote`, `code`, `table`, `a`…) with consistent vertical rhythm — writing this by hand is slow and fragile. |
| `@tailwindcss/forms` | Bring **native controls** (`input`, `select`, `textarea`, `checkbox`, `radio`) to a state convenient for further utility-first styling. | Browser control defaults respond poorly to utilities without a base reset. |

**When a plugin is NOT needed:**

- **Markup under your control** and there's little of it → style it with utilities/`@apply` directly. Pulling in
  `typography` for a couple of headings is dead weight.
- **A single non-standard content block** → a targeted `@apply` adapter on the
  wrapper is faster and more honest (Approach B, rung 6) than the whole `prose` set.
- **Fully custom controls** (your own `<div role="…">` widget, a custom select) → `forms`
  resets nothing where there's no native control; style the component yourself.
- You need **one or two** aspects (just the `appearance` reset on `select`, just `<p>` rhythm) → it's cheaper
  to express this with explicit utilities/`@apply` than to pull in the whole plugin.

> Heuristic: reach for a plugin when the win is **mass** styling (many tags at once) or
> **third-party DOM**, not when you want a "short-cut" for your own small bit of markup.

---

## 2. `@tailwindcss/typography` — the canon for "third-party" content (CMS / markdown)

### What it does

Adds the **`prose`** class and the `prose-*` family of modifiers. Applied to a **wrapper**,
`prose` styles all descendants of the stream (`h1`–`h6`, `p`, `a`, `ul`/`ol`/`li`, `blockquote`,
`code`/`pre`, `img`, `table`, `hr` …) — consistent typography with correct vertical
spacing. The key idea: **no descendant needs its own class** — the whole
stream is styled by tag.

### Setup

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

### Usage

The class goes on the **parent** of the generated content; the inner nodes stay class-free —
which is exactly why it works for DOM you don't control:

```html
<!-- innerHTML rendered from markdown/CMS; descendants have no place for utilities -->
<article class="prose">
  <!-- <h2>, <p>, <ul>, <a>, <blockquote>, <code> ... come from the source -->
</article>
```

### `prose-*` modifiers

| Modifier | Purpose |
|---|---|
| `prose-sm` / `prose-base` / `prose-lg` / `prose-xl` / `prose-2xl` | typography scale (font size + corresponding rhythm) |
| `prose-invert` | inversion for **dark mode** (light text on a dark background); the typical pairing is `dark:prose-invert` |
| `prose-<element>:<utility>` | targeted tweak of a specific tag, e.g. `prose-a:text-primary`, `prose-headings:tracking-tight`, `prose-img:rounded-lg` |

```html
<article class="prose prose-lg dark:prose-invert prose-a:text-primary prose-headings:tracking-tight">
  <!-- ... -->
</article>
```

### Customization via `--tw-prose-*` in `@theme`

The colors and tone of `prose` are controlled by variables in the `--tw-prose-*` namespace (text, headings,
links, `bullets`, borders, code, quotes, and their `*-invert` variants for dark mode). We bind
them to the **canonical semantic tokens** (`references/tokens.md`) so the content stream lives in
the same design system as the rest of the UI:

```css
@theme {
  /* prose inherits the project's semantics, not its own defaults */
  --tw-prose-body:        var(--color-foreground);
  --tw-prose-headings:    var(--color-foreground);
  --tw-prose-links:       var(--color-primary);
  --tw-prose-bullets:     var(--color-muted-foreground);
  --tw-prose-hr:          var(--color-border);
  --tw-prose-quotes:      var(--color-muted-foreground);
  --tw-prose-code:        var(--color-foreground);

  /* dark mode — the *-invert pair (used with dark:prose-invert) */
  --tw-prose-invert-body:     var(--color-foreground);
  --tw-prose-invert-headings: var(--color-foreground);
  --tw-prose-invert-links:    var(--color-primary);
}
```

> The variable names above are from the plugin's namespace; we **map** the **values** onto our own tokens (don't
> hardcode hex/oklch in `prose`). This is the same discipline as in `references/tokens.md` §5
> (map the design system, don't override it).

### Positioning: the canon for "third-party DOM" (Approach B)

`@tailwindcss/typography` is the **canonical** solution for the scenario "style CMS/markdown output
you can't touch." In the skill's terms this is exactly **Approach B / third-party DOM** — the first and
hardest fork in the approach decision:

- `workflows/choose-approach.md` **Step 1** (third-party/generated DOM → Approach B): when the content
  is rendered by an external source and there's nowhere to fit utilities, the decision is made immediately, without the other
  questions.
- `workflows/choose-approach.md` **Case 3** ("Styling markdown / CMS output, `.prose`-like
  content") — exactly this case.
- `references/approaches.md` §4 — "good `@apply`": third-party/generated markup you don't
  own.

Relation to the `@apply` adapter (also Approach B):

- **`prose`** — when you need the **whole** typographic stream at once (article, documentation, post
  body). This is the "ready-made" variant of Approach B: one wrapper, and dozens of tags styled.
- **Your own `@apply` adapter** (`.cmsContent { … }` tweaking descendants by the render selector) — when the
  stream is narrow/specific, you need full control, or `prose` is overkill. This is the "manual" variant of
  Approach B (rung 6 of the ladder).

> Both are legitimate Approach B. `prose` saves effort on mass content; the `@apply` adapter gives
> targeted control. Choose by the volume and specificity of the content, not by "correctness."

---

## 3. `@tailwindcss/forms` — a base reset for native controls

### What it does

This is an **opt-in** base layer that **resets** the browser styles of native form controls
(`input`, `textarea`, `select`, `checkbox`, `radio`, etc.) to a neutral state on top of which
it's **convenient to style with utilities**. Without it, browser defaults (especially `appearance`, the `select`
arrow, the look of checkboxes/radios) respond poorly to utility tuning and diverge between
browsers.

### Setup

```css
@import "tailwindcss";
@plugin "@tailwindcss/forms";
```

### When to reach for it

- The project has **many native forms**, and the controls need to be brought to a uniform, utility-managed
  state (border/radius/focus ring from tokens — `border-input`, `rounded-md`, `outline-ring`).
- You need **cross-browser-predictable** controls as a foundation for customization.

### Caution

- **This is a base reset — it changes the look of all native controls globally.** Add it deliberately;
  if the project already has its own reset/normalize for forms, a double-reset conflict is possible.
  Decide whose reset is primary, don't stack two.
- **Interaction with `peer`/`sibling` logic.** Custom checkboxes/radios/switches are often built
  on a hidden native control + `peer-checked:`/`peer-focus-visible:` on the visual part
  (sibling). `forms` normalizes exactly the native control — make sure the reset doesn't "eat" the state
  that `peer` relies on, and that the focus ring/`checked` look is drawn on the right (visual)
  node. After adding it, **re-check** components on `peer-*` bindings.
- **Opt-in by nature:** don't add it "just in case." If there are few forms or the controls are custom
  (not native), there's no win, and the global reset is excess.

> For your own controls, take values from tokens: border — `border-input`, background — `bg-background`,
> focus — `outline-ring`/`ring-ring` (see `references/tokens.md` §1, the "Outlines/input fields" group).
> `forms` gives a clean base — tokens give the look.

---

## 4. Cheat sheet: which plugin for which task

| Task | Plugin / solution |
|---|---|
| Style **CMS/markdown** output (third-party DOM, many tags) | `@tailwindcss/typography` → `prose` (canon, Approach B). |
| A narrow/specific piece of third-party content | your own `@apply` adapter on the wrapper (Approach B, no plugin). |
| Many **native forms**, need a utility-managed look | `@tailwindcss/forms` (opt-in base reset) + tokens. |
| **Custom** (non-native) controls/widgets | no `forms`; style the component yourself (A or B). |
| Your own markup under control, little content | no plugins — utilities (A) or `@apply` (B). |

---

## See also

- `references/approaches.md` — the two approaches A/B, the abstraction ladder, "good/bad `@apply`" (§4),
  the decision tree (§5).
- `workflows/choose-approach.md` — the approach-selection playbook: **Step 1** (third-party DOM → B) and **Case 3**
  (markdown/CMS — the canonical `prose` scenario).
- `references/tokens.md` — the canonical `@theme` and the semantic tokens we map
  `--tw-prose-*` and native control styles onto.
- `references/v4-rules.md` — `@plugin`/`@config` in CSS-first; plugins are loaded from CSS without
  a JS config.
- `docs/css-first-config.md` — the concept of CSS-first configuration and where `@plugin` fits in it.
