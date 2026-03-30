FROM node:20-alpine@sha256:f598378b5240225e6beab68fa9f356db1fb8efe55173e6d4d8153113bb8f333c

WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY apps/socket ./apps/socket
COPY packages ./packages

RUN npm ci --legacy-peer-deps
RUN npm run build --workspace=@chat/types
RUN npm run build --workspace=@chat/socket

EXPOSE 3001

CMD ["npm", "start", "--workspace=@chat/socket"]
