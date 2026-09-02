# Templates (`templates/`)

Ready-made skeletons for Tailwind CSS v4 (incl. 4.1): the styles entry point, semantic
tokens, and paired component examples in two equally valid approaches — **A (utility-first)**
and **B (BEM + `@apply`)**. Pick the file that fits the task, copy it, and replace the token values
for your design system (keep the token names stable).

## What's in the folder

| File | What it is | When to use |
| --- | --- | --- |
| `entry.css` | The single styles entry point: `@import "tailwindcss"` + project tokens, plus a place for custom `@utility` / `@custom-variant` / `@source`. | Always — this is the file that goes into the build. |
| `theme.css` | Canonical semantic tokens via `@theme` (colors `background/foreground`, `primary`, `muted`, `card`, `border`, `input`, `ring`, `success/warning/danger`, radii) + class-based dark mode. Values are placeholders. | New project: set the tokens once. |
| `tailwind.config.js` | An empty JS config with an explanation. **Usually NOT needed in v4** — all configuration lives in CSS (`@theme` / `@utility` / `@custom-variant`). | Only when you need JS-driven config dynamics (see below). |
| `component.utility.html` | Approach **A**: utility classes directly in the markup. Button + card, states via variants (`hover:` `focus-visible:` `active:` `disabled:`). | "Adding a component" — skeleton A. |
| `component.bem.html` | Approach **B**: markup in strict BEM, no variant utilities; styles extracted into SCSS. | "Adding a component" — skeleton B (markup). |
| `component.bem.scss` | Approach **B**: styles for `component.bem.html` via `@apply`, grouped by property order; states and dark mode live here. | The pair for `component.bem.html`. |

> `component.utility.html` and `component.bem.html` render the **same UI on the same
> structure** — you can compare A against B line by line and pick an approach.

## When to use what

- **New project** → `entry.css` + `theme.css`. Wire `entry.css` into the build,
  replace the token values in `theme.css`. Nothing else is required.
- **Adding a component** → take the skeleton for one of the approaches:
  - **A** — `component.utility.html` (markup only);
  - **B** — `component.bem.html` + `component.bem.scss` (markup + styles).
- **Need JS-driven config dynamics** (tokens computed in JS at build time;
  function plugins; programmatic generation of themes/safelists) → `tailwind.config.js`
  and an explicit include from CSS: `@config "./tailwind.config.js";`. First try
  to express what you need through `@theme` / `@utility` / `@custom-variant` — a JS config pulls in
  the v3 compatibility layer.

## Include order

```
build (PostCSS / Lightning CSS / @tailwindcss CLI)
   └─ entry.css
        ├─ @import "tailwindcss"          ← Tailwind core (first)
        ├─ @import "./theme.css"          ← project tokens (@theme) + dark mode
        ├─ [@config "./tailwind.config.js"]   ← optional, only with JS dynamics
        └─ custom @utility / @custom-variant / @source
```

`@apply` in `component.bem.scss` resolves against this entry point. If the SCSS
is compiled **separately** (a CSS module, scoped style), add `@reference "<path to your entry.css>";`
at its top — otherwise the utilities are unknown and `@apply`
fails. If the file is in the same build that already does `@import "tailwindcss"`,
`@reference` is not needed.

## See also

- `../docs/getting-started.md` — installation, build, first render.
- `../docs/css-first-config.md` — CSS-first configuration: `@theme`, `@utility`,
  `@custom-variant`, `@config`, and why a JS config is usually not needed.
