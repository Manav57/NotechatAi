<!-- docs/accessibility.md — conceptual accessibility overview (agnostic): focus, states, semantics, ARIA, validation, contrast, motion. -->
# Accessibility in Tailwind v4: one conceptual overview

This is a **conceptual** chapter: a single mental model of accessibility (a11y) for components built on
Tailwind v4, framework-agnostically (plain HTML + CSS/SCSS). The skill is the **implementation** layer: how to
correctly express accessible behavior using v4 utilities/variants and semantic HTML. We don't
duplicate reference tables — for the full list of variants go to `references/gotchas.md`, for the set of
states and the `user-invalid:` nuance — to `docs/variants-and-states.md`, for component invariants
— to `references/components.md`. Here it's **why it's done this way** and how it all comes together.

> Accessibility here is a **mandatory contract**, not an "optional extra": missing visible focus,
> an incomplete set of states, a button role on a `<div>`, a "color-only" error — these are **defects**, not
> simplifications. Token values are placeholders for the design system; the names are stable (`outline-ring`,
> `ring-ring`, `text-danger`, `bg-primary/text-primary-foreground`).

---

## 1. Visible focus: `focus-visible`, not `focus` — and why

A focus indicator is needed by **keyboard** users so they can see where they are when navigating with
`Tab`. For mouse users it's visual noise. The difference between the two pseudo-classes is exactly that:

```
focus          → ANY focus, including a mouse click (the ring "flashes" on every click)
focus-visible  → only when the browser CONSIDERS the focus worth indicating — i.e. during
                 keyboard navigation (Tab), but NOT on an ordinary mouse click
```

`:focus-visible` is a built-in browser heuristic that distinguishes "arrived via `Tab`" from
"clicked". That's why **the skill's canon: put the focus ring on `focus-visible:`, not on `focus:`**. This way
a keyboard user always sees the indicator, and a mouse user doesn't get a "flashing" ring on every
click.

```html
<!-- A (utility-first): ring only on keyboard focus -->
<button type="button"
  class="bg-primary text-primary-foreground
         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
  Save
</button>
```

```scss
/* B (BEM + @apply): the same focus as a nested selector */
.button {
  &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
}
```

### 1.1. What to draw the ring with: `outline` vs `ring` — and why not `outline-none` without a replacement

There are two carriers of the indicator, both legitimate:

| Carrier | Utilities | Characteristic |
|---|---|---|
| **`outline`** | `outline-2 outline-offset-2 outline-ring` | Not part of the box model → **doesn't shift layout**, drawn on top. The default choice for a single control. |
| **`ring`** | `ring-2 ring-ring ring-offset-2 ring-offset-background` | A box-shadow ring; convenient to "lift" onto a wrapper (`has-[:focus-visible]`) and combine with `ring-offset-*`. |

Both use a **separate `ring` token** (`outline-ring` / `ring-ring`), **not** the border color. This is
deliberate: the focus indicator must not depend on `border-border` — it has its own role and its own token
(see `references/tokens.md` §1, "`ring` separate from `border`").

