# CLAUDE.md — working on the Rovelle site

This is a static Next.js (App Router) portfolio site. Read this before making changes.

## Commands

- `npm install` — install dependencies (Node ≥ 20.9).
- `npm run dev` — dev server at http://localhost:3000.
- `npm run build` — static export into `out/`. Run this after changes to catch errors; it also type-checks.
- `npm run preview` — serve `out/` locally.
- `npm run typecheck` — TypeScript only.

## Where things are

- `content/*.json` — **all copy, lists and image paths.** Most user requests (“change the email”, “add a project”, “new team member”, “new price”) are JSON edits only. `content/index.ts` exports typed accessors (`site`, `projects`, `about`, `playground`, `carousel`, `projectBySlug`, `workHref`).
- `app/` — one folder per route: `page.tsx` (home), `work/[slug]/page.tsx`, `playground/`, `about/`, `contact/`, plus `layout.tsx` (fonts, metadata, site-wide effects) and `globals.css`.
- `components/` — `Nav` (desktop links + mobile drawer; `mode="overlay"` for full-screen pages, `mode="solid"` for scrolling pages), `FooterBar`, `Ticker`, `Accordion` (`ServiceItem`, `FaqItem`), `HomeHelix`, `PlaygroundGrid`, `SiteEffects`, `useBreakpoint`.
- `components/effects/` — the motion engines: `VortexHelix`, `PageTransition`, `InfiniteMasonry`, `SmoothScroll`. They were originally Framer code components; `framer-shim.ts` stands in for the few Framer helpers they import. Their `addPropertyControls(...)` blocks at the bottom are inert outside Framer but document every prop and its default — read them when tuning.
- `public/images/` — images grouped by section (`work/<slug>/`, `playground/`, `carousel/`, `services/`, `team/`, `about/`). `public/brand/` — logo SVG and favicons.

## Design system

- Tokens at the top of `app/globals.css`: `--cream #EEE5D9` (background), `--ink #141414`, `--muted #8A8072`, `--line`, `--pad` (page side padding), `--nav-h`.
- Fonts: Geist (`--font-geist`) for everything, Instrument Serif italic (`--font-serif`) for the expressive lines. Loaded with `next/font/google` in `app/layout.tsx`.
- Type styles are classes named `t-*` (`t-statement`, `t-statement-serif`, `t-case-title`, `t-meta`, `t-paragraph`, `t-nav-link`, …). Each has desktop, tablet and phone sizes in the media queries below it. Reuse them instead of inventing new sizes.
- Breakpoints: desktop ≥ 1200px, tablet 810–1199px, phone < 810px. CSS uses `max-width: 1199.98px` and `max-width: 809.98px`; JS uses `useBreakpoint()`.
- Section rhythm: sections are `padding-top: 140px` / `160px` on desktop, `110px` tablet, `88px` phone; side padding is `var(--pad)`.

## Conventions and gotchas

- **Static export**: `output: "export"`, `trailingSlash: true`. Internal links end with a slash (`/about/`, `/work/holla/`). No API routes, no server actions, no `next/image` optimisation (images are plain `<img>`).
- **New work page**: add an entry to `content/projects.json` with a unique `slug`; `generateStaticParams` picks it up. Order in the file = order in the Vortex and the next/previous links.
- **Page transition**: `PageTransition` (in `SiteEffects`, root layout) catches clicks on internal `<a>` links in the capture phase, paints the strokes, then calls `router.push`, and wipes away when the pathname changes. The label shown mid-transition comes from the link’s `data-transition-label` attribute, else its `aria-label`, else its text. External links, `target="_blank"`, modifier-clicks and `#hash` links are left alone. If a page doesn’t change within 2.5s it falls back to a full page load.
- **Vortex** reads `items` (image, title, category, subtitle, link) from `projects.json` via `HomeHelix`. Clicking the front card opens `link` through the transition.
- **Smooth scroll** only eases wheel/trackpad input; it steps aside inside scrollable elements and while the page is locked (e.g. the lightbox is open).
- Client components are marked `"use client"`; pages themselves are server components that only read JSON.
- Respect `prefers-reduced-motion` when adding new motion.
- Keep copy typographically tidy: curly quotes and apostrophes (’ “ ”), em dashes with spaces ( — ).

## Checklist before handing work back

1. `npm run build` passes with no errors.
2. Check the page at desktop (1440px), tablet (810px) and phone (390px) widths.
3. Click through at least one page transition and, if you touched the home page, scroll and drag the Vortex.
