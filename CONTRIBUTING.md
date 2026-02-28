# Contributing to indieFilmer

Thanks for your interest in contributing. This guide covers everything you need to get up and running.

## Getting Started

### Prerequisites

- **Node.js 20+** and **npm**
- Git

### Setup

```bash
git clone https://github.com/your-org/indiefilmer.git
cd indiefilmer
npm run setup
```

The setup script will:
1. Install dependencies
2. Run database migrations
3. Prompt you to create an admin account
4. Generate a `.env` file

If you prefer manual setup, copy `.env.example` to `.env` and fill in the values, then:

```bash
npm install
npx prisma migrate deploy
npx prisma generate
```

### Environment Variables

At minimum you need:

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `file:../data/db.sqlite` | SQLite path |
| `AUTH_MODE` | `password` | Use `password` for local dev |
| `CHAT_MODE` | `off` | `off`, `cli`, or `api` |

See `.env.example` for the full list (Google Maps, Resend, Anthropic API key, etc.).

## Development

```bash
npm run dev
```

Opens at [http://localhost:3001](http://localhost:3001).

### Project Structure

```
src/
  app/          # Next.js App Router (routes and pages)
    production/ # Schedule, tasks, notes, locations, gear, catering
    script/     # Script hub, scenes, color-coded script
    talent/     # Cast, crew, contacts
    accounting/ # Budget, expenses
    settings/   # Project and account settings
    api/        # API routes (chat, health, etc.)
  actions/      # Server actions (~20 files, one per domain)
  components/   # React components (shared UI)
  lib/          # Utilities, auth, logger, constants
prisma/
  schema.prisma # Database schema
  migrations/   # Migration history
e2e/            # Playwright end-to-end tests
scripts/        # Setup and build scripts
```

## Code Conventions

### Logging

Use the structured logger instead of `console.log`:

```ts
import { createLogger } from "@/lib/logger";
const logger = createLogger("my-module");

logger.info("Something happened", { key: "value" });
logger.error("Something failed", { error: err });
```

The logger outputs human-readable text in development and JSON in production. Levels: `debug`, `info`, `warn`, `error`.

### Server Actions

Server actions live in `src/actions/` and return `{ error?: string }` on failure. Always check the result:

```ts
const result = await someAction(data);
if (result?.error) {
  toast.error(result.error);
  return;
}
```

Use `sonner` toasts (`toast.error()`, `toast.success()`) for user-facing feedback.

### Soft Deletes

Records use a soft-delete pattern. Set `isDeleted: true` instead of deleting rows, and clean up any join/pivot rows:

```ts
await prisma.castMember.update({
  where: { id },
  data: { isDeleted: true },
});
// Also remove from join tables (e.g., scene assignments)
```

### Tenant Isolation

All database queries **must** scope by `projectId`. Never query without it:

```ts
// Correct
await prisma.scene.findMany({ where: { projectId, isDeleted: false } });

// Wrong -- leaks data across projects
await prisma.scene.findMany({ where: { isDeleted: false } });
```

## Database

- **ORM:** Prisma with SQLite (PostgreSQL supported for VPS deployments)
- **Schema:** `prisma/schema.prisma`

After editing the schema:

```bash
npx prisma migrate dev --name describe-your-change
npx prisma generate
```

`migrate dev` creates a new migration file and applies it. `generate` regenerates the Prisma client so TypeScript picks up the changes.

## Testing

End-to-end tests use Playwright and live in `e2e/`:

```bash
npx playwright test            # headless
npx playwright test --headed   # watch in browser
npx playwright test --ui       # interactive UI
```

Tests are numbered by feature (`00-auth`, `01-dashboard`, `02-cast`, etc.).

## Pull Requests

- Keep PRs focused on a single change.
- Describe **what** changed and **why** in the PR description.
- Make sure TypeScript compiles cleanly:
  ```bash
  npx tsc --noEmit
  ```
- Run the linter: `npm run lint`
- If you changed the schema, include the migration file in your PR.

## License

This project is licensed under the [MIT License](LICENSE).
