# 🏗️ Build Stage: Compile TypeScript
FROM node:20-alpine AS build

WORKDIR /app

# Enable BuildKit caching for npm
# (requires: DOCKER_BUILDKIT=1 in your environment)
COPY package*.json tsconfig.server.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --prefer-offline --no-audit --progress=false

# Copy source and build
COPY . .
RUN npx tsc --project tsconfig.server.json

# Prune devDependencies to slim down runtime
RUN npm prune --production


# 🧼 Production Stage: Slim runtime image
FROM node:20-alpine AS socket

WORKDIR /app
ENV NODE_ENV=production

# Copy only necessary runtime files
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Add non-root user for security
RUN addgroup --system app && adduser --system --ingroup app app
USER app

EXPOSE 3001

# Optional: Healthcheck for orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD node -e "require('net').connect(3001).on('connect', () => process.exit(0)).on('error', () => process.exit(1))"

CMD ["node", "dist/server/index.js"]