# Self-hosted build of the Quenti Next.js app.
# Dependencies are installed with bun inside the image, so nothing needs to be
# installed on the host.
FROM node:22-bookworm-slim AS base

# openssl is required by the Prisma query engine, git by next-build-id
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl git ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g bun@1.2.23

WORKDIR /app

FROM base AS builder

# NEXT_PUBLIC_* values are inlined into the client bundle at build time
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
  SKIP_ENV_VALIDATION=true \
  NEXT_TELEMETRY_DISABLED=1

COPY . .

# postinstall in @quenti/prisma runs `prisma generate`
RUN bun install

RUN cd apps/next && bun run build

FROM builder AS runner

ENV NODE_ENV=production \
  PORT=3000

EXPOSE 3000

# Sync the Prisma schema to the database, then start the server.
# `db push` is used instead of `migrate deploy` because the checked-in
# migrations predate the switch to Postgres and contain MySQL syntax.
CMD ["sh", "-c", "cd packages/prisma && bunx prisma db push --skip-generate && cd ../../apps/next && bun run start -- -H 0.0.0.0 -p 3000"]