> **NEVER `outline-none` without a replacement.** Removing the browser outline is fine (it's often done to replace
> it with your own `ring`), but then a visible replacement **must** appear. `outline-none` without a following
> `focus-visible:ring-*` / `focus-visible:outline-*` is removal of focus, a gross a11y defect.
> The "remove and replace" pattern: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`.

### 1.2. `focus-visible` ≠ `focus-within`: highlight the WRAPPER — via `has-[:focus-visible]`

They're easy to confuse, but they're about different things:

```
focus-visible → the element itself is focused AND the focus is "worth indicating" (keyboard). About the KEYBOARD.
focus-within  → the element OR any of its descendants is focused by ANY means. About NESTING, not the keyboard.
```

When the focus is on a nested `<input>`, but you need to highlight the **wrapper** (control), and at the same time preserve
focus-visible semantics (no ring on a mouse click), the right tool is **`has-[:focus-visible]`**
(a compound `has` + nested `focus-visible`), **not** `focus-within` (that one fires on the mouse too). This is
how the input field is done — see `docs/variants-and-states.md` §3.3 and
`examples/input-field/input-field.utility.html` (`has-[:focus-visible]:ring-2 …`); approach B —
`&:has(:focus-visible) { @apply ring-2 … }` in `examples/input-field/input-field.bem.scss`.

---

## 2. The full set of states as part of accessibility

An interactive component must carry the **full set** of states, not just `hover`. At minimum:
`hover` · `focus-visible` · `active` · `disabled` (an input field adds validity — §5). This is
an accessibility requirement, not "polish": a detailed breakdown of "why exactly this way" is in
`docs/variants-and-states.md` §3. Briefly, on a11y grounds:

- **`hover` cannot be the only one.** In v4, `hover:` is wrapped in `@media (hover: hover)`, so on
  touch devices the hover style **is not applied**. If a state lives only in `hover:`, on a phone
  it won't exist — so an important state is always duplicated by accessible `focus-visible` and/or `active`.
- **`disabled` — disable interactivity, not just color.** `disabled:opacity-50` + removing
  interaction (`disabled:pointer-events-none` on a button, `disabled:cursor-not-allowed` on a field).
  We use the **native** `disabled` attribute on the control — it removes the element from the tab order and from the
  accessibility tree automatically (see §4.3 on `inert` for whole subtrees).
- **`focus-visible`** — the sole carrier of visible focus (§1).

---

## 3. Markup semantics — the foundation that CSS doesn't replace

The cheapest and most important accessibility is the **right native element**. Tailwind paints
anything, but the role, keyboard, and state in the accessibility tree are given by the **tag**, not the class.

| Purpose | Right element | What it gives for free |
|---|---|---|
| Action | `<button type="button">` (or `type="submit"` in a form) | `button` role, focus, `Enter`/`Space`, participation in the tab order |
| Navigation | `<a href>` | `link` role, focus, navigation, context menu |
| Field | `<input>`/`<textarea>`/`<select>` + `<label for>` | role, link to the label, native validation |
| Modal | `<dialog>` + `.showModal()` | `role="dialog"` + `aria-modal`, focus trap, `Esc`, inert background |
| Disclosure | `<details><summary>` | role, keyboard toggle, `open` state |
| List | `<ul>/<li>`, `<nav>`, `<header>`, `<main>` | structure and landmarks for the screen reader |

> **NEVER put a button role on a `<div>`.** A `<div onclick>` isn't focusable, doesn't respond to
> `Enter`/`Space`, and is invisible to the screen reader as a button. To fix a `<div>` up to the level of a `<button>`,
> you'd have to manually add `role`, `tabindex="0"`, `keydown` handlers for `Enter`/`Space`,
> `aria-disabled` — i.e. reinvent the button. Just use `<button>`.

**Distinguish a button from a link by behavior, not by appearance.** Changes state / submits — `<button>`;
leads to a URL (can be opened in a new tab, bookmarked) — `<a href>`. A visual "link-button"
is made with classes on the right tag, not by changing the tag.

> **The "button-or-link variant": one class set, two tags — never one wrapping the other.** A reusable button
> primitive (utility soup or a `.button` block) must be **tag-polymorphic**: the *same* classes go on whichever
> tag matches the behavior. A thing that **navigates** is the `<a href>` itself, carrying the button classes
> **and** the `focus-visible:` ring directly; a thing that **acts** is the `<button>`, carrying the same set.
> **NEVER** wrap a bare `<a>` in a styled `<button>` (`<button class="button"><a>…</a></button>`) to "reuse"
> the styling: that is interactive-in-interactive (invalid content model), produces **two tab stops**, announces
> conflicting button/link roles, and lands the visible focus ring on the **wrong** node — the non-navigating
> wrapper — while the real focusable `<a>` gets none (a WCAG 2.4.7 failure). Put the button classes and the focus
> ring on the actually-focusable element.

```html
<!-- one button style, applied to the right tag by behavior -->
<a href="/dashboard"
   class="inline-flex items-center bg-primary text-primary-foreground
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Go to dashboard</a>

