FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/package.json
COPY server/package.json server/package.json
RUN npm ci
COPY packages/domain packages/domain
COPY server server
WORKDIR /app/server
CMD ["npm", "start"]
