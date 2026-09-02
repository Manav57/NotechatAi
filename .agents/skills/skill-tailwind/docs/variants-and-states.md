# Variants and states (Tailwind v4)

This is a **conceptual** chapter: a mental model of how variants (`variant:utility`) work in v4,
why a variant stack reads **left to right**, which set of states is mandatory for an interactive
element and why, and how `group-*` / `peer-*` / `has-*` / `not-*` / `data-*` replace JS state logic
with pure CSS. We don't duplicate reference tables — for the full list of variants go to
`references/gotchas.md` (Tailwind v4 built-in variants); ready-made
markup/styles are in `examples/button/*` and `examples/input-field/*`.

---

## 1. The variant model: `variant:utility`

In Tailwind a utility is unconditional by default — `bg-primary` always paints the background. To
apply it **conditionally**, you prepend a variant prefix to the utility via a colon:

```
hover:bg-primary/90
└┬──┘ └────┬──────┘
variant   utility (what to apply)
(when to apply)
```

The key idea in v4: **one condition = one class, and the style doesn't "hide" in CSS**. Instead of
writing `:hover { background: … }` somewhere off to the side, you see the hover state right on the
element. A variant is a selector/at-rule wrapper around a utility: `hover:` expands to `&:hover { … }`,
`md:` to `@media (width >= 48rem) { … }`, `before:` to `&::before { … }`, and so on. The full registry
of built-in variants (pseudo-classes, pseudo-elements, media/feature, attribute, structural,
compound, functional) are Tailwind v4's built-in variants; their full list is in `references/gotchas.md`.

Any variant can be attached to a **group** of utilities as well, and in **approach B** via `@apply` —
equivalently. That is, a "variant" is not a property of the utility-first syntax but a property of the
engine; in BEM it simply becomes a nested selector:

```scss
/* Approach B: the same hover, but as a nested rule (see examples/button/button.bem.scss) */
.button_primary {
  @apply bg-primary text-primary-foreground;
  &:hover { @apply bg-primary/90; }   /* ← variant hover: ⇄ &:hover */
}
```

This is exactly the meaning of "two equally valid approaches": `hover:bg-primary/90` in the markup (A)
and `&:hover { @apply bg-primary/90; }` in SCSS (B) — the same behavior, a different carrier.

---

## 2. Stacking variants: order LEFT TO RIGHT (inverted from v3)

Variants can be **stacked**: `dark:md:hover:bg-primary/90`. In v4 the chain reads **left to right** —
this is the **reverse** of v3, and it's the most common "silent" breakage during migration. The left
variant wraps on the **outside**, the right one on the **inside**, closest to the utility itself.

```html
<!-- v4 reads left to right: ::before OUTSIDE, :hover INSIDE -->
<div class="before:hover:content-['x']">…</div>   <!-- ::before, then :hover -->
<div class="hover:before:content-['x']">…</div>   <!-- :hover, then ::before -->
```

For simple combinations (`md:hover:` vs `hover:md:`) the visible result often coincides, so the
mistake is easy to miss. The order becomes **significant** when variants nest inside one another:
`group-*`, `peer-*`, `has-*`, `*`/`**`, pseudo-elements. The practical rule and a "before → after"
example are in `references/gotchas.md` §1. If after porting from v3 an effect "got lost" — the first
thing to do is **flip the stack**.

> Mnemonic: write variants in the order in which they should **wrap** — like a matryoshka, outside in.
> The outermost context (`dark:`, `md:`, `group-…:`) goes on the left, the state closest to the element
> (`hover:`, `focus-visible:`) on the right, right up against the utility.

---

## 3. The mandatory set of states for an interactive element

The skill's canon: an interactive component carries the **full set** of states, not just one `hover`.
At minimum: `hover` · `focus-visible` · `active` · `disabled`. Why exactly this — three reasons tied to
v4 engine behavior.

### 3.1. `hover` doesn't work on touch — so it can't be the only one

In v4 the `hover:` variant is wrapped in `@media (hover: hover)` (Tailwind v4 engine default behavior).
On touch devices, where there's no hovering pointer, the hover style is
**not applied**. This removes the "stuck hover" after a tap, but it means: if a state lives only in
`hover:`, on a phone it **won't exist** at all. Details are in `references/gotchas.md` §8.
That's why a visually important state is always duplicated with an accessible `focus-visible` and/or `active`.

