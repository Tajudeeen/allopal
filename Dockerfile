FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY
ENV NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY=$NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl && rm -rf /var/lib/apt/lists/* && mkdir /data && chown node:node /data
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 DATABASE_URL=file:/data/allopal.db PORT=3000
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
CMD ["sh", "-c", "set -e; npm run db:deploy && exec npm start"]