# syntax=docker/dockerfile:1.7

# ==============================================================================
# SPA image - builds the Vite bundle, then serves it from nginx.
#
# CRITICAL, and the most common mistake with Vite in Docker:
# every VITE_* variable is INLINED INTO THE JAVASCRIPT AT BUILD TIME. It is not
# read at runtime. So they must arrive as build args (ARG), not as `environment:`
# entries in compose - those would be silently ignored and you would ship a
# bundle with an undefined Stripe key.
#
# The corollary is a security rule: NEVER pass a secret as a VITE_* value. It
# ends up in a static asset that every visitor downloads. Only the Stripe
# PUBLISHABLE key belongs here.
# ==============================================================================

# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html postcss.config.js tailwind.config.js ./
COPY src ./src

# Defaults are the same-origin values used behind nginx, so a plain
# `docker compose build` with no args produces a correctly wired bundle.
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_STRIPE_PUBLISHABLE_KEY=pk_test_replace_me

# Vite only picks these up from the environment, so promote the ARGs to ENV for
# the duration of the build step.
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY

# `npm run build` is `tsc -b && vite build` - the typecheck gates the bundle, so
# a type error fails the image build instead of shipping broken code.
RUN npm run build

# Fail the build if a secret pattern made it into the bundle. This is cheap
# insurance against someone later adding VITE_STRIPE_SECRET_KEY "just to test":
# the mistake becomes a red build instead of a live credential leak.
RUN if grep -rIlE 'sk_(test|live)_|whsec_|SSLCZ_STORE_PASSWORD' dist/ 2>/dev/null | grep -q .; then \
      echo "FATAL: a secret-shaped string was found in the built bundle." >&2; \
      exit 1; \
    fi

# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

# Replace the default server block. Our config handles SPA history fallback and
# proxies /api to the API container - see nginx.conf for why that matters to auth.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The shared security-header snippet that nginx.conf includes from every location
# block. It must land at the exact path referenced by the `include` directives, or
# nginx refuses to start with "open() ... failed" - a fast, loud failure rather
# than a site quietly served without security headers.
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx's own entrypoint handles config templating and signal forwarding, so it
# is left in place. `daemon off` keeps the master process in the foreground,
# which is what allows Docker to supervise and to deliver SIGQUIT/SIGTERM for a
# graceful worker drain.
CMD ["nginx", "-g", "daemon off;"]