<button type="button"
   class="inline-flex items-center bg-primary text-primary-foreground
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Save</button>
```

```scss
/* B (BEM + @apply): the .button block styles whichever tag carries it; the ring sits on the element itself */
.button {
  @apply inline-flex items-center bg-primary text-primary-foreground;
  &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
}
/* <a href class="button"> navigates · <button class="button"> acts — same class, no nesting */
```

> **OPTIONAL (framework aside — not the foundation).** In a JS-framework component, this tag-polymorphism is
> usually captured in one reusable primitive that **chooses its tag by behavior** and applies the **same class set**
> regardless. A minimal prop API is enough: an `as`/`href`/`to` trio — when a navigation target (`href`/`to`) is
> given the component renders an `<a>` (or the framework's link element), otherwise a `<button>` (with a `type`).
> The component renders **one** element — never an `<a>` wrapped in a `<button>` — and puts the classes and the
> `focus-visible:` ring on that single rendered tag. The CSS contract above does not change; this is just a way to
> stop hand-repeating the tag choice. The skill stays framework-agnostic — the plain-HTML form is the canon.

**Hide decorative content from the screen reader.** An icon that duplicates the text — `aria-hidden="true"` (as in
all the examples: `<svg … aria-hidden="true">`). An icon-only control **must** carry a text label
via `aria-label` (for example, a modal's close button: `aria-label="Close dialog"` in
`examples/modal/modal.utility.html`).

### 3.1. Skip link / bypass blocks (WCAG 2.4.1)

On any **multi-page site with a persistent header/nav**, a keyboard user otherwise has to `Tab` past the whole
chrome (brand + every nav link + theme toggle + CTA) before reaching the page content — on **every** route. A
**skip link** bypasses that block: a `<a href="#main">` that is the **first focusable element** on the page,
**visually hidden until focused**, and revealed when it receives keyboard focus. It targets the `<main>` landmark,
which carries an `id` and `tabindex="-1"` so focus can move there programmatically.

The reveal is pure CSS, no JS: `sr-only` hides it from sight (but keeps it in the tab order and the accessibility
tree), and `focus-visible:not-sr-only` un-hides it the moment a keyboard user tabs to it.

```html
<!-- A (utility-first): FIRST focusable element in the page, before the header -->
<a href="#main"
   class="sr-only
          focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50
          focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2
          focus-visible:text-primary-foreground
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
  Skip to main content
</a>
<header>…persistent nav…</header>
<main id="main" tabindex="-1">…page content…</main>
```

```scss
/* B (BEM + @apply): same behavior as a block */
.skipLink {
  @apply sr-only;
  &:focus-visible {
    @apply not-sr-only fixed top-2 left-2 z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground;
    @apply outline-2 outline-offset-2 outline-ring;
  }
}
```

> **Why `tabindex="-1"` on `<main>`.** Without it, following the in-page `#main` link moves the *document position*
> but not always keyboard *focus* — the next `Tab` can fall back to the top of the page. `tabindex="-1"` makes
> `<main>` a valid (non-tab-stop) focus target so focus lands inside the content. Use the **same** `id` in `href="#…"`
> and on the landmark. The skip link uses `focus-visible:` (not `focus:`) for the same reason as every other focus
> style (§1): it should appear for keyboard users, not flash on a stray mouse interaction. Define it once at the top
> of the app shell so it precedes the header on every page.

---

## 4. ARIA and relationships: labels, descriptions, state, current item

ARIA is a **supplement** to semantics, not a replacement. The first rule of ARIA: if there's a native element with
the needed semantics — use it, not `role=`. Beyond that — relationships and states that native HTML doesn't itself
express.