### 3.2. `focus-visible`, NOT `focus` — for keyboard focus

```
focus          → triggers on ANY focus, including after a mouse click (the ring "flashes" on click)
focus-visible  → triggers when the browser CONSIDERS the focus worth indicating — that is, during
                 keyboard navigation (Tab), but NOT on an ordinary mouse click
```

A visible focus ring is needed by **keyboard** users; for mouse users it looks like visual noise.
`:focus-visible` is exactly the browser heuristic that distinguishes "arrived via Tab" from "clicked".
That's why the skill's canon: **put the focus ring on `focus-visible:`, not on `focus:`**. In both
button examples the ring sits on `focus-visible` (`examples/button/button.utility.html` →
`focus-visible:ring-2 focus-visible:ring-ring …`; approach B — `&:focus-visible { @apply ring-2 … }`
in `examples/button/button.bem.scss`).

> **The ring must sit on the actually-focusable element.** A thing that **navigates** is an `<a href>`,
> a thing that **acts** is a `<button>` — choose the tag by behavior and put the focus-visible ring
> directly on that tag. Don't wrap a navigating `<a>` in a styled `<button>` to reuse the button look:
> the real focus stop is then the inner `<a>`, while the visible ring is painted on the wrong (outer)
> node. To style a link like a button, put the button classes **and** the `focus-visible:` ring on the
> `<a>` itself (see the link-as-button variant in `examples/button/*`). More on choosing the tag by
> behavior: `docs/accessibility.md` §3.

### 3.3. `focus-visible`, NOT `focus-within` — why they're different tools

They're easy to confuse, but they solve **different** problems:

```
focus-visible → the element itself is focused AND the focus is "worth indicating" (keyboard). About the KEYBOARD.
focus-within  → the element OR ANY of its descendants is focused (by any means). About NESTING, not the keyboard.
```

`focus-within` answers the question "is there focus somewhere inside the subtree" — but it also fires
on a mouse click, so as an indicator of keyboard focus it produces false positives. When the focus is on
a nested `<input>`, but you need to highlight the **wrapper** (control) while preserving
focus-visible semantics (no ring on a mouse click), the right tool is **`has-[:focus-visible]`**
(compound `has` + nested `focus-visible`), not `focus-within`. That's exactly how the input field is done:

```html
<!-- examples/input-field/input-field.utility.html: the ring rises onto the WHOLE control,
     but only on keyboard focus of the input inside -->
<div class="… rounded-md border border-border bg-input
            has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring
            has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background">
  <input … class="… outline-none …" />
</div>
```

Approach B does the same with a nested rule (`examples/input-field/input-field.bem.scss`):

```scss
.inputField-control {
  @apply rounded-md border border-border bg-input;
  &:has(:focus-visible) { @apply ring-2 ring-ring ring-offset-2 ring-offset-background; }
}
```

`focus-within` here would give a ring on a mouse click too — `has-[:focus-visible]` avoids that.

### 3.4. `disabled` — kill interactivity and don't rely on color alone

`disabled:` applies to a natively disabled control (`<button disabled>`, `<input disabled>`).
The canonical state is to dim (`disabled:opacity-50`) and remove interactivity
(`disabled:pointer-events-none` on a button, `disabled:cursor-not-allowed` on a field). Both examples
carry it in every variant.

### 3.5. A toggle's visible state must have an accessibility-tree counterpart

The mandatory set above is **visual**. For a true **toggle** control (a theme switch, a "mute"/"pin"
button, a show/hide trigger) the on/off state is also meaningful to assistive tech — and a screen
reader can't see a CSS color or `data-*` flag. So whenever a visual state expresses an
**on/off / pressed** condition, mirror it in the accessibility tree:

```
toggle button   → aria-pressed="true|false"   (a button whose own pressed state flips)
switch          → role="switch" + aria-checked="true|false"   (an on/off switch widget)
```

```html
<!-- a real <button> that toggles: visible state AND its accessibility-tree counterpart.
     Icon-only ⇒ it MUST carry an aria-label, and that name is STATE-NEUTRAL: aria-pressed
     already announces on/off, so the name names the CONTROL, not the current state. -->
<button type="button" aria-pressed="true" aria-label="Dark mode"
        class="… aria-pressed:bg-primary aria-pressed:text-primary-foreground">
  <span aria-hidden="true">☾</span>   <!-- decorative glyph, not the accessible name -->
</button>
```

