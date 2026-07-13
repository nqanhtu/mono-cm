# Use official Bun base image (Debian-based slim version for Prisma compatibility)
FROM oven/bun:1-slim AS base
WORKDIR /app

# Stage 1: Install dependencies
FROM base AS install
COPY package.json bun.lock tsconfig.json ./
COPY prisma ./prisma/
RUN bun install --frozen-lockfile

# Stage 2: Build / generate client
FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY . .
RUN bun run db:generate

# Stage 3: Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules, generated Prisma client, and source files needed to run
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/server ./server
COPY --from=build /app/lib ./lib
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json

# Run as non-root user for security
USER bun

EXPOSE 3000
ENTRYPOINT [ "bun", "run", "server/index.ts" ]
