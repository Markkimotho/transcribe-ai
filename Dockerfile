# Voxail Dockerfile
# Build frontend
FROM node:18 AS build
WORKDIR /app
COPY . .
RUN npm install && npm run build

# Production server
FROM node:18 AS server
WORKDIR /app
COPY --from=build /app .
RUN npm install --production
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "server/index.js"]
