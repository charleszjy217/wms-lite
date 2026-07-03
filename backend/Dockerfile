# ---- Build Stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci --workspaces --include-workspace-root

# Copy source code
COPY tsconfig.json ./
COPY backend/tsconfig.json ./backend/
COPY backend/nest-cli.json ./backend/
COPY backend/src ./backend/src
COPY backend/prisma ./backend/prisma
COPY packages/shared/src ./packages/shared/src

# Generate Prisma client and build
RUN cd backend && npx prisma generate && npm run build

# ---- Production Stage ----
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts and production dependencies
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "backend/dist/main"]
