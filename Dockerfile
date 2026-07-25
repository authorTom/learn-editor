# syntax=docker/dockerfile:1

# --- Stage 1: build the static site -----------------------------------------
FROM node:22-alpine AS build
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

# --- Stage 2: serve dist/ with nginx ----------------------------------------
FROM nginx:1.27-alpine AS runtime

# SPA-aware server config (history fallback + asset caching).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Ship only the built assets.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
