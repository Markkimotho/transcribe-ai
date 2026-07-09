# semaje api + worker image (one image, two entrypoints).
# Note: the claude-local LLM adapter needs the `claude` CLI — install it and
# mount credentials (see docker-compose.yml), or set LLM_ADAPTER=gemini.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# claude CLI for the claude-local adapter (best-effort; gemini fallback works without it)
RUN npm install -g @anthropic-ai/claude-code || true
COPY --from=build /app /app
EXPOSE 3001
# entrypoints: "start" = api (+ static frontend), "worker" = job consumer
CMD ["npm", "run", "start"]
