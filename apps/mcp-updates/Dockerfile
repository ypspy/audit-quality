FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 mcpuser
COPY --from=builder --chown=mcpuser:nodejs /app/dist ./dist
COPY --from=builder --chown=mcpuser:nodejs /app/node_modules ./node_modules
USER mcpuser
# stdio transport — stdin/stdout을 열어둬야 MCP 클라이언트가 연결 가능
CMD ["node", "dist/index.js"]
