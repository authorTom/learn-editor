# syntax=docker/dockerfile:1

# --- Stage 1: build the static site -----------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# Install deps against the lockfile first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Seed a fresh install with the exemplar course + starter templates.
# Set --build-arg SEED_EXAMPLES=false to ship an empty dashboard instead.
ARG SEED_EXAMPLES=true
ENV VITE_SEED_EXAMPLES=$SEED_EXAMPLES

# Build the SPA -> /app/dist (regenerate the seed library first so it can't
# drift from the exemplar it's derived from).
COPY . .
RUN node scripts/build-seed-templates.mjs && npm run build

# --- Stage 2: serve dist/ and the API with Node ------------------------------
#
# This used to be nginx. The image now runs Learn Editor's own server, which
# serves the same static bundle *and* the accounts/sync API from one port —
# static.mjs reproduces nginx's caching and history-fallback rules exactly.
#
# The server has no runtime dependencies, so nothing is installed here: the
# whole runtime is Node, the built assets, and ~1500 lines of .mjs.
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY server ./server
# version.mjs reads this to report which build is running, and it is what keeps
# the API's version and the bundle's baked-in version from disagreeing.
COPY package.json ./package.json

# node:alpine ships an unprivileged `node` user, and the server runs as it. The
# data directory has to be owned by that user or the first write fails on a
# fresh volume.
#
# This must come BEFORE the VOLUME instruction. Docker discards changes made to
# a volume path in any layer after the volume is declared, so a chown placed
# below would silently do nothing and leave /data owned by root — which a new
# named volume then inherits, and the server cannot create its database.
RUN mkdir -p /data && chown -R node:node /data /app

# Courses, accounts and media live here. Declared so that running without an
# explicit volume still persists for the life of the container rather than
# writing into the image layer.
VOLUME ["/data"]

ENV LE_DATA_DIR=/data
ENV LE_PORT=8080

USER node

EXPOSE 8080

# No shell form: PID 1 is node itself, so it receives SIGTERM directly and the
# graceful shutdown in index.mjs actually runs.
CMD ["node", "server/index.mjs"]