### 4.1. Name and description of a control

- **`<label for="id">` ↔ `<input id>`** — the primary link between the label and the field. Clicking the label focuses
  the field; the screen reader announces the name. **Placeholder ≠ label** (the placeholder disappears on input and often
  has low contrast). See `examples/input-field/*`.
- **`aria-label`** — a text name where there's no visible label (icon-only button, close "×").
- **State-bearing controls — keep the NAME stable, let the ARIA state carry the state.** When a control already
  exposes its state to the accessibility tree via an ARIA state attribute — **`aria-expanded`** (menu / accordion /
  disclosure trigger), **`aria-pressed`** (toggle button), **`aria-checked`** (switch / checkbox-role control),
  **`aria-selected`** (tab / option) — its **name** should be **state-neutral and stable** ("Toggle menu", "Menu",
  "Dark mode", or fixed visible text), **not** a name that flips with the state. The state lives in the ARIA
  attribute; if the name *also* changes ("Open menu" → "Close menu", "Enable dark theme" → "Enable light theme"),
  the two **double-encode** the same fact and can drift or read inconsistently across the same control (a screen
  reader announces both the flipped name *and* the flipped state, leaving "pressed" ambiguous as to what it is true
  *of*). A state-aware `aria-label` is an **acceptable secondary alternative ONLY when you drop the ARIA state
  attribute** and treat the control as a momentary action ("Close menu" with no `aria-expanded`); never combine a
  state-flipping label *with* a state attribute. **An icon-only state-bearing control still needs an accessible name**
  (`aria-label`) — make that name stable and let `aria-pressed`/`aria-checked`/`aria-expanded` carry on/off. Prefer
  the stable name plus the state attribute (it is the only form that reads correctly when the name is stable visible
  text). See `docs/variants-and-states.md` §3.5 for the `aria-pressed`/`aria-checked` toggle.
- **`aria-labelledby="id"`** — the name is taken from the text of another node. This is how a modal links its title:
  `<dialog aria-labelledby="modal-title">` → `<h2 id="modal-title">` (`examples/modal/*`).
- **`aria-describedby="id"`** — auxiliary text/error, **in addition** to the name. A field
  links a hint and an error message: `aria-describedby="email-hint"` / `"password-error"`.
- **A control that acts on a specific nearby value should reference that value via `aria-describedby`** —
  so the value becomes part of the control's accessible description. The classic case is a copy button next
  to the thing it copies: a generic `aria-label="Copy"` tells a screen-reader user the *action* but not
  *which* value, even though it sits right beside it. Give the value an `id` and point the trigger at it, so
  the announcement is name **plus** the value the click will operate on:

  ```html
  <code id="copyValue">code-or-address-here</code>
  <button type="button" aria-label="Copy" aria-describedby="copyValue"
          class="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">…</button>
  ```

  See `examples/copy-to-clipboard/copy-to-clipboard.utility.html` (`id="copyValue"` ↔
  `aria-describedby="copyValue"`). The same linkage applies to any action targeting an adjacent value (a
  "share this URL", "reveal this token", "regenerate this key" control): the value belongs in the
  description, not only in the surrounding text.

### 4.2. State in the accessibility tree

A visible CSS state must have a counterpart in the accessibility tree, otherwise the screen reader "doesn't see" it:

| State | Native / ARIA | Note |
|---|---|---|
| Disabled | native `disabled` (preferred) | removes from the tab order and the tree; `aria-disabled="true"` — only if it needs to stay focusable |
| Invalid | `aria-invalid="true"` + text via `aria-describedby` | the visual danger token is **duplicated** by a message (§5) |
| Current item | `aria-current="page"` | on an active navbar link — **not color only** (`examples/navbar/*`) |
| Expanded/collapsed | `aria-expanded` + `aria-controls` | on a menu/accordion/disclosure trigger; keep the trigger's NAME stable, let `aria-expanded` carry the state (§4.1) |
| Loading | `aria-busy="true"` (+ `disabled`) | on a button in a pending state |
| Pressed (toggle) | `aria-pressed="true/false"` | on a toggle button; keep the NAME stable, let `aria-pressed` carry the state (§4.1) |
| Checked (switch) | `aria-checked="true/false"` | on a `role="switch"` / custom checkbox; stable name + state (§4.1) |
| Selected (tab/option) | `aria-selected="true/false"` | on a tab / listbox option; stable name + state (§4.1) |

