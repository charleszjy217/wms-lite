# ---- Build Stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci --workspaces --include-workspace-root

# Copy source code
COPY tsconfig.json ./
COPY frontend/tsconfig.json ./frontend/
COPY frontend/vite.config.ts ./frontend/
COPY frontend/index.html ./frontend/
COPY frontend/vite-env.d.ts ./frontend/
COPY frontend/public ./frontend/public
COPY frontend/src ./frontend/src
COPY packages/shared/src ./packages/shared/src

# Build
RUN cd frontend && npm run build

# ---- Production Stage ----
FROM nginx:alpine AS runner

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