You can drive the visual from the **same** attribute (`aria-pressed:` / `aria-checked:` variants), so
the look and the announced state come from one source. Details on the state-in-the-tree mapping are in
`docs/accessibility.md` §4.2.

> **An icon-only toggle still needs an accessible name — and that name must be STATE-NEUTRAL.** A toggle
> that shows only a glyph (the `☾`/`☀` above) has no visible text, so it **must** carry an `aria-label`
> (or `aria-labelledby`) — otherwise a screen reader announces a nameless "toggle button, pressed".
> Make that name name the **control**, not its current state: `aria-label="Dark mode"` /
> `aria-label="Mute"` / `aria-label="Pin"`, **fixed**. The on/off is already carried by
> `aria-pressed` (or `aria-checked` on a `role="switch"`); a label that *also* flips with state
> (`"Switch to light theme"` ⇄ `"Switch to dark theme"`) **double-encodes** the state and reads
> inconsistently — e.g. `aria-pressed="true"` + `aria-label="Switch to light theme"` announces
> "switch to light theme, pressed", and it's ambiguous what "pressed" is true *of*. Pick **one**
> source of state: a stable name + the ARIA state attribute (preferred for a toggle), or — if you'd
> rather model a momentary action than a sticky on/off — drop `aria-pressed` and use a plain
> action-named button. Don't combine a state-flipping label with `aria-pressed`. This is the same
> "keep the name stable, let the ARIA state carry it" rule as for `aria-expanded` triggers — see
> `docs/accessibility.md` §4.1.

> We don't restate the full "variant × size × state" grid — it's laid out in full in
> `examples/button/*` (primary · outline · ghost · danger × sm · md · lg + disabled) and
> `examples/input-field/*` (default · disabled · invalid).

---

## 4. Slash opacity instead of a separate color state

A subtle "press/hover" is done not with a separate token but with a **slash modifier** on the alpha of
the same semantic token: `hover:bg-primary/90`, `active:bg-primary/95`. This is v4 mechanics (under the
hood `color-mix()`) that keeps the palette small and predictable — we don't breed `--color-primary-hover`.
`bg-opacity-*` from v3 is an anti-pattern here (see SKILL.md → "Anti-patterns"). The examples use exactly
this: primary/danger dim via `/90` and `/95`, while neutral variants (outline/ghost) — via a token swap
to `bg-muted`.

---

## 5. States from context: `group-*`, `peer-*`, `has-*`, `not-*`, `data-*`

These are compound/attribute variants with which CSS does what people reach for JS to do:
"highlight X when the parent is hovered", "show the error when the field is invalid", "swap the icon by
state from data". All of them are Tailwind v4's built-in variants (including the compound `group/peer/
has/not/in`); no JS is needed for the **state** itself.

### 5.1. `group-*` — a child reacting to an ANCESTOR's state

We mark the common container with the `group` class, and the descendant reacts to its state via
`group-hover:`, `group-focus-visible:`, and so on.

```html
<a href="#" class="group inline-flex items-center gap-2 rounded-md p-3
                   hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
  <span class="text-foreground">Open</span>
  <!-- the arrow reacts to the hover of the WHOLE link, not itself -->
  <svg class="size-4 text-muted-foreground transition-colors
              group-hover:text-foreground" aria-hidden="true">…</svg>
</a>
```

### 5.2. `peer-*` — a SIBLING reacting to a brother's state

`peer` on one element, the reaction — on the one following it. The classic agnostic pattern is an error
message for a field **without a single line of JS**, on native validation. The key nuance is **which**
validation pseudo-class to take (see §5.6): for user input it's `:user-invalid`
(the `peer-user-invalid:` variant), and **not** `:invalid` / `peer-invalid:`.

```html
<input type="email" required
       class="peer rounded-md border border-border bg-input px-3 h-10 outline-none
              focus-visible:ring-2 focus-visible:ring-ring
              user-invalid:border-danger user-valid:border-success" />
<!-- the error text is visible only AFTER interaction, when the sibling input is invalid -->
<p class="mt-1 hidden text-xs text-danger peer-user-invalid:block">
  Enter a valid email.
