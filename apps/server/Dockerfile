FROM node:24-alpine AS base

RUN npm install -g corepack@latest \
  && corepack enable \
  && corepack prepare pnpm@latest --activate

FROM base AS prune
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN pnpm add -g turbo@^2

COPY . .

RUN turbo prune "@repo/server" --docker

FROM base AS builder
WORKDIR /app

COPY --from=prune /app/out/json .
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY --from=prune /app/out/full/ .
RUN pnpm turbo run build

FROM node:24-alpine AS runner

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 app
USER app

COPY --from=builder --chown=app:nodejs /app .

CMD node dist/server/main.js
