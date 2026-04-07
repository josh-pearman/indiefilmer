# indieFilmer

A self-hosted film production planner for microbudget filmmakers.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is indieFilmer?

indieFilmer is an open-source production planning tool built for indie and microbudget filmmakers. It brings cast, crew, scenes, locations, scheduling, budgets, tasks, notes, gear, catering, call sheets, and scripts into a single self-hosted application. Run it locally for your team or deploy it on a VPS for remote collaboration.

## Features

**Production Office**
- Schedule -- shoot day calendar with drag-and-drop scene assignment
- Call sheets -- generate and export PDF call sheets for each shoot day
- Tasks -- track to-dos across departments with status and assignees
- Notes -- rich-text production notes with a built-in editor
- Locations -- manage filming locations with optional Google Maps integration
- Gear -- inventory and track equipment
- Catering -- plan craft services and meal counts per shoot day

**Script and Story**
- Script Hub -- upload, version, and browse scripts
- Scenes -- break down scenes with characters, locations, and notes

**Talent**
- Cast and Roles -- manage actors and the roles they play
- Crew -- crew directory with department and role assignments
- Contacts -- general contact book for vendors, agents, and collaborators

**Accounting**
- Budget -- set a total budget with category buckets (Locations, Food, Gear, Talent, Crew, Transport, Post, Misc)
- Expenses -- log individual expenses against budget buckets

**Other**
- Multi-project support -- switch between productions from a single account
- Role-based access -- admins, editors, and viewers with per-section permissions
- Three themes -- Default, Dark, and Warm
- Mobile-friendly -- responsive layout with a slide-out sidebar
- Optional AI chat -- built-in assistant powered by Claude (CLI or API)
- Backups -- one-click database and file backup from the sidebar
- Built-in docs -- in-app documentation accessible from the sidebar

## Quick Start (Local)

**Prerequisites:** Node.js 18+ and npm.

```bash
git clone https://github.com/josh-pearman/indiefilmer.git
cd indiefilmer
npm run setup
npm run dev
```

The interactive setup script will:
1. Install dependencies
2. Prompt you to create an admin account
3. Choose your database (SQLite or PostgreSQL)
4. Configure the AI assistant (Claude CLI, API key, or none)
5. Optionally enable Google Maps and email sending
6. Generate your `.env` file and set up the database

Open [http://localhost:3001](http://localhost:3001) when it finishes.

## Quick Start (Docker)

**SQLite (default):**

```bash
docker compose up
```

**With PostgreSQL:**

```bash
docker compose --profile postgres up
```

When using the Postgres profile, set `DATABASE_URL` in your `.env` to point at the `db` service:

```
DATABASE_URL=postgresql://indiefilmer:changeme@db:5432/indiefilmer
```

The app auto-detects the database provider from `DATABASE_URL` at build time. No manual configuration needed.

The app is available at [http://localhost:3001](http://localhost:3001). The `data/` directory is mounted as a volume so SQLite databases and uploads persist across restarts.

## Configuration

Copy `.env.example` to `.env` and edit it, or run `npm run setup` to generate it interactively.

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:../data/db.sqlite` | SQLite file path or a `postgresql://` connection string. The provider is auto-detected at build time. |
| `AUTH_MODE` | `password` | `password` for self-hosted (username/password) or `email` for VPS (magic links) |
| `APP_URL` | `http://localhost:3001` | Base URL used in invite links and emails |

### Auth (email mode)

| Variable | Default | Description |
|----------|---------|-------------|
| `RESEND_API_KEY` | -- | API key from [Resend](https://resend.com); required when `AUTH_MODE=email` |
| `RESEND_FROM_EMAIL` | -- | Sender address for outbound emails (e.g. `hello@indiefilmer.com`) |
| `SUPERADMIN_EMAIL` | -- | This email is auto-approved on first login |

### Chat (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `CHAT_MODE` | `off` | `off` disables the chat widget; `cli` uses the Claude CLI binary; `api` uses the Anthropic SDK |
| `ANTHROPIC_API_KEY` | -- | Required when `CHAT_MODE=api` |

### External APIs (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_MAPS_API_KEY` | -- | Enables embedded maps on location pages and call sheets |

## Tech Stack

- **Framework:** Next.js 16, React 18
- **Database:** Prisma ORM with SQLite (default) or PostgreSQL
- **Styling:** Tailwind CSS, shadcn/ui
- **PDF generation:** Puppeteer (Chromium)
- **Testing:** Playwright
- **Optional integrations:** Anthropic SDK (AI chat), Resend (email), Google Maps

## Project Structure

```
src/
  actions/       Server actions (~20 files)
  app/           Next.js app router pages
  components/    UI components (layout, shared, ui)
  lib/           Utilities, auth, chat context
prisma/          Schema and migrations
scripts/         Setup and helper scripts
content/         In-app documentation (MDX)
data/            SQLite database and uploads (gitignored)
```

## Contributing

Contributions are welcome. Please open an issue to discuss your idea before submitting a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

To report a vulnerability, please email the maintainers directly rather than opening a public issue. See [SECURITY.md](SECURITY.md) for details.

## License

MIT -- see [LICENSE](LICENSE) for the full text.
