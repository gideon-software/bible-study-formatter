# Bible Study Formatter (BSF) 📖

A modern full-stack web application built with **Next.js 16 (App Router)**, **TypeScript**, **Neon Serverless Postgres**, and the **Google Docs API**.

It formats Scripture passages into beautifully styled Google Docs with customizable typography, margins, superscripts, verse numbering, and poetry indentation—saved directly into the user's personal Google Drive.

---

## Features

- **Google Drive Direct Integration**: Connects via Google OAuth 2.0 (`drive.file` scope) to create and format Google Docs directly in the user's Drive.
- **Official Scripture API**: Integrates with the official Crossway ESV API (`api.esv.org`) for rock-solid semantic HTML parsing with zero scraping brittleness. Designed with a flexible `BibleProvider` pattern ready for YouVersion Platform API (CSB, NIV).
- **Live Document Preview**: Real-time simulation of the generated Google Doc showing fonts, line-spacing, superscripts, title pages, and chapter headings.
- **Neon Serverless Postgres**: Tracks executions, missing element anomalies, and caches parsed chapters for sub-second responses.
- **Admin & Usage Intelligence (`/admin`)**:
  - Monthly active user & document generation trend charts (replicating the Google Sheet's *Execution Summary*).
  - Top 10 most popular Bible books ranking.
  - Multi-chapter vs single-chapter generation ratio.
  - Interactive Daily Canary health check trigger.
  - Recent generation logs.
- **Dual Alert System**: Instant notification via Discord/Slack Webhooks and transactional email via Resend when errors or unhandled classes occur.
- **Daily Canary Health Check**: Automated daily GitHub Action workflow (`.github/workflows/canary.yml`) verifying Scripture API integrity.
- **Modern Vanilla CSS Design**: Sleek glassmorphism cards, responsive grid, dynamic animations, and Dark/Light mode.

---

## Project Structure

```
├── .github/workflows/
│   ├── canary.yml            # Daily automated health check workflow
│   └── deploy.yml            # Legacy Google Apps Script deploy workflow
├── legacy-gas/               # Preserved original Google Apps Script codebase
├── src/
│   ├── app/
│   │   ├── admin/            # Admin intelligence dashboard (/admin)
│   │   ├── api/
│   │   │   ├── admin/stats/  # Admin reporting aggregations
│   │   │   ├── auth/google/  # Google OAuth login, callback, status, logout
│   │   │   ├── cron/canary/  # Daily canary check endpoint
│   │   │   └── generate/     # Core Google Doc generation endpoint
│   │   ├── globals.css       # Design system tokens, glassmorphism, responsive styles
│   │   ├── layout.tsx        # Root layout, metadata, and fonts
│   │   └── page.tsx          # Main interactive Formatter application
│   └── lib/
│       ├── alerts/           # Discord/Slack webhook and Resend email dispatcher
│       ├── bible/            # Bible metadata, books array, and ESV API parser
│       │   ├── books.ts      # 66 books metadata and formatting types
│       │   ├── books.test.ts # Unit tests for books metadata
│       │   └── providers/    # Crossway ESV provider with unit tests
│       ├── db/               # Drizzle ORM schema and Neon Postgres client
│       └── google/           # Google OAuth 2.0 and Google Docs API batchUpdate builder
│           ├── auth.ts       # OAuth token exchange and user info
│           ├── docs.ts       # Google Docs API request builder
│           └── docs.test.ts  # Unit tests for batchUpdate requests
├── .env.example              # Environment variables template
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
Fill in your Google OAuth credentials, ESV API key, and Neon Database URL. (See [Setup Checklist](file:///C:/Users/hallm/.gemini/antigravity-ide/brain/6b3e4bb3-991d-4c95-a49e-e4494c819cbf/setup_checklist.md) for full instructions).

### 3. Run Automated Tests
```bash
npm test
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) for the main Formatter or [http://localhost:3000/admin](http://localhost:3000/admin) for the Admin Dashboard.

---

## Production Deployment to Vercel

1. Push this branch to GitHub:
   ```bash
   git push -u origin feature/nextjs-standalone-app
   ```
2. Import the repository in [Vercel](https://vercel.com).
3. Add the environment variables from `.env.local` to the Vercel project settings.
4. Deploy!