> **Polymorphic button-or-link primitive: `disabled` is button-only.** A tag-polymorphic primitive (§3)
> renders a `<button>` when it **acts** and an `<a href>` when it **navigates** — and a `disabled` prop is
> **valid only on the `<button>` branch**. The native `disabled` attribute does **not** exist on `<a>`: a real
> link **cannot** be natively disabled (it has no `disabled` IDL attribute, the CSS `&:disabled` never
> matches it, and it stays focusable and navigable). So expose/honour `disabled` **only** while the rendered
> tag is `<button>`; on the link branch, drop the prop. If a *navigation* target genuinely must be presented
> as disabled, do **not** put `disabled` on the `<a>` — instead render it **without `href`** (so it does not
> navigate) plus `aria-disabled="true"`, and take it out of interaction (`pointer-events-none`, optionally
> `tabindex="-1"` if it should also leave the tab order). Use `aria-disabled` here **only** because the
> element needs to stay focusable/announced; for an action control, the native `disabled` on the `<button>`
> is still preferred (it removes the element from the tab order and the tree for free). Silently ignoring a
> `disabled` prop on the link branch is a defect — the visible "disabled" state and its accessibility-tree
> counterpart both vanish.

You can style by this state with the **same** attribute — this is the agnostic replacement for
JS classes (`docs/variants-and-states.md` §5.5):

```html
<!-- active navigation item: semantics + visual from ONE source -->
<a href="/x" aria-current="page"
   class="text-muted-foreground hover:text-foreground
          aria-[current=page]:text-foreground aria-[current=page]:font-medium
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
  Item
</a>
```

```scss
/* B: the same choice with an attribute selector */
.navbar_link {
  @apply text-muted-foreground;
  &:hover { @apply text-foreground; }
  &:focus-visible { @apply outline-2 outline-offset-2 outline-ring; }
  &[aria-current="page"] { @apply text-foreground font-medium; }
}
```

### 4.3. `inert` — this is a native HTML attribute, NOT a Tailwind variant

To take a whole subtree out of interaction and out of the accessibility tree (the background under a modal, a hidden
off-canvas panel), there's the native attribute **`inert`** on the container: it removes focus, events, and
announcement for everything inside.

> **Fact (important):** the `inert:` variant does **NOT** exist in Tailwind — `inert` is set as an HTML attribute
> (`<div inert>`), not as a class variant. For a native `<dialog>` opened via `.showModal()`,
> the background's inertness is provided by the **platform** — a separate `inert` is not needed (see `examples/modal/*`). A manual
> `inert` is appropriate for **non**-`<dialog>` overlays written by hand.

---

## 5. Accessible form validation: `user-invalid:` / `user-valid:`, and "not color only"

Two independent requirements for a form error.

**(1) When to show — after interaction, not on load.** For user input we take
`user-invalid:` / `user-valid:` (on a sibling — `peer-user-invalid:` / `peer-user-valid:`), and **NOT**
`invalid:` / `valid:` / `peer-invalid:`.

> **Why.** `:invalid` / `:valid` reflect validity **right at load**: an empty `required` field is
> invalid **before** the user has touched it — and a red border flashes on an
> untouched form. `:user-invalid` / `:user-valid` are activated by the browser **only after interaction**
> (input + blur/submit) — exactly what the user expects. Bare `invalid:` / `valid:` are appropriate only
> where the state is meaningful even before input (for example, a server-prefilled field). The full breakdown
> is in `docs/variants-and-states.md` §5.2.

