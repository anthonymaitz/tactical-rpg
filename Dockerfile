FROM oven/bun:1
WORKDIR /app

# Use pnpm for workspace installs (oven/bun has no npm, use standalone installer)
RUN curl -fsSL https://get.pnpm.io/install.sh | env PNPM_HOME="/usr/local/pnpm" sh -
ENV PATH="/usr/local/pnpm:$PATH"

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

CMD ["sh", "-c", "bun run server/src/index-${SERVICE}.ts"]