</p>
```

> **Why `user-invalid:` and not `invalid:` / `peer-invalid:`.** `:invalid` (and the paired `:valid`)
> reflect the state **immediately on load**: an empty `required` field is invalid **before** the
> user has touched it — so the error (red border, text) flashes on an untouched form, which is exactly
> the symptom of the bug. `:user-invalid` / `:user-valid` (the `user-invalid:` /
> `user-valid:` variants, on the sibling — `peer-user-invalid:` / `peer-user-valid:`) are activated by
> the browser **only after interaction** (input + blur/submit) — exactly the behavior the user expects.
> That's why the skill's canon: for **form validation** take `user-invalid:` / `user-valid:`, while bare
> `invalid:` / `valid:` — for cases where the state is meaningful even before input (for example, an
> `<input>` with an immutable `value` or a server-prefilled field).

> CSS selector limitation: `group-*`/`peer-*` look at the ancestor/preceding sibling.
> You can't highlight an element **before** the trigger in the tree — for that you change the markup or take `has-*`.

### 5.3. `has-*` — the parent reacts to its CONTENTS (the CSS "parent selector")

`has-*` wraps `:has(...)` — the parent is styled by a descendant's state. This is exactly the tool from
§3.3: `has-[:focus-visible]` raises the ring onto the control when the inner input is in keyboard focus.
Another typical case is to mark a row/card by the state of a nested control:

```html
<!-- the list row is highlighted when its checkbox is checked — without JS state -->
<label class="flex items-center gap-3 rounded-md border border-border p-3
              has-[:checked]:border-primary has-[:checked]:bg-primary/5">
  <input type="checkbox" class="peer" />
  <span class="text-foreground">Enable notifications</span>
</label>
```

### 5.4. `not-*` — inverting a variant

`not-*` wraps `:not(...)`: "apply when the condition is NOT met". Handy for "this by default, except disabled":

```html
<!-- hover effect only on a NON-disabled button -->
<button class="bg-primary not-disabled:hover:bg-primary/90 disabled:opacity-50">…</button>
```

### 5.5. `data-*` — state from an ATTRIBUTE (the agnostic replacement for JS classes)

When the state is managed by external code (a widget, server render, any stack), it writes it into a
**data attribute**, and the style reacts with a `data-*` variant. This is exactly the framework-agnostic
replacement for "add/remove a class from JS": the markup is declarative, a single attribute is toggled.

```html
<!-- tab: activity arrives as data-active, the style is pure CSS -->
<button type="button" data-active="true"
        class="px-3 h-9 text-sm text-muted-foreground border-b-2 border-transparent
               data-[active=true]:text-foreground data-[active=true]:border-primary">
  Overview
