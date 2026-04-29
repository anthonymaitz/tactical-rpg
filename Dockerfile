FROM oven/bun:1
WORKDIR /app

# Use pnpm for workspace installs (repo uses pnpm-lock.yaml)
RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/rules-engine/package.json ./packages/rules-engine/
COPY server/package.json ./server/
RUN pnpm install --frozen-lockfile

COPY packages/shared-types/ ./packages/shared-types/
COPY packages/rules-engine/ ./packages/rules-engine/
COPY server/ ./server/

# SERVICE=game|api — set as Railway build variable per service
ARG SERVICE=game
ENV SERVICE=${SERVICE}

CMD bun run server/src/index-${SERVICE}.ts
