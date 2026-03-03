# Next.js 15 통합 UI 셸 (Phase 2-1)
# Phase 3-1: MDX 문서용으로 policy/quality-updates 콘텐츠 포함 (빌드 컨텍스트: repo root)
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web .
# MDX 문서 소스 (Next.js에서 /policy, /updates 서빙)
COPY policy/my-project/docs ./src/content/policy
COPY quality-updates/docs ./src/content/updates
# MkDocs nav YAML (사이드바 생성용)
COPY quality-updates/mkdocs.yml ./src/nav/updates.yml
COPY policy/my-project/mkdocs.yml ./src/nav/policy.yml
ENV NEXT_TELEMETRY_DISABLED=1
# prebuild(sync-docs) 생략 — 콘텐츠는 위 COPY로 이미 반영
RUN npx next build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# RSC/런타임에서 /policy, /updates 요청 시 마크다운 읽기 위해 콘텐츠 유지
COPY --from=builder --chown=nextjs:nodejs /app/src/content ./src/content
# MkDocs nav YAML (사이드바 생성용)
COPY --from=builder --chown=nextjs:nodejs /app/src/nav ./src/nav
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV CONTENT_BASE=/app/src/content
ENV NAV_BASE=/app/src/nav
CMD ["node", "server.js"]