</button>
```

```scss
/* Approach B: the same data variant as a nested attribute selector */
.tab {
  @apply px-3 h-9 text-sm text-muted-foreground border-b-2 border-transparent;
  &[data-active="true"] { @apply text-foreground border-primary; }
}
```

> When the state is native (`disabled`, validity, `:checked`, `<details open>`), take the ready-made
> pseudo-class variant (`disabled:`, `user-invalid:` / `user-valid:`, `checked:`, `open:`), not
> `data-*`. `data-*` is for **application** states that have no native pseudo-class.
>
> **Important about validation:** for user input — `user-invalid:` / `user-valid:`, and **not**
> `invalid:` / `valid:` (and not `peer-invalid:`): bare `:invalid`/`:valid` fire **before** input and
> paint an empty `required` field invalid right on load (see §5.2). `:user-invalid` /
> `:user-valid` are activated only **after** interaction (input + blur/submit) — and that's the desired
> behavior. The input field in `examples/input-field/*` relies on `aria-invalid`/danger tokens (the flag
> is set by external code/a validator), not on a homemade data flag.

### 5.6. Transient status feedback — announce it, don't just recolor it

A **transient** confirmation ("Copied!", "Saved", "Link copied") is a different beast from the
persistent states above: it appears, then fades. A variant/`data-*` swap can flip the **visible** text
and color, but a state that only paints a color or text change is **not reliably announced** to a
screen reader. The fix is a tiny **visually-hidden live region** that mirrors the message:

```html
<!-- the visible control: text + style flip on a data flag (here driven by external code) -->
<button type="button" data-copied="false"
        class="… data-[copied=true]:border-success data-[copied=true]:text-success">
  <span>Copy</span>
</button>
<!-- the announcement: off-screen, but read aloud when its text changes -->
<span role="status" aria-live="polite" class="sr-only">Copied</span>
```

```scss
/* Approach B: the live region is plain markup; the visible flip is a nested attribute selector */
.copyButton {
  @apply inline-flex items-center gap-2 …;
  &[data-copied="true"] { @apply border-success text-success; }
}
```

Keep the visible text/icon change **and** additionally announce success via the
`role="status"` / `aria-live="polite"` + `sr-only` region updated on the event. Updating that region's
text is the small bit of stateful application JS the skill says to **flag, not fake** — the CSS only
styles the visible affordance. A ready copy-to-clipboard example ships in both approaches under
`examples/`. More on live-region announcements: `docs/accessibility.md` §8 (and the contrast-vs-color
rule in §6 — feedback is never color-only).

---

## 5A. More context and environment: input device, position, wrapping, safety, print

Section 5 is about state from the tree and attributes. This block is about variants tied to the
**environment** (pointer type, system preferences), the **element's position**, and **text behavior**. All are
Tailwind v4's built-in variants (some from v4.1); no JS is needed for the condition itself.

### 5A.1. `pointer-*` / `any-pointer-*` — input device type (the right answer to "hover doesn't work on touch")

`hover:` doesn't fire on touch devices (`@media (hover: hover)`, see §3.1 and `references/gotchas.md`
§8). From this follows the inverse task: sometimes you need to **deliberately** split the interface for
mouse and for finger — not to "lose" a state, but to give a different one. For this, v4.1 has variants by
pointer type (`@media (pointer: …)` / `(any-pointer: …)`):

```
pointer-fine        → the PRIMARY pointer is fine (mouse, trackpad, stylus)
pointer-coarse      → the PRIMARY pointer is coarse (finger) → larger touch target
any-pointer-fine    → AT LEAST ONE fine pointer is available (laptop with a touchscreen)
any-pointer-coarse  → AT LEAST ONE coarse pointer is available
```

```html
<!-- a larger touch target on touch screens: a finger needs an area ≥ ~44px -->
<button class="size-9 pointer-coarse:size-11 …">…</button>

<!-- conversely: show a hover-only hint only where there's a real hover -->
<span class="opacity-0 any-pointer-fine:group-hover:opacity-100 …">hint</span>
```

**When to apply.** When the difference between mouse and finger should affect the **layout/target size**, not
just the presence of hover. For the "hover disappeared on touch" itself the cure is the same — `focus-visible`/`active`
(§3.1); `pointer-coarse:` is about touch-target ergonomics, while `any-pointer-fine:` is an honest check that
the hover mechanic is even available. The difference between `pointer-*` and `any-pointer-*`: the first is about the **primary**
pointer, the second is about the **presence of at least one** (hybrid devices: a laptop with a touch sensor).

### 5A.2. `in-*` — like `group-*`, but WITHOUT the `group` class on the ancestor

`in-*` reacts to the state of **any ancestor** that doesn't need to be marked with the `group` class. This is v4.0:
shorter, when there isn't a single "marker" parent and putting `group` on each one is inconvenient.

```html
<!-- the icon's color changes when ANY ancestor link/button is hovered — without class="group" -->
<a href="#" class="block p-3">
  <svg class="size-4 text-muted-foreground in-hover:text-foreground" aria-hidden="true">…</svg>
</a>
```

```
group-hover:  → needs class="group" on a specific ancestor; targeted, explicit binding
in-hover:     → fires from ANY ancestor on hover; no marker, but less addressable
```

**When to apply.** `in-*` — when "react to any container above" and placing `group` is expensive;
`group-*` (§5.1) — when you need a **precise** binding to a specific ancestor (especially with named
`group/name`). By default prefer `group-*` for addressability; `in-*` is a simplification for typical cases.

### 5A.3. `nth-*` — position among siblings

`nth-*` wraps `:nth-child(...)` — styling by ordinal position (v4.0). Useful for zebra striping and
targeted tweaks without extra markup.

```html
<!-- row zebra striping without extra classes on each row -->
<tr class="nth-odd:bg-muted/40">…</tr>

