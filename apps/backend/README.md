# Court Management API

Bun + Elysia backend for the court management app.

## Setup

```bash
bun install
bun run db:generate
bun run dev
```

Required environment variables:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=shared-secret-with-frontend
FRONTEND_ORIGIN=http://localhost:3000
PORT=3001
# Optional override for cross-site frontend/API deployments:
# SESSION_COOKIE_SAMESITE=None
```

The frontend should set:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
JWT_SECRET=shared-secret-with-backend
```

Routes intentionally keep the old Next.js API shape under `/api/*`, including the `session` httpOnly JWT cookie.
