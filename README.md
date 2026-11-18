# Rovelle — studio portfolio template

A motion-first portfolio for an independent design studio. Five pages, a CMS-style content folder, and the effects that make it feel alive:

- **Vortex** — a 3D spiral of project cards on the home page that you scroll, drag or swipe, with a long, soft glide.
- **Brush-stroke page transitions** — three wide strokes paint the screen, show the destination's name, and wipe away on the next page. Different every time.
- **Smooth scrolling** — eased mouse-wheel and trackpad scrolling (touch stays native).
- **Infinite masonry** — the Playground repeats endlessly, with per-column parallax, soft edge blur and a click-to-enlarge lightbox.
- **Tickers, accordions and a mobile drawer menu** — plus pinned columns, hover states and fully responsive layouts for desktop, tablet and phone.

Built with **Next.js (App Router) + React + TypeScript**, plain CSS, no UI libraries. It exports to a fully static site you can host anywhere.

---

## Quick start

You need **Node.js 20.9 or newer**.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

> Using Claude Code? Open this folder and ask: *“Run the site locally”*. Everything Claude needs is in `CLAUDE.md`.

## Build and deploy

```bash
npm run build      # creates a static site in /out
npm run preview    # serves /out locally to check the production build
```

Upload the `out` folder to any static host — Vercel, Netlify, Cloudflare Pages, GitHub Pages, S3. On Vercel or Netlify you can also just connect the repo: the build command is `npm run build` and the output directory is `out`.

This repository deploys to Vercel through GitHub Actions when a commit is pushed to `main`. The workflow builds the static site, packages `out/` as a Vercel deployment, and uploads it. The Vercel project's Git integration does not need to be enabled. It needs the repository secrets `VERCEL_TOKEN` (scoped to this project), `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`.

Before going live, set your domain in `content/site.json` → `"url"` (used for social share images).

## Pages

| Page | Route | What’s on it |
|---|---|---|
| Home | `/` | Vortex of projects, studio intro, “We design *what moves.*” |
| Work | `/work/<slug>/` | One page per project: pinned details, cover, story, gallery grids, more projects |
| Playground | `/playground/` | Infinite masonry of explorations with lightbox |
| About | `/about/` | Principles, numbers, clients ticker, services, awards, team, pricing, featured project, FAQ |
| Contact | `/contact/` | One-screen contact page with an image ticker, details and a “Schedule a call” button |

## Make it yours

All text and lists live in `content/` — edit the JSON, save, and the site updates.

| File | Controls |
|---|---|
| `content/site.json` | Studio name, intro, nav, button, footer, home/playground/contact copy, email, phone, address, booking link |
| `content/projects.json` | Work projects: title, category, subtitle, year, services, story text, cover, two wide images, two 4-image galleries |
| `content/about.json` | Everything on the About page: statement, stats, services, awards, team, plans, FAQ, featured project |
| `content/playground.json` | Playground explorations (title, category, image) |
| `content/carousel.json` | Images in the contact-page ticker |

**Images** are in `public/images/…`. Replace a file with your own (keep the name), or add new files and update the paths in the JSON. Landscape works best for project covers; any ratio works in the Playground.

**Brand**: the logo is `public/brand/rovelle.svg` (nav + About footer), favicons are `public/brand/favicon.png` and `favicon-dark.png`. Colours and fonts are set at the top of `app/globals.css`.

**Projects**: copy an entry in `projects.json`, give it a new `slug` (that becomes the URL), and fill in the fields. It appears automatically in the Vortex, the About ticker and the “More projects” links.

## Tuning the effects

| Effect | Where | Common settings |
|---|---|---|
| Vortex | `components/HomeHelix.tsx` | `size`, `cardsPerTurn`, `tilt`, `glide` (seconds of glide after a scroll or drag), per-breakpoint values at the top |
| Page transition | `components/SiteEffects.tsx` | `strokes`, `randomness`, `coverDuration`, `hold`, `revealDuration`, colours |
| Smooth scroll | `components/SiteEffects.tsx` | `smoothness` (lower = floatier), `speed` |
| Playground grid | `components/PlaygroundGrid.tsx` | `columns`, `parallax`, `edgeTop`/`edgeBottom` blur, card colours |
| Tickers | `app/contact/page.tsx`, `app/about/page.tsx` | `duration` (seconds per loop) |

Visitors who turn on “Reduce motion” in their system settings get the site without the transition and with paused tickers.

## Project structure

```
app/                 Pages (App Router) and the global stylesheet
components/          Nav, footer, tickers, accordions, page wrappers
components/effects/  The motion components (Vortex, transition, masonry, smooth scroll)
content/             All copy and lists as JSON
public/              Images, logo, favicons
```

## Licence and assets

See `ASSETS.md` for where every image and font comes from and what you need to check before reselling. Replace the placeholder studio details (names, team, prices, phone, address) with real ones before launch.
