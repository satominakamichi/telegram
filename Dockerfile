FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib/db/package.json ./lib/db/
COPY lib/integrations-anthropic-ai/package.json ./lib/integrations-anthropic-ai/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/satomi/package.json ./artifacts/satomi/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm --filter @workspace/db run build 2>/dev/null || true
RUN pnpm --filter @workspace/integrations-anthropic-ai run build 2>/dev/null || true
RUN pnpm --filter @workspace/api-zod run build 2>/dev/null || true
RUN pnpm --filter @workspace/api-server run build
RUN pnpm --filter @workspace/satomi run build

FROM node:20-alpine AS api
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib/db/package.json ./lib/db/
COPY lib/integrations-anthropic-ai/package.json ./lib/integrations-anthropic-ai/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY artifacts/api-server/package.json ./artifacts/api-server/
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/lib/db/dist ./lib/db/dist 2>/dev/null || true
COPY --from=builder /app/lib/integrations-anthropic-ai/dist ./lib/integrations-anthropic-ai/dist 2>/dev/null || true
COPY --from=builder /app/lib/api-zod/dist ./lib/api-zod/dist 2>/dev/null || true
EXPOSE 8080
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
