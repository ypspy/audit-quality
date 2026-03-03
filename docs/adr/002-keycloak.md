# ADR-002: Keycloak 24를 OIDC/SSO 솔루션으로 선택

**날짜:** 2026-02-27
**상태:** 결정됨

---

## Context

현재 각 서비스는 인증 방식이 제각각이다:

- qualityPortal, qualityEval: Passport.js (세션 기반)
- timesheet: 자체 세션
- dart-for-auditor: 자체 세션
- local-inquiry-site: Flask-Login

서비스마다 별도 로그인이 필요하고, 토큰 공유나 Single Sign-Out이 불가능하다. 통합 포털을 위한 SSO 솔루션이 필요하다.

---

## Options Considered

### Option A: 자체 JWT 서버 (현재 계획)

- qualityPortal 또는 별도 auth 서비스에서 JWT 발급.
- Redis에 Refresh Token 저장.
- 구현이 간단하지만 표준 OIDC 미지원 → next-auth 등 외부 라이브러리와 연동 어려움.
- 사용자 관리(등록, 비밀번호 정책, MFA) 기능을 직접 구현해야 함.

### Option B: Auth0 (Okta) 관리형 서비스

- 설정이 간단하고 OIDC 표준 완전 지원.
- 사용자 수 증가 시 비용 발생.
- 외부 클라우드 서비스 → 내부 데이터가 외부로 전송될 수 있음. 회계법인 보안 정책상 부적합.

### Option C: Keycloak 24 자체 호스팅 (채택)

- 오픈소스 OIDC/OAuth2 표준 구현체 (Red Hat 지원).
- 자체 호스팅으로 데이터 외부 유출 없음.
- next-auth v5 공식 Keycloak Provider 제공.
- RBAC(역할 기반 접근 제어), MFA, 비밀번호 정책, 세션 관리 내장.
- PostgreSQL 백엔드로 데이터 영속성 보장.

---

## Decision

**Keycloak 24를 자체 호스팅 OIDC 서버로 채택한다.**

- Realm: `yss`
- Clients: `next-app` (PKCE), `express-services`, `flask-service`
- Roles: `admin`, `auditor`, `qc-manager`
- 인증 흐름: Authorization Code + PKCE
- 각 Express 서비스는 Keycloak Public Key로 JWT 서명 검증.
- local-inquiry-site는 `python-jose`로 JWT 검증.

---

## Consequences

**긍정적:**
- 1회 로그인으로 모든 서비스 접근 (진정한 SSO).
- 사용자 관리·비밀번호 정책·MFA를 Keycloak 어드민에서 일원화.
- 표준 OIDC → next-auth, Spring Security 등 어떤 클라이언트와도 연동 가능.

**부정적·주의사항:**
- Keycloak 자체가 상당한 메모리(최소 512MB)를 사용함. 서버 사양 고려 필요.
- Realm 설정이 복잡하므로 초기 설정 문서화 필수 (export/import 활용).
- Keycloak DB(PostgreSQL) 장애 시 전체 인증 불가. 가용성 확보 필요.
