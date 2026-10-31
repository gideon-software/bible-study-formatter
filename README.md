# Bible Study Formatter (BSF) 📖

A modern full-stack web application built with **Next.js 16 (App Router)**, **TypeScript**, **Drizzle ORM**, **Neon Serverless Postgres**, and the **Google Docs & Drive APIs**.

It formats Scripture passages into cleanly styled Google Docs with customizable typography, 0.5" margins, superscript verse numbers, section headings, title pages, and poetic/liturgical formatting—saved directly into the user's personal Google Drive.

---

## Features

- **Google Docs & Drive Direct Integration**:
  - Connects via Google OAuth 2.0 (`documents` + `drive.file` scopes) with HMAC-SHA256 signed session cookies and automatic OAuth token refresh.
  - Creates and formats Google Docs directly in the user's Drive (`Bible Study/` folder by default).
  - Automatically timestamps earlier drafts in Google Drive (`[Oct 29 @ 6:12am]`) when re-generating the same passage so the latest version always has the clean title.
- **5 Bible Translations Across 3 Official APIs**:
  - **ESV** (*English Standard Version*) via Crossway ESV API (`api.esv.org`), including automatic enforcement of Crossway's 500-verse / half-book policy and rolling 500-verse cache pruning.
  - **CSB** (*Christian Standard Bible*), **NIV** (*New International Version*), and **NASB** (*New American Standard Bible 2020*) via American Bible Society's `api.bible`.
  - **NET** (*New English Translation*) via `labs.bible.org`.
- **Rich Literary & Poetic Formatting**:
  - 4-space primary and 8-space continuation poetic line indentation across OT Psalms/Prophets and NT Old Testament quotations.
  - Preserves canonical Psalm superscriptions (`psalm-title` / `.d` / `.psasuper`) in italics and renders the divine name (`LORD`) in uppercase.
  - Preserves Song of Solomon speaker labels (`.speaker` / `.sp` / `.sosspeaker`) and Psalm 119 / Lamentations Hebrew acrostic headings in **bold** even when general section headings are turned off.
  - Supports centered inscriptions (`.pc`), right-aligned liturgical refrains (`.qr` / `.pmr`), italicized transliterations (`.tl`), and indented embedded letters/decrees (`.pi` / `.pm` / `.li1`–`.li4`).
- **Saved Personal Defaults, Shareable Links & Document History**:
  - Persists user default version, formatting options, and last-used passage across `localStorage` and Neon Postgres (`user_preferences`).
  - Supports pre-filled URL query parameters (`?v=CSB&book=Romans&start=8&end=8&headings=1`) and one-click **Copy BSF link** sharing.
  - Collapses earlier trial runs of the same passage into an expandable group with formatting-diff badges and one-click **Move to Google Drive Trash** (single doc or all earlier runs).
- **Live Document Preview & Theme Modes**:
  - Real-time paper preview reflecting font family, font size, line spacing, verse numbers, headings, and title page.
  - System, Light, and Dark theme toggle (`next-themes` / custom theme provider).
- **Admin & Usage Intelligence (`/admin`)**:
  - **Exclude / Include Admin Runs** toggle so administrator testing never skews user metrics.
  - **Historical v1 + v2.0+ Analytics**: Includes 1,277+ imported historical runs (2021–present) alongside v2.0+ executions, with a one-click **Sync Legacy Sheet** action.
  - **Monthly (Last 12) & Yearly (2021–Present)** generation trend charts.
  - **Translation Breakdown**, **Top Requested Books**, **Formatting Options Adoption**, and **Top Signed-In Users**.
  - **Bible AST Cache Manager**: Inspect cached chapter counts by translation and purge individual translations or the entire cache in one click.
  - **Multi-Provider Canary Check**: Parallel live health check across Crossway ESV, API.Bible (CSB), and NET Bible (`labs.bible.org`).
- **Dual Alert System**: Parallel notifications via Discord/Slack Webhooks and Resend transactional email when API or parser anomalies occur.

---

## Project Structure

```text
├── .github/workflows/
│   └── canary.yml                  # Daily automated health check workflow
├── src/
│   ├── app/
│   │   ├── admin/                  # Admin & Usage Intelligence dashboard (/admin)
│   │   ├── api/
│   │   │   ├── admin/stats/        # Admin analytics, cache purge & legacy sheet sync
│   │   │   ├── auth/
│   │   │   │   ├── callback/google/# OAuth 2.0 callback handler
│   │   │   │   └── google/         # Login, status, and logout endpoints
│   │   │   ├── cron/canary/        # Multi-provider canary health check endpoint
│   │   │   ├── generate/           # Core Google Doc generation & AST caching endpoint
│   │   │   └── user/
│   │   │       ├── history/        # User document history & Google Drive trash endpoint
│   │   │       └── preferences/    # User saved defaults & last-passage sync
│   │   ├── globals.css             # Design system tokens, glassmorphism, responsive styles
│   │   ├── layout.tsx              # Root layout, metadata, and fonts
│   │   └── page.tsx                # Main interactive Formatter application
│   ├── components/
│   │   ├── GoogleLogo.tsx          # Official 4-color Google G SVG mark
│   │   ├── ThemeToggle.tsx         # System / Light / Dark segmented theme control
│   │   └── UserDropdown.tsx        # Authenticated user profile menu & history trigger
│   └── lib/
│       ├── alerts/
│       │   └── notify.ts           # Parallel DB, Discord/Slack webhook & Resend alerts
│       ├── bible/
│       │   ├── books.ts            # 66 books metadata, formatting types & ESV policy rules
│       │   ├── books.test.ts       # Unit tests for books metadata & policy validation
│       │   ├── rateLimit.ts        # Per-user concurrency & rolling window rate limiter
│       │   ├── rateLimit.test.ts   # Unit tests for rate limiting
│       │   ├── urlParams.ts        # Shareable URL query parser & builder
│       │   ├── urlParams.test.ts   # Unit tests for URL parameter parsing
│       │   ├── verseCounts.ts      # Per-chapter verse counts for all 66 books
│       │   └── providers/          # ESV, API.Bible (CSB/NIV/NASB), and NET parsers + tests
│       ├── db/
│       │   ├── index.ts            # Neon Serverless Postgres + Drizzle client
│       │   └── schema.ts           # Drizzle schema & indexes (executions, bible_cache, etc.)
│       └── google/
│           ├── auth.ts             # Google OAuth 2.0, token refresh & HMAC cookie signing
│           ├── auth.test.ts        # Unit tests for signed session cookies & admin checks
│           ├── docs.ts             # Google Docs batchUpdate builder & Drive folder/trash helpers
│           └── docs.test.ts        # Unit tests for Google Docs batchUpdate requests
├── .env.example                    # Environment variables template
└── package.json
```

---

## Quickstart (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Google OAuth credentials, `ESV_API_KEY`, `API_BIBLE_KEY`, and Neon `DATABASE_URL` in `.env.local`.

### 3. Run Automated Unit Tests & Linter
```bash
npm test
npm run lint
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) for the main Formatter or [http://localhost:3000/admin](http://localhost:3000/admin) for the Admin Dashboard.

---

## Production Deployment to Vercel

1. Push your branch to GitHub.
2. Import the repository in [Vercel](https://vercel.com).
3. Add the environment variables from [`.env.example`](file:///c:/Users/hallm/Dev/GSS/bible-study-formatter/.env.example) to the Vercel project settings.
4. Deploy!
