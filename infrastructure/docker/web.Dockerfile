# Next.js applications (public-website | engineering-lab | digital-twin) as standalone servers. Build context: repository root.
ARG BASE_REGISTRY=docker.io/library
FROM ${BASE_REGISTRY}/node:22-slim AS build
ARG APP
ARG NEXT_PUBLIC_PUBLIC_URL=http://localhost:3000
ARG NEXT_PUBLIC_LAB_URL=http://localhost:3001
ARG NEXT_PUBLIC_TWIN_URL=http://localhost:3002
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG DR_API_INTERNAL_URL=http://api:8000
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_PUBLIC_URL=$NEXT_PUBLIC_PUBLIC_URL NEXT_PUBLIC_LAB_URL=$NEXT_PUBLIC_LAB_URL \
    NEXT_PUBLIC_TWIN_URL=$NEXT_PUBLIC_TWIN_URL NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL DR_API_INTERNAL_URL=$DR_API_INTERNAL_URL
# Optional build secret "extra_ca" (PEM bundle) for builds behind a TLS-intercepting proxy; unused otherwise.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/$APP ./apps/$APP
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    pnpm install --frozen-lockfile --filter "@dr/${APP}..." && pnpm --filter "@dr/${APP}" build
RUN mkdir -p ./apps/$APP/public

FROM ${BASE_REGISTRY}/node:22-slim
ARG APP
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
WORKDIR /srv
COPY --from=build /repo/apps/$APP/.next/standalone ./
COPY --from=build /repo/apps/$APP/.next/static ./apps/$APP/.next/static
COPY --from=build /repo/apps/$APP/public ./apps/$APP/public
RUN useradd --uid 10001 --create-home web && echo "apps/$APP/server.js" > /srv/.entry
USER web
CMD ["sh", "-c", "exec node $(cat /srv/.entry)"]
