# Project Structure

Formbricks is a pnpm + Turborepo monorepo with two apps and shared packages.

## Top-Level Layout

```
apps/
  web/          — Main Next.js application (App Router)
  storybook/    — Storybook for UI component development
packages/
  database/     — Prisma schema, migrations, and DB client
  types/        — Shared TypeScript types (@formbricks/types)
  js-core/      — JavaScript SDK core for in-app/website surveys
  surveys/      — Survey renderer (Vite → UMD+ESM, copied to web/public/js/)
  survey-ui/    — Survey UI components used by the renderer
  cache/        — Caching utilities (Redis + request-level)
  email/        — Email templates and sending logic
  logger/       — Shared logging (pino-based)
  storage/      — File storage abstraction (S3, local)
  i18n-utils/   — Translation scanning and validation
  config-eslint/      — Shared ESLint config
  config-prettier/    — Shared Prettier config
  config-typescript/  — Shared tsconfig presets
  vite-plugins/       — Custom Vite plugins
docker/         — Docker Compose and Dockerfiles for deployment
docs/           — Product documentation (Mintlify MDX)
helm-chart/     — Kubernetes Helm chart
```

## Web App (`apps/web/`)

### Route Layer — `app/`

Uses Next.js App Router with route groups:

- `(app)/` — Authenticated app routes (dashboard, surveys, settings)
- `(auth)/` — Auth pages (login, signup, forgot password)
- `(redirects)/` — Legacy URL redirects
- `api/` — API route handlers (v1 management + client APIs)
- `s/` — Public survey link pages (embeddable, no X-Frame-Options)
- `c/` — Contact survey link pages (also embeddable)
- `setup/` — Initial instance setup wizard
- `health/` — Health check endpoint

### Feature Modules — `modules/`

Domain-driven feature modules, each with a consistent internal structure:

```
modules/{feature}/
  components/   — React components (PascalCase folders)
  lib/          — Business logic, service functions, and colocated tests
  hooks/        — Custom React hooks
  types/        — Feature-specific types
  actions.ts    — Server actions
  page.tsx      — Page component (if routable)
  loading.tsx   — Loading skeleton
```

Key modules: `survey/`, `auth/`, `billing/`, `organization/`, `analysis/`, `integrations/`, `ui/`, `ee/` (enterprise-only features)

### Shared Services — `lib/`

Cross-cutting utilities and service wrappers: auth, caching, crypto, environment config, i18n, JWT, response helpers, time utilities.

### Conventions

- Server actions return `{ data }` or `{ error }` consistently
- Unit tests sit next to source files as `*.test.ts`
- Mocks go in `__mocks__/` directories
- Enterprise code lives in `modules/ee/` under a separate license
- All data is scoped by Organization or Environment (multi-tenancy)
- Translations live in `locales/` with `en-US.json` as the source of truth
