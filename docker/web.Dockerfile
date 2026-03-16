# ---- Builder ----
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# ---- Runner ----
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat

RUN addgroup -S app && adduser -S app -G app

# Copy only what’s needed at runtime
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

USER app
EXPOSE 3000
CMD ["npm", "start"]