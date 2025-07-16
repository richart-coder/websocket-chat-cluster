FROM node:22-alpine AS builder


RUN apk update && apk upgrade && apk add --no-cache python3 make g++ && rm -rf /var/cache/apk/*

WORKDIR /app


COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force


WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci && npm cache clean --force

COPY frontend/ ./
RUN npm run build


WORKDIR /app
COPY server.js room.js schemas.js ./


FROM gcr.io/distroless/nodejs22-debian12:nonroot


COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/server.js /app/server.js
COPY --from=builder /app/room.js /app/room.js
COPY --from=builder /app/schemas.js /app/schemas.js
COPY --from=builder /app/frontend/dist /app/public

WORKDIR /app
EXPOSE 3001


CMD ["server.js"]