FROM node:20-alpine
WORKDIR /app

# Install pnpm, bun, and ts-node (ts-node needed for game service: emitDecoratorMetadata)
RUN npm install -g pnpm ts-node && \
    apk add --no-cache bash curl unzip && \
    curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY patches/ ./patches/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/rules-engine/package.json ./packages/rules-engine/
COPY server/package.json ./server/
RUN pnpm install --frozen-lockfile

COPY packages/shared-types/ ./packages/shared-types/
COPY packages/rules-engine/ ./packages/rules-engine/
COPY server/ ./server/

# game: node --import ts-node/esm (Node 20 way to register ESM loader hooks)
# api:  bun for Bun.serve()
CMD ["sh", "-c", "if [ \"$SERVICE\" = \"game\" ]; then cd server && node --import ts-node/esm src/index-game.ts; else bun run server/src/index-api.ts; fi"]
