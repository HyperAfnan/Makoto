FROM oven/bun:1.3.14 AS build

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run --cwd apps/backend build

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/packages/shared ./packages/shared
WORKDIR /app/apps/backend
EXPOSE 8787
CMD ["node", "dist/index.js"]