<!-- a special rule for a specific position / step -->
<li class="nth-3:font-medium nth-[3n]:text-muted-foreground">…</li>
```

**When to apply.** For purely **positional** rules (parity, every Nth, a specific index). If the
state is meaningful (active, selected) — that's `data-*`/a native pseudo-class (§5.5), not position.

### 5A.4. Text wrapping: `wrap-break-word` / `wrap-anywhere` (overflow-wrap, v4.1)

So that a long "unbreakable" string (URL, token, email) doesn't blow out the container and cause
horizontal scroll, v4.1 has `overflow-wrap` utilities:

```
wrap-normal       → wrapping only at ordinary points (spaces) — the default behavior
wrap-break-word   → a long word may break WITHIN itself when there isn't enough room
wrap-anywhere     → like break-word, but also accounted for when computing intrinsic width
```

```html
<!-- a long URL doesn't break the card's layout -->
<p class="wrap-break-word">https://example.com/a-very-long-path-with-no-spaces-or-breaks</p>

<!-- in a narrow flex column: width is computed accounting for possible wrapping -->
<div class="flex"><span class="wrap-anywhere">averylongidentifierwithnospaces</span></div>
```

**When to apply.** `wrap-break-word` — the general case of "don't let a long word blow out the block".
`wrap-anywhere` — when a narrow flex/grid child still inflates by `min-content`: the variant
also affects the intrinsic-width computation. This is not `truncate` (that **clips** to one line with
an ellipsis) — here the text **wraps** and is fully visible.

### 5A.5. Safe alignment: `*-safe` (v4.1)

When there isn't enough room, an ordinary `justify-center` / `items-center` can "push" content past the
container edge so that the start of the line/the first element becomes inaccessible (clipped without scroll).
The `-safe` suffix (v4.1) switches alignment to `start` as soon as there isn't enough room —
the browser's `safe` semantics for flex/grid alignment:

```html
<!-- center while it fits; on overflow — pin to the start, losing nothing -->
<div class="flex justify-center-safe gap-2 overflow-auto">…many chips…</div>
<div class="flex items-center-safe …">…</div>
```

Available for the alignment family: `justify-*-safe`, `items-*-safe`, `content-*-safe`, `self-*-safe`.

**When to apply.** Anywhere a **centered** container can overflow (horizontal lists of chips/tabs,
toolbars, narrow columns). `-safe` insures against a "clipped start" without manual media tweaks.

### 5A.6. `details-content:` — styling the expandable body of `<details>` (v4.1)

The `details-content:` variant targets the `::details-content` pseudo-element — the **content** of a native
`<details>` (what's shown when it opens), separately from `<summary>`. It appeared in v4.1; it lets you
animate/style the expansion with pure CSS, without wrappers.

```html
<details class="rounded-md border border-border p-3
                details-content:mt-2 details-content:text-muted-foreground">
  <summary class="cursor-pointer font-medium text-foreground">More details</summary>
  <p>The body expands and gets a margin/color via ::details-content.</p>
</details>
```

**When to apply.** When you need to style precisely the **expanded part** of an accordion/disclosure separately from
the heading. Whether the block itself is open/closed — that's the `open:` variant (the native `<details open>` state), while
`details-content:` is about styling the body.

### 5A.7. `inverted-colors:` and `noscript:` — environment preferences and the absence of JS

Both variants react to the **environment**, not to an element's state:

```
inverted-colors:  → the system is in color-inversion mode (OS accessibility) → @media (inverted-colors: inverted)
noscript:         → the style is applied when JS is disabled (inside <noscript> logic)
```

```html
<!-- in inversion mode, remove the shadow that reads as grime after inversion -->
<div class="shadow-md inverted-colors:shadow-none …">…</div>

<!-- a message/layout for the "JS is off" case -->
<div class="hidden noscript:block rounded-md border border-border p-3 text-muted-foreground">
  Enable JavaScript for full functionality.
</div>
```

**When to apply.** `inverted-colors:` — targeted styling tweaks (shadows, images) for the system's
color inversion. `noscript:` — progressive enhancement: show fallback content/layout when JS is
unavailable (this is framework-agnostic by itself — it's about accessibility, not a specific stack).

### 5A.8. `print:` — styles for printing

The `print:` variant wraps `@media print` — separate styling for print/PDF. The canonical case:
remove navigation and interactivity, reveal link URLs in the text itself (on paper `href` is otherwise lost).

```html
<nav class="print:hidden">…</nav>   <!-- navigation isn't needed for print -->

<!-- on print, show the link's actual address next to the text -->
<a href="https://example.com/doc" class="text-primary after:hidden print:after:content-['_('attr(href)')']">
  Documentation
