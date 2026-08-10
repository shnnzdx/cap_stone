FROM node:22-bookworm-slim AS deps

WORKDIR /workspace

COPY trip/package.json trip/package-lock.json ./trip/
COPY frontend/package.json frontend/package-lock.json ./frontend/

RUN cd trip && npm ci
RUN cd frontend && npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /workspace

ARG NEXT_PUBLIC_API_BASE_URL
ARG VITE_API_BASE_URL

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY --from=deps /workspace/trip/node_modules ./trip/node_modules
COPY --from=deps /workspace/frontend/node_modules ./frontend/node_modules
COPY shared ./shared
COPY trip ./trip
COPY frontend ./frontend

RUN cd frontend && npm run build:trip-preview
RUN cd frontend && npm run build

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY --from=builder --chown=node:node /workspace/frontend/package.json ./package.json
COPY --from=builder --chown=node:node /workspace/frontend/scripts ./scripts
COPY --from=builder --chown=node:node /workspace/frontend/node_modules ./node_modules
COPY --from=builder --chown=node:node /workspace/frontend/dist ./dist
COPY --from=builder --chown=node:node /workspace/frontend/public ./public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
