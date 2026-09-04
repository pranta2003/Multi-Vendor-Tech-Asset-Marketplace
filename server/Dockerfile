# syntax=docker/dockerfile:1.7

# ==============================================================================
# API image - multi-stage.
#
# Stage layout is deliberate:
#   deps    -> installs ALL dependencies (incl. dev) once, cached on lockfile
#   builder -> compiles TypeScript + generates the Prisma client
#   migrator-> thin alias of builder; the only image that carries the Prisma CLI
#   runner  -> production dependencies only, no compiler, no CLI, non-root
#
# The point of separating `runner` is that the shipped image cannot compile or
# migrate anything. A smaller attack surface, and it makes accidental
# "run migrations on boot in every replica" impossible (see docker-compose.yml).
# ==============================================================================

# ------------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# WHY build toolchain: argon2 is a native addon. It publishes prebuilt binaries
# for common platforms, but if a prebuild is missing for this exact
# musl/Node ABI combination, node-gyp must compile it from source. Installing
# the toolchain here makes the build deterministic either way, and none of it
# reaches the runtime image because this stage is discarded.
#
# openssl is required by Prisma's query engine at runtime AND at generate time.
RUN apk add --no-cache python3 make g++ openssl

# Copy manifests only, so `npm ci` is re-run when dependencies change and
# NOT when application source changes. This is the single biggest build-time
# win in a Node Dockerfile.
COPY package.json package-lock.json ./

# `npm ci` (not `npm install`) - it installs exactly what the lockfile pins and
# fails loudly if package.json and the lockfile have drifted, which is what you
# want in CI. `npm install` would silently "fix" the lockfile mid-build.
RUN npm ci

# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY prisma ./prisma

# Generate BEFORE compiling: the TypeScript in src/ imports types from
# @prisma/client that only exist after generation, so `tsc` fails without this.
RUN npx prisma generate

COPY src ./src
COPY scripts ./scripts
RUN npm run build

# ------------------------------------------------------------------------------
# Migration runner. Kept as its own stage so docker-compose can target it for a
# one-shot job. It intentionally still has devDependencies, because the Prisma
# CLI lives there and `prisma migrate deploy` needs it.
FROM builder AS migrator
WORKDIR /app
CMD ["npx", "prisma", "migrate", "deploy"]

# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# openssl only - no compiler, no package manager work at runtime.
RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY package.json package-lock.json ./

# `--omit=dev` drops typescript, tsx, prisma CLI, pino-pretty and all @types.
# `--ignore-scripts` is NOT used: argon2's install script is what places its
# native binary. npm cache is cleared in the same layer so it is never committed.
RUN npm ci --omit=dev && npm cache clean --force

# The generated Prisma client is emitted into node_modules/.prisma/client and is
# NOT reproducible by `npm ci` alone - it is a build artefact. Copy it across
# from the builder rather than shipping the Prisma CLI just to regenerate it.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist

# WHY non-root: the `node` user ships with the official image. If the process is
# ever compromised, it cannot modify its own application code, because /app is
# still owned by root and only the writable paths are handed over.
USER node

EXPOSE 5000

# WHY no HEALTHCHECK here: it is defined in docker-compose.yml instead, so the
# probe lives next to the dependency graph that consumes it (`depends_on:
# condition: service_healthy`) and can be tuned without rebuilding the image.

# Exec form (no shell) so PID 1 is node itself and receives SIGTERM directly -
# src/server.ts registers a SIGTERM handler that drains connections and closes
# the Prisma pool. Under the shell form, the signal would go to /bin/sh and the
# container would be SIGKILLed after the grace period instead of shutting down
# cleanly, dropping in-flight requests.
CMD ["node", "dist/server.js"]
