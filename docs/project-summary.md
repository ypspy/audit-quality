# Audit Quality 프로젝트 요약

**audit-quality**는 **감사·회계 품질**과 **전자공시(DART)** 데이터를 다루는 프로젝트 모음입니다. 공시 수집·파싱, 품질관리 포털/평가, 회사 내부 업무 도구를 포함합니다.

---

## 아키텍처 개요

```
[브라우저]
    │
    ▼
[Traefik v3]  ← HTTPS 진입점, ForwardAuth 미들웨어
    │
    ├── /            → apps/web (Next.js 15 통합 UI)
    ├── /auth        → Keycloak 25 (SSO)
    ├── /api/portal  → qualityPortal (Express, API 전용)
    ├── /api/eval    → qualityEval (Express, API 전용)
    ├── /api/timesheet → timesheet (Express, API 전용)
    ├── /api/dart    → dart-for-auditor (Express, API 전용)
    ├── /api/client  → local-inquiry-site (Flask, API 전용)
    ├── /policy      → Next.js /policy (MDX 렌더링)
    └── /updates     → Next.js /updates (MDX 렌더링)
```

**Next.js 통합 UI (`apps/web`)** 가 모든 서비스의 단일 UI 진입점입니다.
각 백엔드 서비스는 API 전용으로 운영됩니다.

---

## 1. DART·공시 수집·파싱

| 모듈 | 역할 |
|------|------|
| **dart-for-auditor** | DART 감사보고서 **메타데이터 인덱서** (API 전용). URL/메타만 인덱싱, 원문은 DART에서 조회. Next.js `/dart`에서 UI 제공. |
| **quality-updates** | 회계기준·감사기준 개정 동향 수집·정리. MkDocs 소스 → Next.js `/updates`에서 MDX 렌더링 제공. 카드 인덱스·퍼지 검색·RAG 채팅 UI 포함. |
| **quality-updates-crawler** | 감사·품질 관련 기관 사이트 크롤러. `quality-updates/docs`에 Markdown 자동 생성. |
| **contractParsing** | 감사보고서·감사계약체결보고 HTML에서 외부감사 실시내용·계약 정보 추출. |
| **disclosureAnalysis** | 감사보고서 HTML에서 **감사보고일** 등 날짜 추출. 12월 결산 자료만 선별. |

---

## 2. 품질관리·정책 포털

| 모듈 | 역할 |
|------|------|
| **qualityPortal** | 감사·품질 포털 API 서버. Express + MongoDB. `/policy`, `/forms`, `/vsc`, `/qc` 등. Next.js `/portal`에서 UI 제공. |
| **qualityEval** | 감사 품질 **평가** API 서버. 리스크·통제 항목 조회/편집 API. Next.js `/eval`에서 UI 제공. |
| **policy** | 품질관리 **내규·품질관리절차** 문서. MkDocs(Material) 소스 → Next.js `/policy`에서 MDX 렌더링 제공. |

---

## 3. 사내 업무·운영 도구

| 모듈 | 역할 |
|------|------|
| **timesheet** | Node/Express 타임시트 관리 API. MongoDB, 직원/고객 관리. Next.js `/timesheet`에서 UI 제공. |
| **local-inquiry-site** | LAN 전용 **고객 정보 조회** Flask API. 담당자→고객 구조, 민감정보 Fernet 암호화. Next.js `/client`에서 UI 제공. |

---

## 4. 인프라·통합 레이어

| 컴포넌트 | 역할 |
|----------|------|
| **apps/web** | Next.js 15 통합 UI 셸. App Router, Auth.js v5 + Keycloak OIDC. 모든 서비스 UI 통합 진입점. |
| **apps/mcp-updates** | MCP 서버 (stdio transport). `search_regulations`·`get_regulation_doc`·`list_recent_regulations` 툴 제공. Claude Code 등 MCP 클라이언트에서 규제 문서 조회 가능. |
| **forward-auth** | Traefik ForwardAuth 서비스. Keycloak JWKS로 JWT 검증, `X-Forwarded-User/Roles` 헤더 전달. |
| **keycloak** | Keycloak 25.0.5 SSO. `yss` realm, next-app·express-services·flask-service 클라이언트. |
| **traefik** | Traefik v3 리버스 프록시. 파일 프로바이더 기반 라우팅, RateLimit·IPAllowlist 미들웨어. |
| **observability** | OpenTelemetry Collector + Prometheus + Loki + Tempo + Grafana. |

---

## 기술 스택 요약

| 레이어 | 기술 |
|--------|------|
| **통합 UI** | Next.js 15 (App Router), TypeScript, Auth.js v5, Tailwind CSS v4 |
| **검색·AI** | fuse.js (클라이언트 퍼지 검색), VoyageAI voyage-3 (임베딩), pgvector (유사도 검색), Claude API (스트리밍 채팅) |
| **MCP** | `@modelcontextprotocol/sdk` stdio transport (`apps/mcp-updates`) |
| **백엔드 API** | Node.js (Express), Python (Flask) |
| **데이터베이스** | MongoDB (Mongoose), PostgreSQL (local-inquiry-site, pgvector RAG) |
| **데이터 수집** | DART API·크롤링, BeautifulSoup/Cheerio, Pandas |
| **인증** | Keycloak 25 OIDC/SSO, JWT (JWKS), ForwardAuth |
| **인프라** | Docker Compose, Traefik v3, GitHub Actions CI/CD |
| **관측성** | OpenTelemetry, Prometheus, Loki, Tempo, Grafana |
| **문서** | MkDocs (소스), Next.js MDX (렌더링), ADR |

---

## 한 줄 요약

**DART·회계기준원·공인회계사회** 등에서 공시·개정 동향을 수집·파싱하고, **품질관리 포털·정책 문서·타임시트·고객 조회** 같은 사내 업무 도구를 **Next.js 통합 UI + Keycloak SSO** 기반의 단일 서비스로 제공하는 **감사·품질 통합 프로젝트**입니다.

---

*최초 작성: 2026-02-27 / 최종 수정: 2026-03-08*