</a>
```

```scss
/* Approach B: the same as @media print + a pseudo-element */
.docLink {
  @apply text-primary;
  @media print { &::after { content: " (" attr(href) ")"; } }
}
```

**When to apply.** Printable documents/invoices/reports: `print:hidden` — for navigation, buttons,
banners; revealing `href` via `::after` + `attr(href)` — so links remain useful on paper.

---

## 6. Tie-in with approaches A and B (summary)

- **A (utility-first):** state = a prefix on the utility right in the markup
  (`hover:` / `focus-visible:` / `active:` / `disabled:` / `group-hover:` / `has-[:focus-visible]:`).
  The reference is `examples/button/button.utility.html`, `examples/input-field/input-field.utility.html`.
- **B (BEM+`@apply`):** the same state = a nested selector in SCSS
  (`&:hover`, `&:focus-visible`, `&:disabled`, `&:has(:focus-visible)`, `&[data-active="true"]`),
  assembled via `@apply`. The reference is `examples/button/button.bem.scss`,
  `examples/input-field/input-field.bem.scss`. The order of `@apply` groups (layout → sizes →
  spacing → background/borders/shape → typography → effects → interaction; **then states, then
  modifiers**) is the skill's general canon (`references/approaches.md`, `resources/apply-grouping.md`).

Both notations are expanded by the engine into the very same CSS. The choice of A vs B is about
organization and readability (the decision tree in SKILL.md), not about the set of available states: it's identical.

---

## Checklist (quick self-check)

- [ ] Variant stack — left to right; with `group-*`/`has-*`/pseudo-elements double-check the order (`references/gotchas.md` §1).
- [ ] An interactive element has the full set: `hover` · `focus-visible` · `active` · `disabled`.
- [ ] The focus ring — on `focus-visible:`, NOT on `focus:` (keyboard, not a mouse click).
- [ ] The focus ring sits on the **actually-focusable** element (the `<a>` when navigating), never on a wrapper around it (§3.2).
- [ ] A toggle's visible on/off state has an accessibility-tree counterpart: `aria-pressed`, or `role="switch"`+`aria-checked` (§3.5).
- [ ] An icon-only toggle carries an `aria-label`, and that name is **state-neutral** (the ARIA state carries on/off — don't flip the label too) (§3.5).
- [ ] Every transform/opacity transition and every `animate-*` carries a `motion-reduce:` alternative (`motion-reduce:transition-none` / `motion-reduce:animate-none`; in Approach B: `@media (prefers-reduced-motion: reduce) { @apply transition-none; }`) — consistent with the review checklist.
- [ ] Transient status feedback (e.g. "Copied!") is announced via a `role="status"` / `aria-live="polite"` + `sr-only` region, not color/text alone (§5.6).
- [ ] Highlighting the wrapper on a nested control's focus — `has-[:focus-visible]`, NOT `focus-within`.
- [ ] `hover:` isn't the only carrier of a state (on touch it won't fire — `references/gotchas.md` §8).
- [ ] Subtle hover/active — slash opacity (`bg-primary/90`), not a separate token and not `bg-opacity-*`.
- [ ] Application states from external code — via a `data-*` attribute + variant, not JS class manipulation.
- [ ] Native states (`disabled`/`checked`/`open`) — with a built-in pseudo-class variant, not a homemade `data-*`.
- [ ] Form validation — `user-invalid:` / `user-valid:` (on the sibling `peer-user-invalid:`), NOT `invalid:` / `peer-invalid:` (those redden an empty field right on load — §5.2).
- [ ] A mouse/finger difference affects size/layout → `pointer-coarse:` / `any-pointer-fine:`, not just the presence of `hover:` (§5A.1).
- [ ] "React to any ancestor without `group`" — `in-*`; a precise binding to a specific ancestor — `group-*` (§5A.2).
- [ ] A long unbreakable string (URL/token) doesn't blow out the block — `wrap-break-word` / `wrap-anywhere`, not `truncate` (§5A.4).
- [ ] A centered container can overflow — `*-safe` (`justify-center-safe`/`items-center-safe`), so as not to clip the start (§5A.5).
- [ ] The body of an expanded `<details>` is styled via `details-content:`; open/closed — `open:` (§5A.6).
- [ ] A printable document — `print:hidden` for navigation and revealing link `href` via `::after`/`attr(href)` (§5A.8).
