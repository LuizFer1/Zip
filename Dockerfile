FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json prisma.config.ts ./
COPY src ./src
COPY prisma ./prisma
COPY scripts ./scripts

RUN npm run build \
  && npm run rebuild:native:electron

FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
  dumb-init \
  xvfb \
  xauth \
  libatk-bridge2.0-0 \
  libatspi2.0-0 \
  libasound2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  libxss1 \
  libxtst6 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json package-lock.json ./

RUN mkdir -p /data && chown -R node:node /app /data
USER node

ENV ZIP_P2P_ENABLED=true
ENV ZIP_P2P_HOST=0.0.0.0
ENV ZIP_P2P_PORT=7070
ENV ZIP_DB_PATH=/data/zip.db

EXPOSE 7070

ENTRYPOINT ["dumb-init", "--"]
CMD ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1280x720x24", "./node_modules/.bin/electron", ".", "--no-sandbox"]