```html
<!-- the error appears ONLY after interaction, without a single line of JS -->
<input type="email" required
       class="peer rounded-md border border-border bg-input h-10 px-3 outline-none
              focus-visible:ring-2 focus-visible:ring-ring
              user-invalid:border-danger user-valid:border-success" />
<p class="mt-1 hidden text-xs text-danger peer-user-invalid:block">
  Enter a valid email.
</p>
```

**(2) What to signal with — not color only.** The border/ring color is a secondary signal; it's invisible to
color-blind users and screen readers. **Always duplicate the error with text** and associate it with the field:

- on the field — `aria-invalid="true"`;
- the visible error text — a separate node, linked via `aria-describedby`;
- the danger token (`border-danger` / `ring-danger` / `text-danger`) — **in addition** to the text, not
  instead of it.

The reference is `examples/input-field/input-field.utility.html` (invalid block) and
`examples/input-field/input-field.bem.scss` (the `inputField-invalid` modifier). The same "not color
only" principle — for badge/alert/statuses: duplicate the tone with a word or `aria-label`
(`references/components.md` → badge, alert).

---

## 6. Contrast: semantic `*-foreground` pairs over `bg-*`

Text-to-background contrast is a measurable requirement (WCAG: ~4.5:1 for normal text, ~3:1 for large text and
for non-text indicators like borders/state icons). The skill builds it **into the structure
of the tokens**: each surface color comes paired with a foreground color, and the markup writes them together.

```html
<!-- contrast is "baked" into the pair: whatever values the design system substitutes -->
<div class="bg-primary text-primary-foreground">…</div>
<div class="bg-card text-card-foreground">…</div>
<div class="bg-muted text-muted-foreground">…</div>
```

