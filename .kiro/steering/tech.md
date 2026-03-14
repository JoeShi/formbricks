# Tech Stack & Build System

## Core Stack

- Language: TypeScript (strict, across all packages)
- Framework: Next.js 16 (App Router, Turbopack for dev)
- React 19
- Styling: Tailwind CSS v3 with `tailwind-merge` and `class-variance-authority`
- Database: PostgreSQL via Prisma ORM (schema at `packages/database/schema.prisma`)
- Auth: next-auth v4 (patched)
- Validation: Zod v4
- State/Forms: react-hook-form with @hookform/resolvers
- UI primitives: Radix UI
- Rich text: Lexical editor
- Monitoring: Sentry, OpenTelemetry
- Payments: Stripe
- i18n: react-i18next with Lingo.dev for auto-translation

## Build & Package Management

- Monorepo: pnpm workspaces + Turborepo
- Node: >=20 (pinned to 22.1.0 via .nvmrc)
- Package manager: pnpm 10.30.3

## Testing

- Unit tests: Vitest + @testing-library (colocated as `*.test.ts`)
- E2E tests: Playwright (in `apps/web/playwright/`)
- Coverage: @vitest/coverage-v8
- Do NOT write unit tests for `.tsx` files — components are covered by Playwright E2E

## Common Commands

```bash
pnpm install              # Install all workspace dependencies
pnpm dev                  # Start all dev servers (Turborepo parallel)
pnpm build                # Production build for all packages/apps
pnpm lint                 # ESLint across workspace
pnpm test                 # Run Vitest suites (no cache)
pnpm test:coverage        # Vitest with coverage
pnpm test:e2e             # Playwright E2E suite
pnpm db:up                # Start Docker services (Postgres, MailHog)
pnpm db:down              # Stop Docker services
pnpm db:migrate:dev       # Apply Prisma migrations
pnpm db:seed              # Seed the database
pnpm i18n                 # Generate and validate translations
```

## Survey Package Rebuild

The `@formbricks/surveys` package compiles via Vite to UMD+ESM and copies to `apps/web/public/js/`. After changes to `packages/surveys` or its deps:

```bash
rm -rf packages/surveys/dist apps/web/public/js/surveys.* node_modules/.cache/turbo
pnpm build --filter=@formbricks/surveys... --force
```

Then hard-refresh the browser to bypass cached bundles.

## Code Style

- Prettier: 110-char width, semicolons, double quotes, sorted imports
- ESLint: shared `@formbricks/eslint-config` presets
- Two-space indentation
- Naming: PascalCase for components/module folders, camelCase for functions/variables, SCREAMING_SNAKE_CASE for constants
- Mocks go in `__mocks__` directories
