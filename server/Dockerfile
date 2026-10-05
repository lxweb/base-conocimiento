FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/package.json
COPY server/package.json server/package.json
COPY desktop/package.json desktop/package.json
COPY web/package.json web/package.json
RUN npm ci
COPY packages/domain packages/domain
COPY server server
COPY desktop desktop
COPY web web
RUN npm run build -w @base/web
WORKDIR /app/server
CMD ["npm", "start"]
