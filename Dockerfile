FROM node:20-alpine
WORKDIR /app

# Install pnpm and bun
RUN npm install -g pnpm && \
    apk add --no-cache bash curl unzip && \
    curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/rules-engine/package.json ./packages/rules-engine/
COPY server/package.json ./server/
RUN pnpm install --frozen-lockfile

COPY packages/shared-types/ ./packages/shared-types/
COPY packages/rules-engine/ ./packages/rules-engine/
COPY server/ ./server/

# SERVICE=game|api must be set as a Railway environment variable per service
CMD ["sh", "-c", "bun run server/src/index-${SERVICE}.ts"]
