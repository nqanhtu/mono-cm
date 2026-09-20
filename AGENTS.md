# mono-cm — Agent rules

Court records management monorepo. Backend: Bun + Elysia (`server/`). Frontend: React + Vite (`src/`, `components/`, `lib/`). Data: Prisma + Postgres, one database per tenant province.

## Feature-specific reference docs

**Mượn/trả hồ sơ (borrow/return):** touching `server/api-routes/borrow.routes.ts`, `server/lib/services/borrow.ts`, `server/lib/validation/borrow.ts`, anything under `components/borrow/`, or the `BorrowSlip`/`BorrowItem`/`BorrowSlipEvent` models — read [`docs/dev/borrow-return.md`](docs/dev/borrow-return.md) in full first. It is the single source of truth for the state machine, permissions, and known bugs of this feature; the schema comments have drifted from the real code and must not be trusted on their own. Update that doc in the same change whenever behavior it describes changes.
