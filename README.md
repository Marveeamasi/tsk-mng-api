# TaskFlow API

> A production-grade REST API for task and project management — built to demonstrate real-world Node.js backend engineering.

[![Node.js CI](https://github.com/yourusername/taskflow-api/actions/workflows/node.yml/badge.svg)](https://github.com/yourusername/taskflow-api/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Architecture Decisions](#architecture-decisions)
- [Database Design & Indexing](#database-design--indexing)
- [Security](#security)
- [Scaling Considerations](#scaling-considerations)
- [How to Deploy](#how-to-deploy)
- [Future Improvements](#future-improvements)

---

## Features

- **Authentication** — JWT access + refresh token rotation, bcrypt password hashing
- **Task management** — Full CRUD, status transitions, priority levels, tags, comments, due dates
- **Project management** — Multi-member projects with role-based access (Owner / Admin / Member / Viewer)
- **Authorization** — Row-level security (users only see their own tasks/projects)
- **Pagination** — Cursor-friendly offset pagination on all list endpoints
- **Search & filtering** — Full-text task search, filter by status/priority/assignee/project
- **Health check** — `/health` endpoint with DB connectivity and memory stats
- **Rate limiting** — Separate limits for auth endpoints vs general API
- **Structured logging** — Pino with request ID tracing; pretty in dev, JSON in prod
- **Environment validation** — Joi schema validates all env vars on startup
- **Centralized error handling** — Unified error format, Prisma error translation, never leaks internals
- **CI/CD** — GitHub Actions pipeline: typecheck → lint → test → build

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 20 LTS | Long-term support, stable |
| Language | TypeScript 5 | Type safety catches bugs at compile time |
| Framework | Express 4 | Mature, well-understood, minimal magic |
| ORM | Prisma | Type-safe queries, migrations, excellent DX |
| Database | PostgreSQL 16 | ACID, battle-tested, rich indexing |
| Logging | Pino | Fastest Node.js logger; JSON for prod |
| Validation | Joi | Powerful schema validation with good errors |
| Auth | jsonwebtoken + bcryptjs | Industry standard, battle-tested |
| Testing | Jest + Supertest | Integration tests against a real test DB |
| CI | GitHub Actions | Free for public repos, great ecosystem |

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm

### Installation

```bash
git clone https://github.com/yourusername/taskflow-api.git
cd taskflow-api
npm install
```

### Environment setup

```bash
cp .env.example .env
# Edit .env with your database URL and JWT secrets
```

Generate secure JWT secrets:
```bash
openssl rand -base64 64
```

### Database setup

```bash
# Run migrations
npm run db:migrate

# Seed with test data
npm run db:seed
```

### Run

```bash
# Development (hot reload)
npm run dev

# Production
npm run build
npm start
```

### Test

```bash
# Requires a test PostgreSQL database (see .env.example for TEST_DATABASE_URL)
npm test
npm run test:coverage
```

---

## API Reference

Base URL: `http://localhost:3000/api`

All protected routes require: `Authorization: Bearer <access_token>`

All responses follow this envelope:
```json
{
  "success": true,
  "message": "...",
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ✗ | Register new account |
| POST | `/auth/login` | ✗ | Login, receive tokens |
| POST | `/auth/refresh` | ✗ | Rotate refresh token |
| POST | `/auth/logout` | ✓ | Invalidate all refresh tokens |
| GET | `/auth/me` | ✓ | Get current user profile |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | List tasks (paginated, filterable) |
| POST | `/tasks` | Create task |
| GET | `/tasks/:id` | Get task with comments |
| PATCH | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Delete task (creator only) |
| POST | `/tasks/:id/comments` | Add comment |

**Query params for `GET /tasks`:**
`status`, `priority`, `assigneeId`, `projectId`, `search`, `page`, `limit`

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List my projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project with members |
| PATCH | `/projects/:id` | Update (Owner/Admin only) |
| DELETE | `/projects/:id` | Delete (Owner only) |
| POST | `/projects/:id/members` | Add member by email |
| DELETE | `/projects/:id/members/:memberId` | Remove member |

### Health

```
GET /health
```

---

## Architecture Decisions

### Layered Architecture

```
Request → Routes → Middleware → Controllers → Services → Database
```

Each layer has a single responsibility:

- **Routes** — URL mapping and middleware composition only. No logic.
- **Controllers** — Input parsing and validation, call service, format response. No business logic.
- **Services** — All business logic, authorization checks, database access. No HTTP concerns.
- **Middleware** — Cross-cutting concerns: auth, rate limiting, logging, error handling.
- **Utils** — Pure, stateless helpers (JWT, response formatting, validation schemas).
- **Config** — Environment, logger, database client. Loaded once, used everywhere.

**Why not MVC?** MVC tends to bloat models and controllers. The Service layer gives you a clean seam for unit testing business logic independently of HTTP.

### `express-async-errors` Patch

All async route handlers are wrapped automatically. This eliminates boilerplate `try/catch` in every controller and ensures unhandled promise rejections are caught by the centralized error handler.

### Refresh Token Rotation

On every refresh, old tokens are deleted and a new pair is issued. This means stolen refresh tokens can only be used once — the legitimate user's next refresh will invalidate the attacker's token.

Refresh tokens are stored as **bcrypt hashes** in the database. Even if the DB is compromised, raw refresh tokens are not exposed.

### Row-Level Authorization in Services

Authorization checks live in the Service layer, not middleware. This is intentional — it keeps auth logic co-located with the business rule it enforces, making it easier to audit and test.

---

## Database Design & Indexing

### Entity Relationships

```
User ──< RefreshToken
User ──< Task (as creator)
User ──< Task (as assignee)
User ──< ProjectMember >── Project
Project ──< Task
Task ──< Comment
```

### Indexing Strategy

Every index in `schema.prisma` was chosen to serve a specific, frequent query pattern:

| Index | Serves |
|-------|--------|
| `tasks(creatorId, status)` | "My tasks by status" — most common dashboard query |
| `tasks(assigneeId, status)` | "Assigned to me by status" |
| `tasks(projectId, status)` | "Project board" grouped by status |
| `tasks(status, priority)` | Admin/team views sorted by urgency |
| `tasks(dueDate)` | Upcoming/overdue task queries |
| `users(email)` | Login lookup (also covered by `@unique`) |
| `refreshTokens(userId)` | Find all tokens for a user on login/logout |
| `refreshTokens(expiresAt)` | Scheduled cleanup of expired tokens |
| `projectMembers(userId)` | "Projects I'm in" without a full scan |
| `comments(taskId)` | Load all comments for a task |

**Composite indexes** are ordered (most selective column first) to maximize selectivity.

### Why PostgreSQL over MongoDB?

Tasks have clear relational structure — users, projects, assignments, comments. PostgreSQL gives us:
- ACID transactions (no partial writes)
- Foreign key enforcement (no orphaned records)
- Rich query planner (composite indexes, partial indexes)
- `ARRAY` type for tags (no extra join table needed)
- `EXPLAIN ANALYZE` for query profiling

---

## Security

- **Helmet** — Sets 14 security-relevant HTTP headers
- **CORS** — Explicit allowlist of origins, headers, and methods
- **Rate limiting** — 100 req/15min globally; 10 req/15min on auth routes
- **Password hashing** — bcrypt with 12 rounds (adaptive cost)
- **JWT** — Short-lived access tokens (7d by default), rotate-on-use refresh tokens
- **Log redaction** — `Authorization` headers and `password` fields are `[REDACTED]` in logs
- **No stack traces in production** — Error handler only includes stack in `development`
- **Env validation** — Server refuses to start with missing/invalid configuration
- **Input validation** — All input is validated and stripped of unknown fields via Joi

---

## Scaling Considerations

### Horizontal Scaling (Stateless by Design)

The API is fully stateless — authentication state lives in JWTs and the database, not in process memory. You can run 10 identical instances behind a load balancer with no sticky sessions.

```
                   ┌─────────────────────┐
Internet ──► ALB ──► TaskFlow Instance 1 ├──► PostgreSQL
                   ├─────────────────────┤       (Primary)
                   ├─────────────────────┤       
                   └─────────────────────┘
```

### Database Scaling

**Read replicas** — Read-heavy endpoints (list tasks, list projects) can be directed to a read replica. Prisma supports `$transaction` with `readonly` flag.

**Connection pooling** — Use [PgBouncer](https://www.pgbouncer.org/) in front of PostgreSQL when running many instances. Each Node process holds a connection pool; without pooling, 10 instances × 20 connections = 200 DB connections.

**Caching** — High-frequency reads (user profile, project members) are candidates for Redis with short TTLs (30–60s). The service layer is the right place to introduce a cache-aside pattern.

### Performance

- Response compression via `compression` middleware reduces bandwidth
- Pino is 5–10× faster than Winston for high-throughput logging
- `Promise.all` is used wherever possible to parallelize independent DB calls
- Prisma `select` projections prevent over-fetching columns

---

## How to Deploy

### Option 1: Railway / Render (Easiest)

1. Push to GitHub
2. Create a new project on [Railway](https://railway.app) or [Render](https://render.com)
3. Connect your GitHub repo
4. Set environment variables from `.env.example`
5. Add a PostgreSQL plugin/database
6. Set start command: `npm start`
7. Set build command: `npm run build && npx prisma migrate deploy`

### Option 2: Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

```bash
docker build -t taskflow-api .
docker run -p 3000:3000 --env-file .env taskflow-api
```

### Option 3: AWS EC2 / DigitalOcean Droplet

```bash
# On server
git clone <repo>
cd taskflow-api
npm ci
npm run build
npx prisma migrate deploy

# Use PM2 for process management
npm install -g pm2
pm2 start dist/server.js --name taskflow-api
pm2 startup   # Survive reboots
pm2 save
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Use [Certbot](https://certbot.eff.org/) to add free TLS via Let's Encrypt.

### Environment Variables for Production

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
JWT_SECRET=<openssl rand -base64 64>
JWT_REFRESH_SECRET=<openssl rand -base64 64>
CORS_ORIGIN=https://yourfrontend.com
LOG_LEVEL=info
```

---

## Future Improvements

### Short-term (next sprint)

- [ ] **Email notifications** — Send reminders for upcoming/overdue tasks via Resend or SendGrid
- [ ] **File attachments** — Upload task attachments to S3/R2
- [ ] **Activity log** — Audit trail of all task/project changes using Prisma middleware
- [ ] **Swagger/OpenAPI** — Auto-generated interactive API docs via `@asteasolutions/zod-to-openapi`
- [ ] **Soft deletes** — Add `deletedAt` field so records are recoverable

### Medium-term

- [ ] **WebSockets** — Real-time task updates when collaborators make changes (Socket.io or Server-Sent Events)
- [ ] **Redis cache** — Cache user profiles and project membership lookups
- [ ] **Background jobs** — Move email sending to a queue (BullMQ + Redis) so API responses stay fast
- [ ] **Observability** — Integrate OpenTelemetry for distributed tracing; export to Datadog or Grafana
- [ ] **Multi-tenancy** — Organization-level isolation for SaaS use case

### Long-term

- [ ] **GraphQL layer** — Expose a GraphQL API alongside REST for flexible frontend queries
- [ ] **Microservices** — Extract notifications, auth, and search into separate services if load demands
- [ ] **Full-text search** — Postgres `tsvector` or Elasticsearch for rich task search
- [ ] **Analytics** — Read replica queries for team productivity dashboards

---

## Project Structure

```
taskflow-api/
├── .github/
│   └── workflows/
│       └── node.yml          # CI pipeline
├── prisma/
│   ├── schema.prisma          # DB schema with indexes
│   └── seed.ts                # Test data seeder
├── src/
│   ├── config/
│   │   ├── database.ts        # Prisma client singleton
│   │   ├── env.ts             # Joi env validation
│   │   └── logger.ts          # Pino logger setup
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── task.controller.ts
│   │   └── project.controller.ts
│   ├── middleware/
│   │   ├── auth.ts            # JWT authentication
│   │   ├── errorHandler.ts    # Centralized error handler
│   │   ├── rateLimiter.ts     # express-rate-limit
│   │   └── requestId.ts       # X-Request-ID tracing
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── task.routes.ts
│   │   ├── project.routes.ts
│   │   └── health.routes.ts
│   ├── services/
│   │   ├── auth.service.ts    # Auth business logic
│   │   ├── task.service.ts    # Task business logic
│   │   └── project.service.ts # Project business logic
│   ├── utils/
│   │   ├── errors.ts          # Custom error classes
│   │   ├── jwt.ts             # Token sign/verify helpers
│   │   ├── response.ts        # Consistent API response helpers
│   │   └── validate.ts        # Joi validation wrapper
│   ├── app.ts                 # Express app factory
│   └── server.ts              # Entry point + graceful shutdown
├── tests/
│   ├── setup.ts               # Test environment setup
│   ├── auth.test.ts           # Auth integration tests
│   └── task.test.ts           # Task integration tests
├── .env.example
├── .eslintrc.js
├── .gitignore
├── jest.config.ts
├── package.json
├── README.md
└── tsconfig.json
```

---

## License

MIT
