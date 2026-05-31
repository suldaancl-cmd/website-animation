# Design

Captured from the live Kaltuun site (`src/style.css`, `src/main.js`) and poster
(`poster.html`). Register: **brand**.

## Theme

Light. Physical scene: a founder glancing at the site in daylight on a laptop,
expecting an arctic, instrument-like calm. The world is a bright glacial field;
colour arrives as the aurora, the way real northern light appears over snow. Dark
mode would invert the whole "colour to the ice" metaphor, so the site is
committed to light.

## Color

Strategy: **Restrained surface + Committed accent.** The page is tinted arctic
near-neutrals; a single multi-stop aurora ramp is the one expressive element,
used for the word "colour", the 3D aurora, and section-synced lighting.

Neutrals (never pure #fff / #000 — all tinted toward arctic blue):

- `--ice` #eef4f7 — near-white page
- `--ice-deep` #d4e2e9
- `--sky` #c2d6e0
- `--ink` #11202b — deep arctic navy text
- `--ink-soft` #3c5160 — body copy
- `--mist` #8aa3b2 — labels (poster lifts to #9fb8c6 over glass for AA-large)
- Poster ground: `--navy` #0a141d / `--navy-2` #0f1f2c

Aurora accent ramp (the brand signature): teal `#5ad1c8` → blue `#6aa6ff` →
violet `#b98cff` → pink `#ff8fb0` → amber `#ffb86b`. Used as a 95deg gradient on
"colour", as the 3D aurora shader palette, and as per-section hues
(teal·blue·violet·pink·amber) driving the iceberg's emissive glow.

Note: gradient-text on "colour" and glass cards are intentional brand choices
here (the thesis is literally "colour to the ice"), not defaults to strip.

## Typography

Scale: **1.25 major third.** Site uses `clamp()` for fluid sizing; poster uses a
fixed px scale (label 18 · body 20 · h3 25 · h2 31 · h1 39 · hero 152).

- Display: **Bricolage Grotesque** (variable, opsz 12–96, wght 300–800) —
  headlines, brand mark. Tight tracking (-0.035em), line-height 0.92 on heroes.
- Body: **Hanken Grotesk** (300/400/500) — paragraphs, line-height 1.5–1.6,
  measure capped ~46ch.
- Mono: **Spline Sans Mono** (400/500) — eyebrow labels, tags, technical rails;
  uppercase, letter-spacing 0.12–0.22em.

Hierarchy via scale + weight (500 display headings, 700–800 only for hero/brand).

## Layout

- Full-bleed scroll panels, each `min-height: 100vh`, generous asymmetric padding
  (`150px 6vw 110px`). Split grids (1.05fr / 1fr) for studio sections.
- Fixed WebGL canvas behind a `z-index`-layered content stack; side rails
  (rotated mono coordinates) frame the viewport on desktop, hidden < 900px.
- Cards used sparingly (work grid, poster info) with glass surfaces; collapse to
  single column < 900px.

## Motion

- **Lenis** smooth scroll + **GSAP ScrollTrigger** drive a scrubbed 3D camera
  journey (fixed canvas = permanent pin; camera lerps through 5 keyframes by
  scroll progress).
- Line-mask headline reveals (`yPercent` 115 → 0, `expo.out`), fade-up
  `[data-reveal]`, counter tweens.
- 3D: aurora shader curtain, colour-cycling point light, pointer parallax,
  scroll-velocity iceberg spin, UnrealBloom + Bokeh DOF post-processing.
- Easing: `expo.out` / exponential ease-out. No bounce, no elastic.
- TODO: add `prefers-reduced-motion` guard (see PRODUCT.md accessibility).

## Components

- **Nav**: fixed, transparent, three-column (logo / centered links / CTA pill).
- **Eyebrow label**: mono, uppercase, `--mist`, numbered ("01 — The Studio").
- **Headline**: Bricolage, line-masked reveal, optional aurora-gradient `<em>`.
- **Card**: glass (`backdrop-filter: blur`), 1px tinted border, hover lift.
- **Stat**: oversized Bricolage number + mono caption, count-up on scroll.
- **CTA**: pill button, ink border → fills ink on hover.
- **QR / footer** (poster): SVG placeholder + mono location line.

## Tech

Vite 5 · vanilla JS modules · Three.js 0.169 · GSAP 3.13 · Lenis 1.1. No
framework, no CSS library — hand-authored tokens in `:root`.
