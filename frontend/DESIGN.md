# Axiom — DESIGN.md ("Axiom Sugar")

The single source of truth for Build 7's visual + interaction redesign. Every UI
edit must conform to this. Aesthetic: **Google-Pixel / Material-You *inspired*** —
buttery-smooth, candyish, bubbly, colorful, rounded, motion-rich — but with
**our own palette and shapes** (inspired, never copied). Priorities: **minimal /
uncluttered**, everything interactive is a real affordance, full **dark mode**,
motion everywhere (respecting `prefers-reduced-motion`), and a **cursor-reactive
animated background ONLY on the auth screen**.

Implementation lives in `frontend/css/theme.css` (tokens + component classes +
keyframes), the Tailwind config + no-flash script in `index.html`, and the shared
style helpers in `frontend/js/app.js`. `reader.css` retargets to the same tokens.

---

## 1. Design principles
1. **Soft & tonal.** Tinted surface "containers" instead of hard borders; large
   radii; soft layered shadows; gentle gradients only on hero/primary surfaces.
2. **Colorful but calm.** One primary (grape/berry) + a small candy accent set used
   as *category signifiers* and tonal tints — never a rainbow dumped on one screen.
3. **Minimal.** Generous whitespace, strong type hierarchy, fewer lines, grouped
   actions. If a screen feels busy, remove/space/group before adding.
4. **Responsive to everything.** Every interactive element has hover + active(press)
   + focus-visible states. Cards lift, buttons press, nav indicators glide.
5. **Buttery motion.** Spring-ish easing, short durations, cross-fades on view/tab
   swaps, staggered card entrances. All motion gated by `prefers-reduced-motion`.
6. **Theme-correct.** Light + dark both first-class; nothing hard-codes a raw color
   that won't flip. No flash of the wrong theme on load.

---

## 2. Color tokens (CSS custom properties on `:root`; `.dark` overrides)
Our own hues — NOT Google's. Primary = **Grape**; accents = Mint / Peach / Sky /
Lilac / Lemon. Define ALL as `--` vars; components read only vars.

### Light (`:root`)
```
/* brand + accents */
--primary:            #7A5AF8;   /* grape */
--primary-hover:      #6B46E5;
--primary-press:      #5D39D6;
--on-primary:         #FFFFFF;
--primary-container:  #EDE7FF;   /* soft grape tint surface */
--on-primary-container:#3A2A8C;
--ring:               rgba(122,90,248,.45);

--mint:  #12B886;  --mint-c:  #D7F7EC;  --on-mint-c:  #0A6B50;
--peach: #FF7A59;  --peach-c: #FFE6DC;  --on-peach-c: #B23A1E;
--sky:   #3AB6F0;  --sky-c:   #DCF1FD;  --on-sky-c:   #0B6390;
--lilac: #C77DFF;  --lilac-c: #F3E4FF;  --on-lilac-c: #7A2FB0;
--lemon: #F2B705;  --lemon-c: #FFF3CC;  --on-lemon-c: #8A6400;

/* semantic */
--success: #12B886; --success-c:#D7F7EC;
--danger:  #F0475B; --danger-c: #FDE2E6; --on-danger-c:#A31427;
--warning: #F59F00; --warning-c:#FFF0D6;
--info:    #3AB6F0; --info-c:   #DCF1FD;

/* neutrals / surfaces (warm plum-tinted) */
--bg:         #FAF8FF;   /* app background */
--surface:    #FFFFFF;   /* cards */
--surface-2:  #F4F1FB;   /* tinted container / hover */
--surface-3:  #EBE6F5;   /* stronger container / active */
--border:     #ECE7F3;   /* soft hairline */
--border-strong:#DDD5EB;
--text:       #1F1B2E;   /* ink */
--text-muted: #625C71;
--text-subtle:#948DA6;

/* shadows (candy, layered) */
--shadow-sm: 0 1px 2px rgba(31,27,46,.06), 0 1px 3px rgba(31,27,46,.05);
--shadow-md: 0 4px 14px rgba(31,27,46,.09), 0 2px 6px rgba(31,27,46,.05);
--shadow-lg: 0 16px 40px rgba(31,27,46,.14), 0 6px 14px rgba(31,27,46,.08);
--shadow-primary: 0 8px 22px rgba(122,90,248,.34);
```

