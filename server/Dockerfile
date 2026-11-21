FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libreoffice-writer \
        fonts-dejavu-core \
        fonts-liberation \
        ca-certificates \
        clamav \
        clamav-freshclam \
    && freshclam --stdout \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./
COPY shared/ /app/shared/

ENV NODE_ENV=production
ENV SOFFICE_PATH=/usr/bin/soffice
ENV CLAMSCAN_PATH=/usr/bin/clamscan
ENV CLAMAV_DB_DIR=/var/lib/clamav

EXPOSE 10000

CMD ["node", "server.js"]
