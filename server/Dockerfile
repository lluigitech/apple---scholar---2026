FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libreoffice-writer \
        fonts-dejavu-core \
        fonts-liberation \
        ca-certificates \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libatspi2.0-0 \
        libgbm1 \
        libgtk-3-0 \
        libpango-1.0-0 \
        libvulkan1 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxkbcommon0 \
        clamav \
        clamav-freshclam \
        unzip \
        wget \
        xdg-utils \
    && freshclam --stdout \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server

COPY server/package*.json ./
RUN PUPPETEER_SKIP_DOWNLOAD=true npm ci --omit=dev \
    && npx puppeteer browsers install chrome

COPY server/ ./
COPY shared/ /app/shared/

ENV NODE_ENV=production
ENV SOFFICE_PATH=/usr/bin/soffice
ENV CLAMSCAN_PATH=/usr/bin/clamscan
ENV CLAMAV_DB_DIR=/var/lib/clamav

EXPOSE 10000

CMD ["node", "server.js"]