### Dark (`.dark` on `<html>`)
```
--primary:            #9B84FF;
--primary-hover:      #AC97FF;
--primary-press:      #8A70FF;
--on-primary:         #1A1230;
--primary-container:  #2E2350;
--on-primary-container:#D8CCFF;
--ring:               rgba(155,132,255,.50);

--mint-c:#0E3A2C; --on-mint-c:#7DE7C4;
--peach-c:#4A241A; --on-peach-c:#FFB59E;
--sky-c:#0C3245; --on-sky-c:#A6DEFA;
--lilac-c:#3A234A; --on-lilac-c:#E4BCFF;
--lemon-c:#3E3007; --on-lemon-c:#F2D785;
--danger:#FF6B7A; --danger-c:#3E1620; --on-danger-c:#FFB9C1;
--success:#3FD6A4; --warning:#FFC24D; --info:#5BC4F5;

--bg:         #141019;
--surface:    #1E1826;
--surface-2:  #271F31;
--surface-3:  #322842;
--border:     #332A40;
--border-strong:#43384F;
--text:       #F3EFFA;
--text-muted: #B4A9C6;
--text-subtle:#877C99;

--shadow-sm: 0 1px 2px rgba(0,0,0,.40);
--shadow-md: 0 6px 18px rgba(0,0,0,.45);
--shadow-lg: 0 20px 46px rgba(0,0,0,.55);
--shadow-primary: 0 8px 24px rgba(122,90,248,.45);
```

**Accent usage:** rotate the five accents as *category signifiers* — e.g. course
cards, concept dots, exam chips, calendar day chips cycle mint→peach→sky→lilac→lemon
by index. Use the `-c` container tint as background + `--on-*-c` as text for chips.
Keep to ONE accent per element; the primary (grape) is for CTAs, active nav, links.

---

## 3. Shape, spacing, type
```
--r-sm:10px; --r-md:14px; --r-lg:20px; --r-xl:28px; --r-2xl:32px; --r-pill:999px;
--space unit: 4px grid (Tailwind spacing is fine).
```
- Buttons: `--r-md` (pill `--r-pill` for the main auth CTA + FAB-like actions).
- Cards / sections: `--r-lg`–`--r-xl`. Modals: `--r-xl`. Chips/toggles: `--r-pill`.
- Inputs: `--r-md`.
- **Type** (Inter, loaded): display 2rem/700 tight; h1 1.5rem/700; h2 1.125rem/600;
  h3 .95rem/600; body .875rem/450; small .75rem; label .8rem/600 muted. Headings
  `letter-spacing:-.01em`. Comfortable line-height (1.5 body).
- **Density:** page gutters generous (`px-6`+), section vertical rhythm `space-y-6`+,
  card padding `p-5`/`p-6`. Prefer whitespace + tinted surfaces over borders.

---

## 4. Motion
```
--ease-spring: cubic-bezier(.2,.8,.2,1);
--ease-out:    cubic-bezier(.16,1,.3,1);
--dur-fast:120ms; --dur:200ms; --dur-slow:320ms;
```
- **Hover** (interactive cards/buttons): `translateY(-2px)` + shadow step-up + slight
  tint, `transition: transform/box-shadow/background var(--dur) var(--ease-spring)`.
- **Press/active:** `transform: scale(.97)` (buttons), `scale(.99)` (cards).
- **Focus-visible:** `box-shadow: 0 0 0 3px var(--ring)` (+ keep border). Never remove
  outlines without a ring replacement.
- **Entrance:** `@keyframes rise { from{opacity:0; transform:translateY(8px)} to{...} }`;
  lists/grids stagger via inline `animation-delay` (index*40ms, cap ~240ms).
- **View/tab swap:** `@keyframes fadeSwap { from{opacity:0; transform:translateY(4px)} }`
  ~200ms — used for in-place content swaps (dashboard List⇄Calendar, settings section
  patch) so nothing "reloads to top".
- **Nav active indicator:** a `::before` left bar (3px, primary, `--r-pill`) that scales
  in (`transform: scaleY()`) when `.active`.
