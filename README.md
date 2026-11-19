# Rovelle — studio portfolio template

A motion-first portfolio for an independent design studio. Five pages, a CMS-style content folder, and the effects that make it feel alive:

- **Vortex** — a 3D spiral of project cards on the home page that you scroll, drag or swipe, with a long, soft glide.
- **Brush-stroke page transitions** — three wide strokes paint the screen, show the destination's name, and wipe away on the next page. Different every time.
- **Smooth scrolling** — eased mouse-wheel and trackpad scrolling (touch stays native).
- **Infinite masonry** — the Playground repeats endlessly, with per-column parallax, soft edge blur and a click-to-enlarge lightbox.
- **Tickers, accordions and a mobile drawer menu** — plus pinned columns, hover states and fully responsive layouts for desktop, tablet and phone.

Built with **Next.js (App Router) + React + TypeScript**. The site and CMS run on Vercel.

---

## Quick start

You need **Node.js 20.9 or newer**.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The local CMS is at http://localhost:3000/cms/.

## CMS

Framer의 8개 컬렉션(Projects, Playground, Contact Carousel, Services, Awards, Team, Plans, FAQ)을 이 저장소의 콘텐츠 파일에서 편집할 수 있습니다. 항목 추가·복제·삭제·순서 변경, 초안/공개 전환, 이미지 업로드, 프로젝트 본문 편집을 지원합니다.

`.env.example`을 참고해 `.env.local`에 `CMS_ACCESS_CODE`를 설정하면 `/cms/`에서 접속 코드로 로그인할 수 있습니다. 현재 작업 공간에는 사용자가 설정한 코드가 들어 있으며 `.env.local`은 Git에서 제외됩니다.

로컬에서는 CMS 저장 내용이 `content/*.json`과 `public/images/cms/`에 기록됩니다. 배포된 CMS는 Vercel의 비공개 Blob 저장소에 저장하고, 공개 사이트는 이 콘텐츠를 바로 읽습니다. 첫 온라인 저장 전에는 Git에 들어 있는 JSON을 표시합니다. 첫 온라인 저장 이후에는 Blob 콘텐츠가 우선하며, Git의 JSON 수정만으로 온라인 콘텐츠를 덮어쓰지 않습니다.

초안은 공개 사이트에서 보이지 않습니다. CMS는 Framer 프로젝트와 동기화되지 않습니다. 온라인 이미지 업로드 한도는 4MB입니다. CMS 코드 변경은 Git 커밋 후 `main`에 푸시하면 GitHub Actions가 Vercel에 배포합니다. 접속 코드는 Vercel의 `CMS_ACCESS_CODE` 프로덕션 비밀 환경변수로 설정합니다.

> Using Claude Code? Open this folder and ask: *“Run the site locally”*. Everything Claude needs is in `CLAUDE.md`.

## Build and deploy

```bash
npm run build      # creates the production Next.js build
npm run preview    # runs the production server locally
```

The CMS API and live content pages require a Node.js server. This repository is configured for Vercel Functions and Vercel Blob.

This repository deploys to Vercel through GitHub Actions when a commit is pushed to `main`. The workflow builds and deploys the site, so the Vercel project's Git integration does not need to be enabled. It needs the repository secrets `VERCEL_TOKEN` (scoped to the `ugen's projects` team), `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. Renew the token before November 19, 2027.

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

The repository's default text and lists live in `content/`. Local CMS edits update these files. Online CMS edits live in Vercel Blob.

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
