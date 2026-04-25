# Ledger

Ledger is a production-minded monorepo for a secure knowledge base platform with public and internal content on the same foundation.

This repository currently ships a real MVP foundation:

- React frontend with public browsing, sign-in, search, page viewing, feedback, dashboard, and basic branding settings
- Node.js API with local auth, HTTP-only cookie sessions, RBAC-aware page visibility, revisioned Markdown pages, search logging, feedback, webhooks, integrations config, MCP tools, and local attachment storage
- PostgreSQL schema and seed data for the core entities
- Redis-backed worker for async jobs
- Docker Compose for local development
- Basic tests for permission logic, markdown sanitization, auth helpers, search matching, webhook signing, and key HTTP flows

## Fresh install behavior

Ledger starts with real setup, not demo accounts.

- `docker compose up` now runs a single `bootstrap` container that installs dependencies once into a shared Docker volume
- PostgreSQL and Redis stay internal to the Compose network by default
- The first browser visit takes you to a setup screen where you create:
  - the initial owner account
  - the site name and brand color
  - the footer text
  - the initial public knowledge base toggle
- After setup, the instance is ready for real configuration, integrations, and content

## Monorepo layout

- `apps/web`: React frontend
- `apps/api`: Express API, migrations, seed data, tests
- `apps/worker`: Redis/BullMQ worker
- `packages/shared`: shared contracts and RBAC helpers
- `infra/postgres`: database bootstrap
- `storage/uploads`: local-first attachment storage

## MVP scope implemented

Working vertical slices:

- Public and internal spaces/pages
- Secure backend permission checks for page reads and search results
- Local email/password auth with HTTP-only cookies
- Built-in roles and group-aware restricted pages
- Revisioned Markdown pages with sanitized HTML rendering and table of contents
- Feedback capture with analytics visibility
- Search logging and no-result webhook event generation
- Basic admin settings for branding
- Webhook configuration and queued delivery records
- Local attachment upload metadata + file persistence
- MCP endpoint for search, page read, space listing, metadata lookup, and draft creation

Large areas intentionally left at foundation level for follow-up work:

- OIDC and optional OAuth provider handlers
- SMTP delivery workflows and branded email templates
- Full import/sync pipelines for GitHub, Google Docs, and bulk Markdown
- External AI provider adapters
- Full webhook delivery execution and retries
- Rich editor UX, revision diff UI, and attachment browser UI

Those features already have schema support and API/config footholds where appropriate, but the MVP prioritizes a secure core over placeholder-heavy surface area.

## Local development

1. Copy `.env.example` to `.env`
2. Start the stack:

```bash
docker compose up
```

Services:

- Frontend: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:4000](http://localhost:4000)
- Postgres: internal-only in Docker Compose
- Redis: internal-only in Docker Compose

On first boot, open the frontend and complete the setup wizard.

## Without Docker

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
npm run dev:worker
```

## Important endpoints

- `POST /api/auth/login`
- `GET /api/auth/session`
- `GET /api/spaces`
- `GET /api/pages/space/:spaceKey`
- `GET /api/pages/slug/:slug`
- `POST /api/pages`
- `GET /api/search?q=...`
- `POST /api/feedback`
- `GET /api/settings/public`
- `GET /api/settings/admin`
- `PUT /api/settings/branding`
- `GET /api/admin/search-analytics`
- `GET /api/admin/feedback`
- `POST /api/attachments`
- `GET /api/webhooks`
- `POST /api/webhooks`
- `GET /api/integrations`
- `POST /api/integrations`
- `POST /api/ai/answers`
- `POST /api/mcp`

## Tests

```bash
npm test
```

## Security defaults in this foundation

- Backend-enforced permission checks
- Sanitized Markdown rendering
- Secure password hashing with bcrypt
- HTTP-only session cookies
- Rate limiting on auth and search endpoints
- Audit log records for key admin/editor actions
- Secrets sourced from environment variables

## Next recommended steps

1. Add OIDC and optional OAuth callback flows.
2. Replace the MVP AI fallback with a provider adapter interface and citation-aware answer generation.
3. Execute real webhook deliveries with retry and signing headers.
4. Add multipart attachment uploads and an attachment picker in the editor.
5. Expand admin UI for users, groups, roles, webhooks, and integrations.
