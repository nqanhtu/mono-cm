# Phần mềm quản lý hồ sơ (UI Prototype)

This is a Vite + React + Tailwind CSS prototype of the "Phần mềm quản lý hồ sơ" application.

## Getting Started

1.  Navigate to the app directory:
    ```bash
    cd app
    ```

2.  Install dependencies (if not already installed):
    ```bash
    npm install
    ```

3.  Run the development server:
    ```bash
    pnpm dev:local
    ```

4.  Open the local URL printed by Vite with your browser to see the result.

## Pages Implemented

-   **Dashboard / Hồ sơ** (`/`): Corresponds to `trang3.jpg` (File Management).
-   **Người dùng** (`/users`): Corresponds to `trang1.jpg` (User Management).
-   **Mượn trả** (`/borrow`): Corresponds to `trang2.jpg` (Borrow/Return Management).
-   **Báo cáo** (`/reports`): Corresponds to `trang4.jpg` (Reports/History).

## Features

-   **Responsive Layout**: Adapts to screen size, though optimized for desktop like the original app.
-   **Persistent Footer**: The "Kho lưu trữ" section is always visible at the bottom.
-   **Navigation**: Functional sidebar to switch between views.

## Backend API

The backend/API has been split into a separate Bun + Elysia service at `../court-management-api`.

Run frontend against the local backend:

```bash
pnpm dev:local
```

Run frontend against the deployed backend:

```bash
pnpm dev:server
```

`pnpm dev` and `pnpm dev:local` use the local backend from `.env`.
`pnpm dev:server` runs `vite --mode server` and uses `.env.server` to proxy `/api` to `https://court-management-api.onrender.com`.

Run the backend separately with:

```bash
cd ../court-management-api
bun install
bun run db:generate
bun run dev
```
