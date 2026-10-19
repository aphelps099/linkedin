FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Cache the model in the image and exercise both Linux voices before deployment.
RUN npm run build && node scripts/check-post-beat-service.mjs && npm prune --omit=dev && node scripts/warm-beat-voices.mjs
ENV NODE_ENV=production
ENV POST_BEAT_CACHE_DIR=/data/linkedin-beat-cache
ENV OMP_NUM_THREADS=2
EXPOSE 8080
CMD ["npm", "start"]
