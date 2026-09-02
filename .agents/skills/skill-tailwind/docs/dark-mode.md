# Dark mode in Tailwind v4: token-driven, not `dark:`-driven

This is a **conceptual** walkthrough: what mental model underlies dark mode in v4 and why
the correct technique is to override the **values of semantic tokens** rather than scatter
`dark:` variants across the markup. The exact token names, the ready-made `@theme` block, and the `.dark` overrides live
in `templates/theme.css` and `references/tokens.md` (§3); here we don't duplicate their tables — instead we
explain "why it's done this way" and work through examples from `examples/`.

> All oklch values below are **placeholders** for the project's design system. Only the
> token **names** are stable. The source of the ready-made code is `templates/theme.css`.

---

## 1. The core idea: the markup must not know about the theme

There are two ways to implement dark mode. They produce the same picture, but they diverge dramatically in
maintenance.

**The "`dark:` across the markup" way (the one we avoid).** Every color class gets a
paired `dark:` variant right in the HTML:

```html
<!-- ANTI-PATTERN: the markup KNOWS about the theme, colors duplicated in every node -->
<article class="bg-white text-zinc-900 border-zinc-200
                dark:bg-zinc-900 dark:text-zinc-50 dark:border-zinc-800">
  ...
</article>
```

**The "token-driven" way (the skill's canon).** The markup writes only **semantic** utilities, while the
concrete values for dark mode are overridden **once** in the `.dark` block:

```html
<!-- CORRECT: the markup does NOT know about the theme — the same classes for both themes -->
<article class="bg-card text-card-foreground border border-border">
  ...
</article>
```

```css
/* values for the dark context — in ONE place, see templates/theme.css */
.dark {
  --color-card: oklch(21% 0.01 255);
  --color-card-foreground: oklch(96% 0.004 255);
  --color-border: oklch(30% 0.01 255);
}
```

Why the second way is strictly better — three reasons, and all of them are about **cohesion**:

1. **One source of truth per color.** The light and dark value of a token live side by side (in `@theme` and in
   `.dark`), instead of being smeared across hundreds of markup nodes. Tweaking the card's contrast in dark mode is
   one line in CSS, not a grep over `dark:bg-*` across the whole project.
2. **The markup stays semantic.** `bg-card text-card-foreground` communicates a *role*
   ("card surface and the text on it"), not a color. The theme is an implementation detail of the token, and the
   markup has no business knowing about it. This is a direct continuation of the Brand → Semantic → Component hierarchy
   (`references/tokens.md` §2): the theme changes the values of the semantic layer, it doesn't touch the names.
3. **You can't forget half of it.** With the `dark:` approach it's easy to add `bg-card` but forget
   `dark:bg-...` — and the node "falls through" to a light color on a dark background. With token-driven, such
   gaps don't happen: if a node uses a token, it switches along with the theme automatically.

> The rule in one line: **`dark:` in the markup is a smell.** If you're writing `dark:bg-*`/
> `dark:text-*`, the token you need probably isn't defined yet. Define the token and override it in
> `.dark` — the markup will get shorter and stop "knowing" about the theme.

When `dark:` in the markup is still appropriate — rare, pinpoint cases where the difference *doesn't* reduce to
a token color: for example, swapping an **asset** (`dark:hidden` on a light illustration and the inverse
`hidden dark:block` on a dark one) or a shadow that color tokens can't express. This is an exception, not
the main tool.

---

## 2. The mechanics of a class-based theme: two independent steps

Dark mode in v4 is **not one** switch but two orthogonal mechanisms. They're often confused;
let's separate them explicitly. The ready-made code for both steps is in `templates/theme.css`.

### Step 1 — register the class-based variant

```css
@custom-variant dark (&:where(.dark, .dark *));
```

This is the v4 replacement for the old `darkMode: "class"` from `tailwind.config.js`. The directive redefines what
the `dark` variant means: now it triggers when an element **itself** has the `.dark` class **or**
is a descendant of `.dark` (`.dark *`). Let's break the selector down piece by piece:

- `&` — the element the variant is applied to;
- `:where(.dark, .dark *)` — the condition "inside a `.dark` subtree";
- the `:where(...)` wrapper keeps **specificity zero**. This matters: theme overrides must
  not "weigh" more than ordinary classes, otherwise they become hard to override in a pinpoint way. Zero
  specificity makes switching predictable.

After this line, variants like `dark:hidden` (see §1, for assets) work off the `.dark` class
rather than off the system setting. But — take note — this step **on its own** does not yet recolor the tokens;
it only defines the *condition*. The recoloring is step 2.

### Step 2 — override the same tokens in `.dark`

```css
.dark {
  --color-background: oklch(18% 0.01 255);
  --color-foreground: oklch(96% 0.004 255);
  /* ...the same set of SEMANTIC names, different values... */
}
```

This is the "engine" of the theme. The `bg-background` utility is expanded by the engine into
`background-color: var(--color-background)`. The variable resolves **at runtime** through the cascade: while a
node is outside `.dark` — the value from `:root` is taken (placed there by `@theme`); as soon as an ancestor
gets the `.dark` class — the same name resolves to the dark value. The markup meanwhile doesn't change
**by a single character**.

> Why a `.dark { ... }` block specifically, and not a second `@theme`: values inside `@theme` go into
> `:root` and apply **globally** (plus they generate utilities). Dark overrides must live under the
> `.dark` selector so they switch by context. Division of roles: `@theme` defines the **names and
> utilities**, `.dark { ... }` — the **values for the dark context**. More detail — `references/tokens.md`
> §3.

**A consequence for multiple themes.** A third theme (for example, `high-contrast`) is not a new mechanism
but yet another selector class with the same set of names: `.high-contrast { --color-... }`. The utilities,
the markup, and the `@apply` classes stay untouched.

---

## 3. The link to design tokens: why this is "free"

Dark mode works not in spite of tokens but **thanks to** them. The chain goes like this:

```
@theme defines the NAME  →  utility bg-card = background-color: var(--color-card)
        :root        →  light value of var(--color-card)
        .dark        →  dark value of var(--color-card)   (the same name!)
```

Any node that already uses a semantic token gets dark mode **for free** — not a single edit is
required in its markup or in its `@apply` class. This works identically for both of the skill's
approaches:

- **Approach A (utility-first).** `class="bg-card text-card-foreground border-border"` — tokens directly
  in the markup, the theme switches their values.
- **Approach B (BEM + `@apply`).** The same set of tokens is inlined via `@apply` inside the
  class-component:

  ```scss
  /* @reference must point at the ENTRY CSS that defines your @theme tokens, NOT "tailwindcss" */
  @reference "../app.css";
  .card {
    @apply rounded-lg border border-border bg-card;
    @apply text-card-foreground;
  }
  ```

  `.card` switches with the theme automatically too — because `@apply bg-card` expands to the
  same `var(--color-card)`. **No `dark:` branches inside `@apply` are needed** (and they'd be
  an anti-pattern).

  > `@reference` target: point it at the **entry CSS that defines your `@theme` tokens** (e.g.
  > `@reference "../app.css"`), because these `@apply` lines use the *custom* semantic tokens
  > (`bg-card`, `border-border`). `@reference "tailwindcss"` exposes only the **default** theme and
  > **silently drops** your custom tokens — so `@apply bg-card`/`border-border` would not compile. The
  > path is resolved relative to this `.scss`/`<style>` file, so its `../` depth changes with nesting; a
  > build alias to the entry file avoids the brittle relative path. Use `@reference "tailwindcss"` only
  > when the component touches no custom tokens. See `references/gotchas.md` §6.

> The anti-pattern that the theme makes unnecessary: writing `&.dark` or `@apply dark:bg-...` inside a
> class-component. If all colors are tokens, a dark branch in the component isn't needed; the switching is
> handled by one shared `.dark` block that overrides the values.

---

## 4. The examples from `examples/` work in dark mode "for free"

This isn't theory — all the `examples/` are already written token-driven, so dark mode comes "out of the box".
Let's check on the card (`examples/card/card.utility.html`). Its nodes use **only**
semantic tokens:

```html
<!-- from examples/card/card.utility.html (fragment) -->
<article class="... rounded-lg border border-border
                bg-card text-card-foreground shadow-sm">
  ...
  <p class="text-sm text-muted-foreground">...</p>
  ...
</article>
```

Not a single `dark:` variant, not a single literal color (`bg-white`, `#fff`, `bg-[oklch(...)]`).
So to see the same card in dark mode, it's enough to add the `.dark` class to an ancestor —
usually to `<html>`:

```html
<html class="dark">
  <body>
    <!-- exactly the same card markup, not a single edit -->
  </body>
</html>
```

What happens, step by step:

- `bg-card` → `var(--color-card)` → inside `.dark` this is a dark surface;
- `text-card-foreground` → `var(--color-card-foreground)` → light text (the contrast of the
  `*-foreground` pair is preserved, see `references/tokens.md` §1);
- `border-border` → `var(--color-border)` → a dark border;
- `text-muted-foreground` → the secondary text adapts;
- the interactive card-link from the same file changes `border-border → border-ring` on hover —
  `--color-ring` is also overridden in `.dark`, so the state reads in both themes.

The same is true for the BEM version (`examples/card/card.bem.html` + its SCSS): the `card` class is assembled from the same
tokens via `@apply`, so it switches in sync. **One and the same set of examples covers
both themes** — this is a direct consequence of the token-driven approach, not separate work.

> The contrast of `*-foreground` pairs. The theme changes values, but **the pair's contract is preserved**: both in light
> and in dark, `bg-card` goes with `text-card-foreground`, and the contrast is "baked into" the theme itself (see
> "The `*-foreground` pair principle" in `references/tokens.md` §1). That's why switching the theme doesn't break
> readability — you just need to pick dark values with sufficient contrast.

---

## 5. The media-based variant (`prefers-color-scheme`) and when to use it

By default, **without** the `@custom-variant dark (...)` line, the `dark` variant in v4 is tied to the
system setting via `@media (prefers-color-scheme: dark)`. Then `dark:*` in the markup
triggers automatically off the OS theme, and no class on `<html>` is needed.

This is convenient but pairs poorly with the token-driven approach: to override the **token values**
by the system theme you'd have to write a media query by hand:

```css
/* media-driven token override — WITHOUT @custom-variant and without the .dark class */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: oklch(18% 0.01 255);
    --color-foreground: oklch(96% 0.004 255);
    /* ...the same set of names... */
  }
}
```

**When media-based is justified:**

- a business-card site / content page where the theme should simply follow the OS and a **switcher is
  not needed** at all;
- there's no requirement to remember the user's choice or give them a "three-way" (light / dark / system);
- you want zero JS.

**When class-based is needed (`@custom-variant dark` + `.dark`):**

- you need a **visible** theme **switcher** in the interface;
- the user's choice must **override** the system setting and/or **be remembered**;
- additional themes are planned (high-contrast, etc.) — a media query can't express them.

> A "system by default, but with manual override" hybrid is built on the class-based mechanics:
> when "system" is selected the `.dark` class is set/removed via `window.matchMedia` (see §6), and on an explicit
> choice — by the saved value. That is, class-based is the more general mechanism; media-based is its
> simplified special case without a switcher.

---

## 6. A theme switcher without a framework

A class-based theme is switched by **toggling the `.dark` class on `<html>`**. The CSS already handles everything (the steps in §2);
from the platform layer all that's needed is the minimum: set/remove the class and remember the choice. Below is
a self-contained example in native JS, without any frameworks or libraries.

**Anti-FOUC: initialize before paint.** The concrete shape of the guard is fixed: a **synchronous inline
`<script>` injected into the document `<head>`** — *inline content*, **not** a deferred `src`. It must be
inline (its code is part of the first HTML payload, so it runs during head parsing, with no separate network
round-trip that the browser could paint past), synchronous (no `defer`/`async`), and in `<head>` ahead of the
body. Any other shape reintroduces the flash. In a framework / SSR shell where you don't hand-write `<head>`,
this exact shape is emitted through the framework's head/config API (an inline-content field, never a `src`) —
see §6's framework-shell subsection. Get this wrong and the page flashes the light theme ("flash of unstyled
content").

```html
<head>
  <!-- set the class BEFORE rendering body, so there's no light-theme flash -->
  <script>
    (function () {
      var saved = localStorage.getItem("theme"); // "light" | "dark" | null(=system)
      var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      var dark = saved ? saved === "dark" : systemDark;
      document.documentElement.classList.toggle("dark", dark);
    })();
  </script>
</head>
```

**The toggle button.** Any element with a handler that inverts the class and saves the
choice. The button carries **`aria-pressed`** so assistive tech reads its on/off state, not just
its label:

```html
<button type="button" id="themeToggle" aria-pressed="false"
        aria-label="Switch to dark theme"
        class="... rounded-md border border-border bg-background text-foreground ...">
  Toggle theme
</button>

<script>
  var toggle = document.getElementById("themeToggle");
  // reflect the initial state set by the anti-FOUC script
  toggle.setAttribute("aria-pressed",
    document.documentElement.classList.contains("dark") ? "true" : "false");

  toggle.addEventListener("click", function () {
    // toggle ONLY the .dark class — never write a .light class (see the invariant below)
    var isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    toggle.setAttribute("aria-pressed", isDark ? "true" : "false");
    toggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
  });
</script>
```

**Invariant: light is the default, so light = NO class.** In a class-based theme the light values
live in `:root` (placed there by `@theme`) and `.dark` overrides them. The toggle must therefore
add/remove **only `.dark`** — both `classList.toggle("dark")` (no second argument) and the explicit
`classList.toggle("dark", isDark)` form are fine. **Do not** also write a `.light` class
(`classList.toggle("light", !isDark)`): nothing consumes it, so it is inert dead code that can
desync from the real state and implies a `.light { ... }` override block the model doesn't use. The
one time `.light` is legitimate is when you've **deliberately** authored a matching `.light { --color-*: ... }`
block (e.g. to force light against a dark `:root` default) — then toggle that class too.

**Three-way (light / dark / system).** If you need an explicit "follow the system" mode, store three
states and subscribe to system-theme changes while `system` is selected:

```html
<script>
  function applyTheme(mode) {
    // mode: "light" | "dark" | "system"
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var dark = mode === "dark" || (mode === "system" && systemDark);
    document.documentElement.classList.toggle("dark", dark);
    if (mode === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", mode);
  }

  // if system is selected — react to OS theme changes on the fly
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    if (!localStorage.getItem("theme")) applyTheme("system");
  });
</script>
```

**Accessible icon-only toggle.** A toggle that shows only a glyph (no visible text) needs a few
fixed parts to be usable with assistive tech. Use a real `<button type="button">`; give it an
`aria-label` naming the **action** (not the current state); wrap the decorative glyph in
`aria-hidden="true"` so it isn't announced twice; and expose `aria-pressed` so the on/off state
reaches the accessibility tree (the label alone can't convey it). Pick **one glyph convention and
keep it everywhere** — the recommendation here is **glyph = the CURRENT theme** (`☾` while dark,
`☀` while light), so the icon depicts where you are, not where the click would take you:

```html
<button type="button" id="themeToggleIcon" aria-pressed="false"
        aria-label="Switch to dark theme"
        class="... inline-flex items-center justify-center rounded-md
               border border-border bg-background text-foreground ...">
  <span id="themeGlyph" aria-hidden="true">☀</span>
</button>

<script>
  var iconToggle = document.getElementById("themeToggleIcon");
  var glyph = document.getElementById("themeGlyph");

  function reflect(isDark) {
    iconToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
    // aria-label names the ACTION the click performs
    iconToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    // glyph depicts the CURRENT theme (one fixed convention)
    glyph.textContent = isDark ? "☾" : "☀";
  }

  reflect(document.documentElement.classList.contains("dark")); // sync with the anti-FOUC script

  iconToggle.addEventListener("click", function () {
    var isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    reflect(isDark);
  });
</script>
```

> Why these four parts: the `aria-label` gives the control a name (it has no visible text); naming
> the **action** keeps the name meaningful in either state; `aria-hidden` on the glyph stops the
> screen reader from reading a bare "moon"/"sun" character on top of the label; and `aria-pressed`
> gives the state a stable programmatic counterpart (a label that flips text is not, by itself, a
> reliable state signal). Picking glyph = current theme as the single convention avoids the common
> bug where one toggle shows the moon for "you are in dark" and another shows the moon for "click to
> go dark" — opposite meanings under the same label. See `accessibility.md` §3 (icon-only names) and
> §4.2 (`aria-pressed`).

**Runtime toggle under SSR / hydration.** The snippets above assume a client-only page. If your
toggle lives in code that may **also run on a server** (server-side rendering, then hydration in the
browser), the `document` / `documentElement` global does not exist at module load and reading it
**at the top level of a module crashes the server** or produces a hydration mismatch. The rule,
stated generically:

- **Never read `document.documentElement` (or `window.matchMedia`) at module top-level** in code
  that may run on the server. Read the current theme **only after mount** (when the component is on
  the client), and gate the read on a client check.
- **Keep the toggle itself client-only.** The button's interactivity belongs to the browser; render
  a stable placeholder state on the server and reconcile it after mount.
- **Still keep the synchronous `<head>` anti-FOUC script** (above). It runs before paint and sets
  the real class on `<html>`; the mounted component then *reads* that class rather than deciding the
  theme itself. This split — pre-paint script decides, component reads after mount — is what avoids
  both the flash and the hydration mismatch.

> JS-framework aside (optional, not the foundation): in component frameworks this usually means
> initializing your reactive theme state inside an "on mounted" lifecycle hook (or behind a
> "is-client" guard) instead of at the top of the module, and rendering the toggle client-side only.
> The CSS token model is unchanged — only *where you read the class* moves.

**Caution — don't keep reactive theme state at module scope under SSR.** A separate, easy-to-miss
hazard: where the reactive theme value *lives*. On the server, a module is evaluated **once** and
shared across **every concurrent request**, so a reactive theme variable declared at **module top
level** (a "shared singleton") is one piece of state for all in-flight renders — one request's value
can leak into another request's HTML (cross-request state leakage). The fix is generic:

- **Initialize theme state as per-request state**, using your framework's request-scoped state
  primitive (the per-request store / context provider it gives you for exactly this), **not** a
  module-level singleton variable.
- This is orthogonal to the "read after mount" rule above: that one is about *when* you touch
  `document`; this one is about *where the value is stored* on the server. You need both.
- Even when the default looks like a harmless constant (e.g. always-light until the user toggles),
  prefer per-request state — it costs nothing and removes the leak by construction rather than
  relying on the value never becoming request-derived.

**Default theme baked into a framework / static shell + persisted override.** Many setups bake a
default theme straight into the shipped HTML shell — e.g. `<html class="dark">` in a static template,
or a framework's root-HTML attributes. That is fine as a *default*, but on its own it ignores a
returning user's saved choice and will flash the baked-in theme before any runtime code runs. The
recipe is three parts:

1. **Bake the default on `<html>`** in the shell (e.g. `<html class="dark">`), so the very first
   bytes already carry a coherent theme.
2. **Persist the user's choice** (the toggle writes `localStorage.theme`, exactly as above).
3. **Add a pre-paint guard** — the same synchronous `<head>` script — that reads the saved choice and
   **corrects the baked-in class before the first paint / before hydration**, so a returning user
   never sees the wrong theme flash:

```html
<!-- shell ships <html class="dark"> as the DEFAULT; this guard corrects it before paint -->
<head>
  <script>
    (function () {
      var saved = localStorage.getItem("theme"); // "light" | "dark" | null(=use the baked default)
      if (saved === "dark")       document.documentElement.classList.add("dark");
      else if (saved === "light") document.documentElement.classList.remove("dark");
      // saved === null → leave the baked-in default untouched
    })();
  </script>
</head>
```

Because this runs **synchronously in `<head>` before the body renders** (and, in an SSR setup, before
hydration), there is no flash of the wrong theme and no hydration mismatch — the class is already
correct when the framework takes over. The same "only toggle `.dark`" invariant applies: the guard
adds/removes only `.dark`, never a phantom `.light`.

**Where the guard goes when you don't hand-write `<head>` — the framework/SSR shell case.** In a
static HTML page you literally type the `<script>` into `<head>` (above). In a framework or any
SSR-rendered shell you usually **don't** edit the document `<head>` directly — the framework owns it.
The recipe is the same guard, injected through the framework's **head/config API** (the head manager
or the build config's `head` option that lets you declare extra `<head>` tags). Three properties of
that injection are load-bearing — get any of them wrong and the flash comes back:

1. **Inject the script's *content inline*, not a deferred `src`.** Pass the guard as the inline
   **body** of the tag (the head API's `innerHTML`/`children`/"inline content" field), so it is part
   of the first HTML payload and executes **synchronously during head parsing**. A `<script src="…">`
   — even without `defer`/`async` — is a *separate network round-trip*: the browser may paint before
   it arrives, which is exactly the flash you're preventing. The whole point is that no fetch sits
   between parsing the tag and running it.
2. **Place it in `<head>`, before the app's body/markup.** Use the head API's positioning so the tag
   lands in `<head>` (ahead of the rendered body), not appended at the end of `<body>`. It must run
   **before first paint and before hydration**.
3. **Keep it minimal and framework-neutral.** It is the same few lines as the plain-HTML guard above
   — read `localStorage`, correct the baked-in `.dark` class. It is *not* a component, has no
   reactivity, and must not depend on the framework's runtime (which hasn't booted yet).

Conceptually:

```text
framework head/config API  →  emits, in <head>, a synchronous inline <script> (NOT src):
    (function () {
      var saved = localStorage.getItem("theme");   // "light" | "dark" | null(=baked default)
      if (saved === "dark")       document.documentElement.classList.add("dark");
      else if (saved === "light") document.documentElement.classList.remove("dark");
    })();
```

The reactive toggle stays a **separate, client-only concern**: the pre-paint guard *decides and sets*
the class before anything renders; your toggle component, after mount, only **reads** that class to
seed its state (see the "Runtime toggle under SSR / hydration" rule above — read after mount, never
`document` at module top-level). This split — inline pre-paint script sets the class, component reads
it client-side — is what gives you no flash *and* no hydration mismatch in a framework shell.

> Framework asides (brief, optional — the principle is framework-neutral): head managers and SSR
> meta-frameworks expose this either as a head-tag entry in the build/app config (an inline-script
> field) or as a head composable/helper called at the app root. Whichever you use, the rule is the
> same: **inline content, in `<head>`, synchronous, before hydration** — never a deferred `src`.

Notes on this layer:

- The JS here is **minimal and platform-level** — it styles nothing, it only switches one
  class. All the visual logic stays in the CSS tokens. This is exactly the point of token-driven: the markup and
  styles don't depend on how exactly the `.dark` class gets set.
- The class is set on `<html>` (`document.documentElement`), not on `<body>` — so the `.dark` cascade
  covers, among other things, the page background and portal nodes (modals, tooltips), which are often rendered at the
  end of `<body>` or outside it.
- The toggle button is itself assembled from semantic tokens (`bg-background`, `border-border`,
  `text-foreground`) — meaning it looks correct in dark mode "for free", like any example from
  `examples/`.

---

## 7. `color-scheme`: so the browser's native layer darkens too

The token-driven theme (§§1–6) recolors **what you style yourself**. But the browser has its
own native layer that your tokens can't reach: the default colors of form controls
(not reset by `@tailwindcss/forms`), system **scrollbars**, the default focus ring,
date/color pickers, spinners, the background of `<input>`/`<select>`. On a dark background it stays "light" —
a white scrollbar on a dark page, a light dropdown calendar. This is fixed by the CSS property
`color-scheme`, which has utilities in v4:

- `scheme-light` — the native layer is light;
- `scheme-dark` — the native layer is dark (dark scrollbars/controls);
- `scheme-light-dark` — both schemes are allowed, the browser chooses by context/system;
- `scheme-normal` — reset to the default value (`color-scheme: normal`).

**Why this is separate from tokens.** Tokens color *your* CSS; `color-scheme` tells the engine
**which palette to use for its own native UI**. These are orthogonal things: you can recolor the whole
page with tokens, but the scrollbar will stay light until you declare `color-scheme`.

**Where to put it.** Usually on the root — `:root`/`<html>` (less often on `body`), to cover the whole
page, including portals and the window scrollbar. In a class-based theme it's natural to attach it to the same
`.dark` selector that already switches the tokens:

```css
/* the native layer follows your class-based theme */
:root      { color-scheme: light; }   /* light theme by default */
.dark      { color-scheme: dark;  }   /* add to the .dark block from templates/theme.css */
```

The same effect with utilities — right on `<html>` (`@apply` inside `@layer base` or a class in the markup):

```css
@layer base {
  html      { @apply scheme-light; }
  .dark html, html.dark { @apply scheme-dark; }
}
```

If there's no switcher and the theme simply follows the OS (media-based, §5), one line is enough —
the browser will pick the scheme by the system setting itself:

```css
:root { color-scheme: light dark; }   /* == the scheme-light-dark utility */
```

> Combining with `.dark`. `color-scheme` and the tokens switch by the **same** `.dark` class:
> tokens color your markup, `color-scheme` colors the native layer. Add `color-scheme: dark` right
> into the `.dark` block of `templates/theme.css` (next to the `--color-*` overrides) — and scrollbars/controls
> will darken in sync with the theme, without a separate switcher.

---

## 8. Dark mode checklist (a quick glance)

- [ ] The CSS has `@custom-variant dark (&:where(.dark, .dark *));` (for class-based). See
  `templates/theme.css`.
- [ ] The dark values are defined as an **override of the same semantic names** in `.dark { ... }`,
  not as an `@theme` block and not as `dark:` classes in the markup.
- [ ] The markup has **no** `dark:bg-*`/`dark:text-*`/`dark:border-*` (the exception — a pinpoint swap
  of an asset/shadow not expressible by color).
- [ ] In the markup and in `@apply` — only semantic tokens; no literals like `bg-white`, `#fff`,
  `bg-[oklch(...)]`, no `dark:` branches inside class-components.
- [ ] The `*-foreground` pairs preserve contrast both in `:root` and in `.dark`.
- [ ] The switcher (if any) toggles **only** `.dark` on `<html>` (no phantom `.light` class unless a
  matching `.light { ... }` block exists); there's an anti-FOUC initialization in `<head>`; the choice
  is saved in `localStorage`; if a default theme is baked into the shell, a pre-paint guard corrects it
  from the saved choice before first paint/hydration.
- [ ] The switcher control carries **`aria-pressed`** reflecting the theme state (and, if icon-only, a
  real `<button>` with an `aria-label` naming the action and an `aria-hidden` glyph). For an SSR/hydrated
  toggle, the theme is read **after mount** (never `documentElement` at module top-level), and the
  reactive theme value is **per-request state**, not a module-level singleton (cross-request leak).
- [ ] In a framework/SSR shell, the anti-FOUC guard is injected via the head/config API as a
  **synchronous inline `<head>` script** (inline content, **not** a deferred `src`), running before
  first paint/hydration.
- [ ] If a switcher isn't needed and the theme should simply follow the OS — the media-based
  variant has been considered (`@media (prefers-color-scheme: dark)` over `:root`) instead of class-based.
- [ ] `color-scheme` is declared for the native layer (`scheme-light`/`scheme-dark`, usually on
  `:root`/`<html>` or in the `.dark` block), so scrollbars and native controls darken along with the theme.

See also: `references/tokens.md` (§1 the canonical set of names, §3 the mechanics of `.dark`),
`templates/theme.css` (the ready-made `@theme` + `.dark` overrides), `examples/card/*` (token-driven
markup that works in both themes without edits).
