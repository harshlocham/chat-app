FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY apps/socket ./apps/socket
COPY packages ./packages

RUN npm install --legacy-peer-deps
RUN npm run build --workspace=@chat/types
RUN npm run build --workspace=@chat/socket

EXPOSE 3001

CMD ["npm", "start", "--workspace=@chat/socket"]