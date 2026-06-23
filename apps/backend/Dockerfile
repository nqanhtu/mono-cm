FROM oven/bun:1-alpine
WORKDIR /app

# Copy package and lockfile
COPY package.json bun.lock ./
COPY prisma ./prisma

# Install dependencies and generate prisma client
RUN bun install
RUN bun run db:generate

# Copy the rest of the application
COPY . .

# Set environment
ENV NODE_ENV=production

# Start the application
CMD ["bun", "run", "start"]
