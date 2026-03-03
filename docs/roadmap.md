# 개발 로드맵

기획서 Phase 1/2/3를 구체적인 Task 단위로 세분화한 실행 계획입니다.
완료된 Task는 `[x]`로 표시합니다.

---

## 현황 요약 (2026-03-03 기준)

| Phase | 상태 | 비고 |
|-------|------|------|
| Phase 1 — 인프라 기반 구축 | **~85% 완료** | OTel SDK 연동·CI/CD 미완 |
| Phase 2 — 프론트엔드 셸 전환 | **완료** | Next.js 15 통합 UI 전환 완료 |
| Phase 3-1 — policy/updates 통합 | **완료** | Next.js MDX 렌더링으로 전환 완료 |
| Phase 3-2 — 감사보고일 대시보드 | ⏸ **향후 고려** | 백로그로 이동 |
| Phase 3-3 — LLM 감사보고서 분석 | ⏸ **향후 고려** | 백로그로 이동 |

---

## 목차

- [현황 요약](#현황-요약-2026-03-03-기준)
- [문서 정비](#문서-정비)
- [Phase 1 — 인프라 기반 구축](#phase-1--인프라-기반-구축)
  - [1-1. Docker Compose 전체 서비스 통합](#1-1-docker-compose-전체-서비스-통합)
  - [1-2. Traefik v3 도입](#1-2-traefik-v3-도입)
  - [1-3. Keycloak 24 SSO 구성](#1-3-keycloak-24-sso-구성)
  - [1-4. OpenTelemetry + Grafana Stack 구축](#1-4-opentelemetry--grafana-stack-구축)
  - [1-5. GitHub Actions CI/CD 기본 파이프라인](#1-5-github-actions-cicd-기본-파이프라인)
- [Phase 2 — 프론트엔드 셸 전환](#phase-2--프론트엔드-셸-전환)
  - [2-1. Next.js 15 통합 UI 셸 신규 구축](#2-1-nextjs-15-통합-ui-셸-신규-구축)
  - [2-2. qualityPortal UI → Next.js 이전](#2-2-qualityportal-ui--nextjs-이전)
  - [2-3. qualityEval UI → Next.js 이전](#2-3-qualityeval-ui--nextjs-이전)
  - [2-4. timesheet UI → Next.js 이전](#2-4-timesheet-ui--nextjs-이전)
  - [2-5. dart-for-auditor UI → Next.js 이전](#2-5-dart-for-auditor-ui--nextjs-이전)
  - [2-6. local-inquiry-site UI → Next.js 이전](#2-6-local-inquiry-site-ui--nextjs-이전)
  - [2-7. PostgreSQL 마이그레이션](#2-7-postgresql-마이그레이션-local-inquiry-site)
  - [2-8. 배치 파이프라인 자동화](#2-8-배치-파이프라인-자동화)
- [Phase 3 — 고도화](#phase-3--고도화)
  - [3-1. policy / quality-updates → Next.js 내 통합](#3-1-policy--quality-updates--nextjs-내-통합)
  - [3-2. 감사보고일 대시보드](#3-2-감사보고일-대시보드)
  - [3-3. LLM 감사보고서 분석 (탐색)](#3-3-llm-감사보고서-분석-탐색)
- [참고](#참고)

---

## 문서 정비

- [x] 루트 `README.md` 생성 (실존 모듈 목록 + 한 줄 설명)
- [x] `docs/PROJECT_SUMMARY.md` — 존재하지 않는 모듈 제거 (`dissertation`, `disclosureSimilarity`, `analytics`, `audit_activity_classification`, `dev`, `scheduleCollector`, `scheduleParser`)
- [x] `docs/기획서_감사품질통합지원서비스.md` — 섹션 10·11의 구버전 기술 스택 수정 (Nginx → Traefik, Passport JWT/Redis → Keycloak OIDC)
- [x] `docs/setup.md` — `.env.example` 없는 서비스 (`qualityPortal`, `qualityEval`, `timesheet`) `cp` 명령어 수정
- [x] `docs/requirements.md`, `docs/workflow.md`, `docs/deploy.md`, `docs/adr/*` 점검 — 이상 없음

---

## Phase 1 — 인프라 기반 구축

> **목표:** Traefik + Keycloak SSO + Docker Compose로 기존 서비스를 단일 스택으로 통합한다.
> **완료 기준:** 모든 서비스가 단일 도메인 아래 SSO 1회 로그인으로 접근 가능한 상태.

### 1-1. Docker Compose 전체 서비스 통합

- [x] 각 서비스 `Dockerfile` 작성 (qualityPortal, qualityEval, timesheet, dart-for-auditor, local-inquiry-site)
- [x] `docker-compose.yml` 루트 파일 작성 (전체 서비스 + 네트워크 정의)
- [x] `.env.example` 통합 (서비스별 환경 변수 문서화)
- [x] `docker compose up` 한 번으로 전체 스택 실행 검증

**완료 기준:** `docker compose up -d` 후 모든 서비스 헬스체크 통과.

### 1-2. Traefik v3 도입

- [x] Traefik 컨테이너 설정 (`traefik.yml`, `docker-compose.yml` 통합)
- [x] 내부 TLS 설정 (로컬: 자체 서명 인증서 / 프로덕션: Let's Encrypt)
- [x] 서비스별 라우팅 규칙 정의 — `traefik/dynamic/services.yml` 파일 프로바이더로 명시 (Keycloak, portal, eval, timesheet, dart, client, web)
- [x] Rate Limiting 미들웨어 설정
- [x] IP Allowlist 미들웨어 설정 (local-inquiry-site LAN 전용)

> **참고:** Windows Docker Desktop 환경에서 Docker provider 소켓 오류 발생 → 모든 라우팅을 `traefik/dynamic/services.yml` 파일 프로바이더로 이중 정의. 설정 변경 후 `docker compose restart traefik` 필요.

**완료 기준:** 모든 서비스가 Traefik을 통해 HTTP/HTTPS로 응답.

### 1-3. Keycloak SSO 구성

- [x] Keycloak 25.0.5 컨테이너 설정 (PostgreSQL 백엔드)
- [x] Realm `yss` 생성 (`keycloak/realm/yss-realm.json` import)
- [x] 클라이언트 등록: `next-app`, `express-services`, `flask-service`
- [x] Realm Roles 생성: `admin`, `auditor`, `qc-manager`
- [x] `forward-auth` 서비스: Keycloak JWKS로 JWT 검증 후 `X-Forwarded-User/Roles` 헤더 전달
- [x] Traefik ForwardAuth 미들웨어 연동 (`traefik/dynamic/middlewares.yml`)
- [ ] 각 Express 서비스 JWT 검증 미들웨어 동작 확인 *(미완 — 배포 서버 환경에서 확인 필요)*
- [ ] local-inquiry-site `python-jose` JWT 검증 동작 확인 *(미완 — 배포 서버 환경에서 확인 필요)*

> **참고:** `KC_HOSTNAME: http://localhost/auth` 필수 (full URL + `/auth` prefix). Auth.js server-side OIDC fetch는 `customFetch`로 내부 URL(`keycloak:8080`)로 라우팅.
> `yss` realm 유저는 Keycloak 어드민 콘솔(`/auth/admin`)에서 직접 생성 필요.

**완료 기준:** Keycloak 로그인 1회로 모든 서비스 접근 가능. ✅ Next.js 셸 로그인 흐름 확인 완료 (2026-03-02)

### 1-4. OpenTelemetry + Grafana Stack 구축

- [x] OpenTelemetry Collector 컨테이너 설정 (`observability/otel-collector-config.yaml`) — OTLP 수신 → Prometheus/Loki/Tempo 파이프라인 구성
- [x] Prometheus, Loki, Tempo, Grafana 컨테이너 설정 — 모두 정상 실행 확인 (2026-03-02)
- [x] Grafana 데이터소스 자동 프로비저닝 (`observability/grafana/provisioning/datasources/datasources.yaml`)
- [ ] 각 Express 서비스에 `@opentelemetry/sdk-node` 연동 — 환경변수(`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`)만 설정됨, SDK 코드 초기화 미완 *(향후 필요 시 추가)*
- [ ] Flask 서비스에 `opentelemetry-sdk` 연동 — 미완 *(향후 필요 시 추가)*
- [ ] Grafana 기본 대시보드 구성 (서비스 헬스, 요청 수, 에러율) — SDK 연동 완료 후 구성 가능

> **현황:** 인프라 파이프라인은 정상. 각 서비스의 SDK 연동이 없어 Loki/Prometheus/Tempo에 앱 데이터 없음.

**완료 기준:** Grafana에서 모든 서비스의 로그·메트릭·트레이스 확인 가능.

### 1-5. GitHub Actions CI/CD 기본 파이프라인

- [x] `.github/workflows/ci.yml` 작성 — PR 시 Node lint/test, Python unittest, Docker 스모크 빌드
- [x] `.github/workflows/deploy.yml` 작성 — main push 시 GHCR 이미지 빌드·푸시, SSH 배포 (DEPLOY_ENABLED=true 시 활성화)
- [x] 루트 디렉토리 `git init` + 루트 `.gitignore` 작성 (2026-03-03)
- [ ] GitHub 원격 저장소 연결 (`git remote add origin <url>` 후 `git push -u origin main`)
- [ ] GitHub Secrets 설정 (`SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `REGISTRY_TOKEN`)
- [ ] CI/CD 실제 실행 확인

**완료 기준:** main 브랜치 push 시 자동 빌드 및 배포 성공.

---

## Phase 2 — 프론트엔드 셸 전환

> **목표:** Next.js 15 통합 UI 셸을 구축하고, Express/Flask를 API 전용으로 분리한다.
> **완료 기준:** 모든 서비스 UI가 Next.js 셸 아래 단일 UX로 제공되는 상태.
> **진행 방식:** 아래 권장 순서를 기본으로 하되, 서비스 담당자/인력 상황에 따라 일부 Task는 병렬로 수행 가능하다.

### 2-1. Next.js 15 통합 UI 셸 신규 구축

- [x] `apps/web/` Next.js 15 프로젝트 초기화 (App Router, TypeScript, `output: standalone`)
- [x] next-auth v5 (beta.30) + Keycloak Provider — `customFetch`로 Docker 내부 issuer URL 교체
- [x] 공통 레이아웃·네비게이션 컴포넌트 작성
- [x] Traefik → Next.js 라우팅 연결 (`/`, `/portal`, `/eval`, `/timesheet`, `/dart`, `/client`)
- [x] Auth.js middleware — 미인증 시 `/api/auth/signin` 리다이렉트, `/api/auth/*` · `/api/health` 제외

> **비고:** Phase 2 이후 Task들은 모두 Next.js 셸과 SSO 구성이 완료되었다는 전제 위에서 진행한다.

**완료 기준:** Next.js 앱이 Keycloak 로그인 후 각 서비스 페이지로 이동 가능. ✅ 확인 완료 (2026-03-02)

### 2-2. qualityPortal UI → Next.js 이전

- [x] qualityPortal Express에서 EJS 뷰 제거, API 전용 서버로 전환
- [x] Next.js에서 `/portal` 페이지 구현 (Server Components + API 호출)

> **비고:** qualityPortal는 이미 UI 이전이 완료되었으며, 이후 Task들의 참고 구현체로 활용한다.

### 2-3. qualityEval UI → Next.js 이전

- [x] qualityEval EJS 뷰 제거, API 전용 전환
- [x] Next.js에서 `/eval` 페이지 구현 (리스크·통제 목록, 필터, 편집)

> **선행:** 2-1 Next.js 셸 구축, 2-2 qualityPortal UI 이전  
> **다음:** 2-4 timesheet UI → Next.js 이전

### 2-4. timesheet UI → Next.js 이전

- [x] timesheet EJS 뷰 제거, API 전용 전환
- [x] Next.js에서 `/timesheet` 페이지 구현 (목록, 생성, 수정, changelog)

> **선행:** 2-1, 2-2, 2-3  
> **다음:** 2-5 dart-for-auditor UI → Next.js 이전

### 2-5. dart-for-auditor UI → Next.js 이전

- [x] dart-for-auditor 뷰어 분리, API 전용 전환
- [x] Next.js에서 `/dart` 페이지 구현 (공시 검색·조회)

> **선행:** 2-1, 2-2, 2-3, 2-4  
> **다음:** 2-6 local-inquiry-site UI → Next.js 이전

### 2-6. local-inquiry-site UI → Next.js 이전

- [x] Flask 뷰 제거, API 전용 전환
- [x] Next.js에서 `/client` 페이지 구현 (고객 조회, Split View, 탭)

> **선행:** 2-1, 2-2, 2-3, 2-4, 2-5  
> **다음:** 2-7 PostgreSQL 마이그레이션 (local-inquiry-site)

### 2-7. PostgreSQL 마이그레이션 (local-inquiry-site)

- [x] SQLite → PostgreSQL 스키마 마이그레이션 스크립트 작성
- [x] 데이터 검증 스크립트 실행
- [x] 원본 SQLite 백업 후 전환

> **선행:** 2-6 local-inquiry-site UI → Next.js 이전 (도메인/데이터 구조 이해)  
> **다음:** 2-8 배치 파이프라인 자동화 또는 Phase 3

**완료 기준:** local-inquiry-site가 PostgreSQL로 정상 운영.

### 2-8. 배치 파이프라인 자동화

- [x] dart-collector cron 서비스 Docker 컨테이너화 (매일 08:00, 18:00)
- [x] regulation-crawler cron 서비스 Docker 컨테이너화 (분기별) + quality-updates 자동 빌드 연동
- [x] disclosure-analysis cron 서비스 Docker 컨테이너화 (매월 1일)
- [x] 각 배치 작업 로그/메트릭을 OpenTelemetry/Grafana Stack과 연동 (Loki/Prometheus 지표 노출)

> **선행:** Phase 1 관측 스택 구축(1-4), 관련 서비스 컨테이너 빌드  
> **다음:** Phase 3 — 고도화

**완료 기준:** 모든 배치가 스케줄에 따라 자동 실행되고 Grafana에서 결과 확인 가능.

#### Phase 2 권장 진행 순서 요약

1. 2-1 Next.js 15 통합 UI 셸 신규 구축 (완료 상태 검증)
2. 2-2 qualityPortal UI → Next.js 이전 (완료 상태 검증 및 참고 구현 정리)
3. 2-3 qualityEval UI → Next.js 이전
4. 2-4 timesheet UI → Next.js 이전
5. 2-5 dart-for-auditor UI → Next.js 이전
6. 2-6 local-inquiry-site UI → Next.js 이전
7. 2-7 PostgreSQL 마이그레이션 (local-inquiry-site)
8. 2-8 배치 파이프라인 자동화

---

## Phase 3 — 고도화

> **목표:** UI 이전 완료 및 감사보고일 대시보드 구축.
> **진행 방식:** Phase 2 이후, 문서/대시보드/분석 PoC를 아래 권장 순서대로 진행한다.

### 3-1. policy / quality-updates → Next.js 내 통합

- [x] MkDocs 정적 사이트를 `/policy`, `/updates` 경로로 Traefik 서빙
- [x] MkDocs 빌드/배포 파이프라인 정리 (quality-updates 자동 빌드 포함)
- [x] (선택) Next.js MDX 기반 문서 페이지로 점진적 이전

**완료 기준:** ✅ 완료 (2026-03-03) — Next.js `/policy`, `/updates`에서 MDX 렌더링으로 제공. ADR-005 참조.

---

## 향후 고려 (Backlog)

> 아래 항목들은 현재 프로젝트 범위에서 제외되어 백로그로 이동합니다.
> 향후 필요에 따라 별도 계획을 수립하여 진행합니다.

### 3-2. 감사보고일 대시보드 ⏸

**배경:** `disclosureAnalysis` 배치로 추출한 감사보고일 데이터를 대시보드로 시각화하는 기능.

- [ ] disclosureAnalysis 결과 파일 포맷 및 저장 위치 정리
- [ ] API 엔드포인트 노출 (예: `GET /api/dashboard/reporting-dates?year=YYYY`)
- [ ] Next.js `/dashboard` 페이지 구현 (12월 결산 감사보고일 분포 차트)

> **선행 조건:** disclosureAnalysis 배치 결과물의 정기적 생성 및 API 연계 설계

### 3-3. LLM 감사보고서 분석 (탐색) ⏸

**배경:** 외부 LLM API를 활용하여 감사보고서 자동 요약·이상 탐지 PoC를 수행하는 기능.

- [ ] 외부 LLM API 기준 클라이언트/설정 모듈 설계
- [ ] 감사보고서 자동 요약 API 및 UI PoC (예: `/llm-lab` 페이지)
- [ ] 이상 탐지 프로토타입

> **선행 조건:** LLM API 선택(Claude/OpenAI 등), 사용 정책 검토, 비용 계획

---

## 참고

- 각 Task 완료 시 관련 ADR이 있으면 `docs/adr/`에 기록.
- 기술 스택 변경이 발생하면 기획서 7절과 이 문서를 함께 업데이트.
- Phase 2/3 관련 변경·의사결정이 있을 경우, 가능하면 서비스별 README와 ADR을 함께 갱신하여 실행 순서·의존 관계를 문서화한다.
