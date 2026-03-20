FROM node:20-slim
WORKDIR /app
COPY package*.json ./ package-lock.json ./
COPY turbo.json tsconfig.json ./
RUN npm install --legacy-peer-deps
RUN npm run build --workspace=@chat/types
RUN npm run build --workspace=@chat/web
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@chat/web"]