> The `*-foreground` pair principle (see `references/tokens.md` §1): `bg-card`/`text-card-foreground`,
> `bg-danger`/`text-danger-foreground`, etc., are designed to be contrasting within the pair under any substitution
> of values. Don't mix a surface of one role with the foreground of another (`bg-primary text-muted-foreground`
> is a contrast anti-pattern). **Slash opacity** on a background (`bg-primary/90`) barely touches contrast;
> on **text** (`text-foreground/60`) it can drop below the threshold, so check secondary text
> (for muted text there's its own token `text-muted-foreground`, chosen to be contrasting).

Responsibility for the concrete values rests with the design system (the skill **maps** the values, it doesn't
set them; `references/tokens.md` §5). The skill guarantees only the **correct wiring** of the pairs.

---

## 7. Motion and `prefers-reduced-motion`

Animation is also an accessibility matter: for some users, abrupt motion causes discomfort. Two
rules:

1. **Animate only cheap properties** — `transform` / `opacity`, 150–300ms (not `width`/`top`/
   `box-shadow`, which jank layout/paint).
2. **Respect `prefers-reduced-motion`** via the **`motion-reduce:`** variant — kill the transition:
   `motion-reduce:transition-none` (and/or `motion-reduce:animate-none`). This way, for users with
   "reduced animation" enabled, the interface instantly settles into the final state without motion.

```html
<!-- modal appearance: transform/opacity + respecting reduced-motion -->
<dialog class="opacity-0 scale-95
               transition-[opacity,transform] duration-200 ease-out
               motion-reduce:transition-none
               open:opacity-100 open:scale-100
               starting:open:opacity-0 starting:open:scale-95">…</dialog>
```

The reference is `examples/modal/modal.utility.html` (and `.bem.scss`): the enter animation via `@starting-style`/`starting:`
+ `motion-reduce:transition-none`. The same `motion-reduce:` is carried by buttons in all the examples.

---

## 8. The boundary: where CSS accessibility isn't enough (an honest note about JS)

Tailwind v4 + semantic HTML cover **most** a11y with pure CSS and native elements:
visible focus, states, validation on native pseudo-classes, contrast, reduced-motion, the active
item via `aria-current`. Much of what people reach for JS to do is done with **variants**
(`group-*`, `peer-*`, `has-*`, `not-*`, `data-*` — `docs/variants-and-states.md` §5) without scripts.

**But not everything.** Some patterns require full-fledged **stateful JS** for keyboard and ARIA, and the skill
**does not imitate this with a framework** but flags it explicitly:

- **The native is provided by the platform** — use it: `<dialog>.showModal()` (focus trap, `Esc`, inert
  background), `<details>/<summary>` (disclosure), the `popover` attribute, class/attribute toggling. This is native
  platform JS, not a framework — acceptable (see the modal examples).
- **Real JS is needed** (flag it, don't fake it): roving `tabindex` and arrow-key navigation in tabs/
  menu/listbox; managing `aria-activedescendant`; announcing dynamics via an `aria-live` region; returning
  focus to the trigger after an overlay closes; syncing `aria-expanded`/`aria-selected` with the
  state. If a component needs this — **flag it explicitly** ("stateful JS for the keyboard/ARIA is
  required here"), don't write a Vue/React/Svelte imitation. The skill is agnostic: it's responsible for
  CSS wiring and semantics, and leaves the keyboard state machine to the project's application JS.

---

## Checklist (quick a11y self-check)

- [ ] Visible focus exists and is on `focus-visible:`, NOT on `focus:` (keyboard, not a mouse click).
- [ ] The ring — via the `ring` token (`outline-ring` / `ring-ring`), not via the border color; `outline-none` always with a replacement.
- [ ] Wrapper highlight on focus of a nested control — `has-[:focus-visible]`, NOT `focus-within`.
- [ ] Full set of states: `hover` · `focus-visible` · `active` · `disabled` (a field — plus validity).
- [ ] The right native tag: `<button>`/`<a href>`/`<input>+<label for>`/`<dialog>` — don't put a button role on a `<div>`.
- [ ] An icon-only control carries `aria-label`; decorative icons — `aria-hidden="true"`.
- [ ] A state-bearing control (`aria-expanded`/`aria-pressed`/`aria-checked`/`aria-selected`) keeps a STABLE name; the state lives in the ARIA attribute, not a flipping label.
- [ ] Relationships are set: `label[for]`, `aria-labelledby`/`aria-describedby`, `aria-current="page"`, `aria-expanded`+`aria-controls`.
- [ ] A control acting on a specific nearby value references it via `aria-describedby` (e.g. a copy button → the copied value), so the value is in the accessible description.
- [ ] A polymorphic button-or-link primitive exposes `disabled` **only** on its `<button>` branch; a disabled nav target uses no `href` + `aria-disabled="true"` (a real `<a>` cannot be natively disabled).
- [ ] State exists in the accessibility tree too (`disabled`/`aria-invalid`/`aria-current`/`aria-expanded`/`aria-pressed`), not only in CSS.
- [ ] Multi-page site with persistent header/nav: a skip link is the first focusable element (`sr-only` + `focus-visible:not-sr-only`) targeting `<main id tabindex="-1">` (WCAG 2.4.1).
- [ ] Validation — `user-invalid:` / `user-valid:` (on a sibling `peer-user-invalid:`), NOT `invalid:` / `peer-invalid:`.
- [ ] The error is duplicated by TEXT and linked via `aria-describedby` — not "color only".
- [ ] Contrast: `bg-*` + `text-*-foreground` pairs; surface and foreground roles not mixed.
- [ ] Motion — `transform`/`opacity`, 150–300ms, and `motion-reduce:transition-none`.
- [ ] `inert` — this is an HTML attribute (there's no `inert:` variant); the modal background is made inert by the platform `<dialog>`.
- [ ] Patterns with a keyboard state machine (tabs/menu/listbox, focus return, `aria-live`) need stateful JS — this is flagged explicitly, not imitated with a framework.
