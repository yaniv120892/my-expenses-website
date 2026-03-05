# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monorepo for an expense management system with AI-powered categorization. Uses npm workspaces to manage 4 TypeScript packages plus 1 Python microservice.

## Repository Structure

| Service | Tech Stack | Port | Purpose |
|---------|-----------|------|---------|
| `my-expenses-api` | Express + TypeScript + Prisma + PostgreSQL | 3001 | Backend REST API |
| `my-expenses-website` | Next.js 15 (App Router) + React 19 + MUI 7 | 3000 | Frontend web app |
| `expense-categorizer` | Python + FastAPI + FastText | 8000 | ML categorization microservice |
| `excel-extraction-service` | Express + TypeScript + Gemini AI | 3000 | Excel parsing microservice |
| `credit-card-expenses-extractor` | TypeScript + Playwright | CLI | Credit card statement automation |

## Common Commands

### Root (npm workspaces)
```bash
npm run dev:api          # Start API dev server
npm run dev:website      # Start website dev server
npm run dev:excel        # Start excel extraction dev server
npm run dev:extractor    # Start credit card extractor
npm run build:api        # Build API
npm run build:website    # Build website
```

### my-expenses-api
```bash
cd my-expenses-api
npm run watch            # Dev with hot reload (nodemon + ts-node)
npm run dev              # Dev without hot reload
npm run build            # rimraf dist && prisma generate && tsc
npm run lint             # eslint --fix
npm run format           # prettier --write
npm run ts.check         # TypeScript type check only
```

### my-expenses-website
```bash
cd my-expenses-website
npm run dev              # Next.js dev with Turbopack
npm run build            # next build
npm run lint             # next lint
```

### expense-categorizer
```bash
cd expense-categorizer
source venv/bin/activate       # or: source test_env/bin/activate
uvicorn api_v2:app --reload    # Dev server
python train_v2.py             # Retrain ML model
python translate.py            # Run translation pipeline
```

### excel-extraction-service
```bash
cd excel-extraction-service
npm run dev              # ts-node-dev with hot reload
npm run build            # tsc
npm run lint             # eslint
```

### credit-card-expenses-extractor
```bash
cd credit-card-expenses-extractor
npm run dev              # ts-node src/main.ts
npm run debug            # Debug selectors tool
```

## Architecture

### my-expenses-api — Layered Architecture
- **Routers** (`src/routers/`) — Route definitions, mounted under `/api/`
- **Controllers** (`src/controllers/`) — Request validation, response formatting
- **Services** (`src/services/`) — Business logic, orchestration
- **Repositories** (`src/repositories/`) — Prisma database queries
- **Validators** (`src/validators/`) — Custom validation using `class-validator`
- **Middlewares** (`src/middlewares/`) — JWT auth, request validation, error handling
- **Providers** (`src/providers/`) — AI service implementations (Gemini, ChatGPT)

Key patterns:
- `handleRequest()` utility wraps async route handlers with error propagation
- AI provider selected via `AI_PROVIDER` env var, factory pattern in `src/services/ai/`
- JWT auth with Redis session storage (Upstash)
- Prisma with field encryption (`prisma-field-encryption`) for sensitive data
- Telegram bot integration via webhooks (`src/commandHandlers/`)

### my-expenses-website — Next.js App Router
- **Pages** in `src/app/` — login, signup, verify, main tab-based home page
- **Tabs** in `src/app/tabs/` — Transactions, Pending, Scheduled, Trends, Settings, Imports
- **Components** in `src/components/`
- **Hooks** in `src/hooks/` — TanStack React Query wrappers with query key factory pattern
- **Services** in `src/services/` — Axios-based API client with JWT interceptor
- **Context** in `src/context/` — AuthContext for auth state
- Path alias: `@/*` maps to `./src/*`

### expense-categorizer — Hybrid ML Classification
- Rule-based categorization checked first (keyword matching)
- FastText ML model as fallback
- Auto-detects language and translates to English via Google Translate
- Models stored in S3, downloaded to `/tmp/` at startup
- Deployed as Vercel serverless function via Mangum adapter

### excel-extraction-service — AI-Powered Excel Parsing
- Three-stage Gemini AI pipeline: structure analysis → metadata extraction → transaction extraction
- Async processing with Redis state management (PENDING → PROCESSING → COMPLETED/FAILED)
- Webhook callbacks on completion
- Endpoints: `POST /api/extract`, `GET /api/status/:requestId`

### credit-card-expenses-extractor — Browser Automation
- Abstract base provider with template method pattern (`src/providers/base.ts`)
- Provider implementations for Israeli banks/cards: CAL, Amex, Max, Isracard, Hapoalim, Mizrahi
- Supports `--all` or `--providers provider1,provider2` CLI args
- Downloads statements then uploads to my-expenses-website

## Database (Prisma)

Schema at `my-expenses-api/src/prisma/schema.prisma`. Core models:
- **User** — accounts with email verification
- **Transaction** — income/expense entries with category, approval status, attachments
- **Category** — hierarchical (parent-child)
- **ScheduledTransaction** — recurring (daily/weekly/monthly/yearly/custom)
- **Import / ImportedTransaction** — bulk import workflow with status tracking
- **TransactionFile** — S3/Google Drive attachments
- **UserNotificationPreference / UserNotificationProvider** — Telegram notifications

## Pre-commit Hooks

The API has pre-commit hooks that run: `ts.check`, `build`, `add-build`. Ensure TypeScript compiles cleanly before committing API changes.

## Deployment

- **Website**: Vercel (Next.js)
- **Categorizer**: Vercel (serverless Python)
- **API**: Node.js server with `prisma migrate deploy` on startup