- **Toasts:** slide-up + fade in, fade out.
- **Ripple (optional, lightweight):** buttons may use a CSS `::after` radial that fades
  on `:active`; keep subtle. Don't add heavy JS.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce){ *{animation:none!important;
  transition-duration:1ms!important} }` and skip the auth background animation.

---

## 5. Component specs (classes in `theme.css`)
All components must work in light + dark via tokens. Names below are the contract the
JS helpers use.

- **`.btn`** (base): inline-flex, center, gap `.5rem`, `--r-md`, `font-weight:600`,
  `padding:.55rem 1rem`, `transition`, focus-visible ring, `:active{scale(.97)}`,
  `disabled{opacity:.5; pointer-events:none}`.
  - **`.btn-primary`**: `bg:var(--primary); color:var(--on-primary)`; hover
    `bg:var(--primary-hover)` + `translateY(-1px)` + `box-shadow:var(--shadow-primary)`.
  - **`.btn-secondary`**: `bg:var(--surface-2); color:var(--text); border:1px solid
    var(--border)`; hover `bg:var(--surface-3)`.
  - **`.btn-ghost`**: transparent; hover `bg:var(--surface-2)`; for muted/tertiary actions.
  - **`.btn-danger`**: `bg:var(--danger-c); color:var(--on-danger-c)`; hover deepen.
  - **`.icon-btn`**: square ~38px, `--r-md` (or pill), `color:var(--text-muted)`; hover
    `bg:var(--surface-2); color:var(--text)`.
- **`.card`**: `bg:var(--surface); border-radius:var(--r-lg); box-shadow:var(--shadow-sm);
  border:1px solid var(--border)`; padding via utility. **`.card-interactive`** (clickable
  cards): cursor-pointer + hover `translateY(-2px)` + `box-shadow:var(--shadow-md)`,
  active `scale(.99)`.
- **`.surface` / `.surface-2` / `.surface-3`**: background helpers (tinted containers).
- **`.field-input`** (replaces the old `inputCls`): `w-full; bg:var(--surface);
  border:1px solid var(--border); --r-md; padding:.6rem .8rem; color:var(--text);
  placeholder:var(--text-subtle); transition`; focus `border-color:var(--primary)` +
  ring. Applies to input/textarea/select.
- **`.chip`**: pill, `padding:.15rem .6rem`, small, tinted (`.chip-mint` … `.chip-grape`
  set bg `-c` + text `on-*-c`). A `.dot` variant = small round accent dot for signifiers.
- **`.nav-item`**: sidebar row; base `color:var(--text-muted)`, `--r-md`, hover
  `bg:var(--surface-2); color:var(--text)`; **`.active`** `bg:var(--primary-container);
  color:var(--on-primary-container)` + the glide-in left indicator.
- **`.modal-card`**: `bg:var(--surface); --r-xl; box-shadow:var(--shadow-lg)`; entrance
  `animation: rise var(--dur) var(--ease-out)`. Backdrop: `bg: rgba(20,16,25,.45);
  backdrop-blur-sm`. **z-index above the reader (see §7).**
- **`.toggle`** (switch): pill track (`--surface-3` off / `--primary` on) + knob that
  slides; `transition var(--dur) var(--ease-spring)`. Used for dark-mode + booleans.
- **Text helpers:** `.text-ink{color:var(--text)}`, `.text-muted`, `.text-subtle`,
  `.link` (primary, underline-on-hover).
- **Empty state (`dashed`):** dashed `--border` box, `--r-lg`, muted text, centered —
  keep, restyled to tokens.

---

## 6. Tailwind + dark-mode wiring (minimal churn)
The app already uses many Tailwind utilities (`bg-white`, `text-neutral-*`,
`border-neutral-200`, `bg-paper`, `text-ink`). To theme everything **without rewriting
every class**:
1. `index.html` Tailwind config: `darkMode: 'class'`; map semantic colors to vars —
   `colors:{ ink:'var(--text)', paper:'var(--bg)', primary:'var(--primary)', surface:
   'var(--surface)', grape/mint/peach/sky/lilac/lemon:'var(--…)' }` and keep Inter.
2. `theme.css` adds **`.dark`-scoped remaps** for the specific light utilities the app
   actually uses, so dark mode "just works" with near-zero markup edits, e.g.:
   ```
   .dark .bg-white{background-color:var(--surface)!important}
   .dark .bg-neutral-50{background-color:var(--surface-2)}
   .dark .bg-neutral-100{background-color:var(--surface-3)}
   .dark .text-neutral-900,.dark .text-neutral-800,.dark .text-neutral-700{color:var(--text)}
   .dark .text-neutral-600,.dark .text-neutral-500{color:var(--text-muted)}
   .dark .text-neutral-400{color:var(--text-subtle)}
   .dark .border-neutral-200,.dark .border-neutral-100{border-color:var(--border)}
   .dark .bg-red-50{background-color:var(--danger-c)} .dark .text-red-600{color:var(--on-danger-c)}
   .dark .bg-amber-50{background-color:var(--lemon-c)} .dark .text-amber-800{color:var(--on-lemon-c)}
   ```
   (Enumerate exactly the shades grep finds in `app.js`/`index.html`.) `body` background
   = `var(--bg)`, color = `var(--text)`.
3. **No-flash:** an inline `<script>` in `<head>` (before body) reads `localStorage
   axiom_theme` (`system|light|dark`) and adds `.dark` to `<html>` synchronously; a
   `matchMedia('(prefers-color-scheme:dark)')` listener updates it while in `system`.
4. **Theme control:** a segmented System/Light/Dark toggle in the sidebar bottom (near
   the profile) AND/OR an Appearance section in Settings; both write `axiom_theme` +
   re-apply. Helper `applyTheme()` / `setTheme(mode)` in `app.js`.

---

## 7. Layering (z-index) — fixes the reader/modal bug
Canonical stack (low→high): base < sidebar (sticky) < **reader overlay `55`** <
**modals `60`** < **pomodoro tray `60`** < **auth gate `70`** < toasts `80`.
- **`ui.mountOverlay` overlay must be `z-[60]`** (was `z-50`) so modals — including the
  Pomodoro setup/manage popup opened from the reader navbar — render ABOVE the reader.
- Toasts sit at `z-[80]` (above everything, including the auth gate).

---

## 8. Screen-by-screen intent (declutter + interactions)
- **Auth (login/signup/forgot):** centered `.modal-card`-style panel over a soft,
  **cursor-reactive animated background** (3–5 blurred gradient blobs in accent hues that
  drift and lean toward the pointer via `requestAnimationFrame`; pure canvas or absolutely-
  positioned divs). Reduced-motion → static soft gradient. Torn down in `enterApp()`; never
  in the main app. Signup adds **security question + answer**; login has **"Forgot
  password?"** + **"Create new account"** links (reciprocal "Log in instead" on signup).
  Inputs get the glow focus; the CTA is a pill primary with the colored hover shadow.
- **Sidebar:** wordmark with a small grape mark; nav items with icon + animated active
  indicator; bottom = theme toggle + health dot + profile chip + logout. Airy.
- **Dashboard:** greeting; a clean **List | Calendar** segmented control that swaps an
  **inner container with a cross-fade (no full re-render / no scroll jump)**; lesson rows
  become soft interactive cards with an accent readiness dot; calendar chips tinted by
  course; catch-up banner as a friendly tonal card.
- **Courses / course page:** course cards as candy `.card-interactive` with accent
  headers; sections (Materials / Concepts / Notes / Exams / Study plan) spaced and grouped;
  concept cards get accent dots; primary vs "…all" actions clearly ranked (primary vs ghost).
- **Study views + reader:** themed; reader navbar/tools use `.icon-btn`; Pomodoro button
  reachable (modal z-fix). Keep the immersive feel.
- **Quiz:** one-question card, big tactile MCQ option buttons (hover/press), animated
  correct/incorrect, progress as a candy bar.
- **Settings:** sectioned cards (Profile / Appearance / AI / Saved Prompts / Pomodoro /
  System). **Saved-Prompt add/edit/delete/activate patches only its section — no full
  `renderSettings()` scroll jump.** Relabel Pomodoro default → **"Default focus length"**
  (hint: pre-fills the timer). New **Appearance** section = theme toggle.

---

## 9. Accessibility & guardrails
- Maintain WCAG-AA text contrast in both themes (check muted text on tinted surfaces).
- Always provide focus-visible rings; never trap keyboard users; ESC closes modals/reader.
- `prefers-reduced-motion: reduce` disables transforms/animations + the auth background.
- **Restyle, don't rewire:** preserve every `data-action`, element id, route, and render
  entry point. This build changes look + the listed fixes only.
- Keep it **minimal** — when in doubt, remove/space, don't decorate.
