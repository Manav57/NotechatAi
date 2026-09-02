# scripts/ — optional checks (Tailwind v4)

Two small helper scripts. **Both are entirely optional**: the skill works
without them too. **No dependencies** — only Node's built-in modules, so they
**work offline** and require no package installation. They run on any OS
(Windows/Unix); paths are handled via `node:path`.

These are handy additions for CI or local checks, not part of the mandatory
workflow.

## Scripts

### `lint-dynamic-classes.mjs`

Looks for **dynamically assembled** Tailwind-like class names: interpolation
(`` `bg-${tone}` ``) and concatenation (`"text-" + variant`). Tailwind scans
sources as flat text and does not "execute" code, so a class assembled from
pieces will not make it into the final CSS.

The script is **heuristic** — false positives are possible; verify each spot.

The advice it prints: write **full class names** and select them via a
mapping dictionary, or list the variants in CSS via
`@source inline("bg-{primary,accent}")`.

### `check-v3-antipatterns.mjs`

Scans `.css` / `.scss` / `.html` and the like for **Tailwind v3** syntax that
was removed or renamed in v4, and for each hit shows **what it is** and **what
to replace it with in v4**. Covers:

- `@tailwind base|components|utilities` → `@import "tailwindcss";`
- `bg-opacity-*` / `text-opacity-*` / `border-opacity-*` → slash modifier (`bg-primary/50`)
- `bg-gradient-to-*` → `bg-linear-to-*`
- `bg-[--var]` → `bg-(--var)`
- `@layer utilities { … }` → `@utility name { … }`
- `important: true` → `@import "tailwindcss" important;`
- `darkMode:` → `@custom-variant dark (&:where(.dark, .dark *));`

## How to run

```sh
# current folder
node scripts/lint-dynamic-classes.mjs
node scripts/check-v3-antipatterns.mjs

# specific paths
node scripts/lint-dynamic-classes.mjs src ui
node scripts/check-v3-antipatterns.mjs styles/app.css
```

Each script prints `file:line`, a snippet/tip, and a final summary. The exit
code is **1** if anything is found (handy for CI), and **0** if clean. The
`node_modules`, `.git`, and build-artifact directories are skipped
automatically.
