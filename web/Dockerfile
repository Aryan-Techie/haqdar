# Build from the repo root:  docker build -f web/Dockerfile -t haqdar-web .
# The root is needed because scripts/sync-contract.mjs copies ../data/schema/vocab.json.
FROM node:22-slim
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web ./
COPY data/schema /app/data/schema
ARG API_URL=http://api:8000
ARG NEXT_PUBLIC_VOICE_PROVIDER=browser
ENV API_URL=$API_URL NEXT_PUBLIC_VOICE_PROVIDER=$NEXT_PUBLIC_VOICE_PROVIDER NEXT_TELEMETRY_DISABLED=1
# prebuild regenerates lib/vocab.json. next/font/google needs network at build time.
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
