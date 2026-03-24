# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS, shadcn/ui, Recharts

## ALERYAF HUB — System Description

Arabic RTL business ERP-style control panel for daily business monitoring. Split into two logical systems:

### Invoice System (مصدر البيانات)
Data entry pages — the source of truth for invoices, items, and branches:
- **الفواتير** — Invoice list with currency filter and pagination
- **المنتجات** — Item master list with alias management (NO manual stock editing)
- **إدارة الفروع** — Branch CRUD

### Analytics Hub (مركز التحليل)
Read-only dashboards and analytics:
- **لوحة التحكم** — Executive Dashboard: TRY/USD separated KPIs, daily sales chart, filters
- **تحليل الفروع** — Branch Analytics: Compare branches, contribution %, revenue per branch
- **تحليل الأرباح** — Profit Analysis: Revenue vs cost, margins, monthly chart, top items
- **المخزون** — Inventory: Derived stock view (opening balance - sold after import), low-stock alerts

### Key Architecture Rules
- **NEVER mix TRY and USD** in calculations — always separate by currency
- **Inventory is DERIVED**: `currentStock = latestImportBalance - soldAfterImportDate`. Never stored statically.
- **Item matching pipeline**: code → exact name → Arabic name → alias → fuzzy partial match
- **Arabic RTL UI** throughout with responsive design (desktop sidebar + mobile bottom nav)
- **Dense, data-first layout**

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── aleryaf-hub/        # React + Vite frontend (Arabic RTL ERP)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
│   └── src/seed.ts         # Database seeding script
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- `branches` — Branch list (name, code, isActive)
- `items` — Product master list (code, name, nameAr, category, cost/price in TRY & USD)
- `item_aliases` — Alias mappings for messy invoice data (typos, duplicates)
- `invoices` — Invoice headers (branch, currency TRY/USD, totals, date)
- `invoice_items` — Invoice line items (quantity, price, cost, itemId link, rawName)
- `inventory_imports` — Daily inventory import sessions
- `inventory_import_rows` — Individual rows from each import (matched flag, itemId link)

### Derived Inventory Logic
Stock is computed at query time via SQL:
1. Find latest import row per item (by import_date DESC, import_id DESC)
2. Sum invoice_items sold after that import date
3. `currentStock = openingBalance - soldAfterImport`
Both `/api/inventory` and `/api/dashboard/kpis` use `DISTINCT ON` with same ordering for consistency.

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## API Routes

All routes are under `/api`:
- `GET /api/healthz` — health check
- `GET /api/dashboard/kpis` — executive KPIs (derived inventory values)
- `GET /api/dashboard/daily-sales` — daily sales chart data
- `GET/POST /api/branches` — branch list/create
- `PUT/DELETE /api/branches/:id` — branch update/delete
- `GET /api/branches/analytics` — branch comparison analytics
- `GET/POST /api/invoices` — invoice list/create (search param, create resolves items via alias pipeline)
- `GET/PUT/DELETE /api/invoices/:id` — invoice detail/update/delete (PUT uses DB transaction)
- `GET/POST /api/items` — item list/create (no manual stock field)
- `PUT/DELETE /api/items/:id` — item update/delete
- `GET/POST /api/items/:id/aliases` — item alias management
- `DELETE /api/items/aliases/:aliasId` — delete alias
- `GET /api/inventory` — derived inventory state
- `POST /api/inventory/import` — daily inventory import (matches via alias pipeline)
- `GET /api/inventory/imports` — import history
- `GET /api/profit/analysis` — profit analysis
- `GET /api/profit/by-item` — profit by item breakdown

## Seeding

Run: `pnpm --filter @workspace/scripts run seed`

Seeds 3 branches, 8 items, and ~105 invoices (3 months of sample data).

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. All routes in `src/routes/`.
- Entry: `src/index.ts`
- App setup: `src/app.ts`
- Depends on: `@workspace/db`, `@workspace/api-zod`

### `artifacts/aleryaf-hub` (`@workspace/aleryaf-hub`)

React + Vite frontend. Arabic RTL ERP dashboard.
- Uses: `@workspace/api-client-react` for generated hooks
- Libraries: recharts, react-hook-form, date-fns, zod
- Layout: responsive sidebar (desktop) + bottom nav (mobile)
- Number formatting: All numbers use English digits (en-US locale) via `lib/format.ts`
- Invoice printing: Print/PDF via `lib/print-invoice.ts` — opens print window synchronously to avoid popup blocking, renders clean RTL HTML with escaped user content, triggers browser print dialog

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.
- `pnpm --filter @workspace/db run push` — push schema changes

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI spec and codegen config.
- Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks from OpenAPI spec.

### `scripts` (`@workspace/scripts`)

Utility scripts. Run via `pnpm --filter @workspace/scripts run <script>`.
