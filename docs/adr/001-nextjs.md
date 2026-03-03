# ADR-001: Next.js 15 통합 UI 셸 도입

**날짜:** 2026-02-27
**상태:** 결정됨

---

## Context

현재 각 서비스(qualityPortal, qualityEval, timesheet, dart-for-auditor, local-inquiry-site)는 각자 EJS 또는 Jinja2 서버사이드 렌더링으로 UI를 제공한다. 그 결과:

- 서비스마다 별도 URL과 로그인이 존재해 사용자 경험이 단절됨.
- 공통 네비게이션·헤더 컴포넌트가 없어 일관된 UI 유지가 어려움.
- 각 서비스가 뷰와 비즈니스 로직을 동시에 처리해 관심사 분리가 안 됨.

통합 포털 구현을 위해 단일 프론트엔드 레이어가 필요하다.

---

## Options Considered

### Option A: Nginx에서 각 EJS 앱을 서브패스로 프록시

- 구현이 단순하고 기존 코드 변경이 없음.
- 서비스별 스타일·네비게이션이 통일되지 않음.
- SSO 구현이 각 서비스마다 별도로 필요함.

### Option B: React SPA (Vite/CRA) + API 호출

- 완전한 클라이언트 렌더링. SEO 불필요하므로 적합.
- SSR 미지원으로 초기 로딩 시 빈 화면 발생 가능.
- API 라우팅 설계를 별도로 해야 함.

### Option C: Next.js 15 App Router (채택)

- React Server Components(RSC)로 서버에서 데이터 페칭 후 렌더링 → 초기 로딩 빠름.
- next-auth v5로 Keycloak OIDC 연동이 공식 지원됨.
- App Router의 레이아웃 시스템으로 공통 네비게이션 일원화.
- API Routes / Server Actions으로 내부 서비스 호출을 클라이언트에 노출하지 않고 처리 가능.

---

## Decision

**Next.js 15 (App Router, TypeScript)를 통합 UI 셸로 채택한다.**

- 기존 Express/Flask 서비스는 **API 전용**으로 전환 (EJS 뷰 제거).
- Next.js가 모든 페이지 렌더링을 담당하고, Server Components에서 내부 API를 호출.
- 점진적 마이그레이션: 서비스별로 순차적으로 EJS → Next.js 이전.

---

## Consequences

**긍정적:**
- 단일 URL 아래 통합된 사용자 경험 제공.
- 공통 네비게이션·레이아웃·인증 로직 일원화.
- TypeScript 타입 안전성 확보.

**부정적·주의사항:**
- EJS와 Next.js 병존 기간 동안 코드베이스 복잡도 증가.
- Express 개발자가 Next.js App Router 학습 필요.
- 서비스 수가 많아 이전 작업 공수가 상당함 (Phase 2 전체 기간).
