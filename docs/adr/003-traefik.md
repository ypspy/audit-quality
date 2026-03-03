# ADR-003: Traefik v3를 API Gateway로 선택

**날짜:** 2026-02-27
**상태:** 결정됨

---

## Context

여러 서비스를 단일 도메인 아래 라우팅하고, TLS 인증서 관리와 인증 전처리(ForwardAuth)를 담당하는 리버스 프록시가 필요하다.

---

## Options Considered

### Option A: Nginx

- 가장 널리 사용되는 웹서버/프록시.
- TLS 설정이 수동 (Certbot 별도 운용).
- Docker 서비스 추가·제거 시 설정 파일 수동 수정 필요.
- ForwardAuth 패턴 구현이 복잡 (lua 모듈 또는 nginx-plus 필요).

### Option B: Caddy v2

- 자동 HTTPS (Let's Encrypt 내장).
- 설정 파일(`Caddyfile`)이 단순.
- Docker 서비스 디스커버리 미지원 → 컨테이너 추가 시 재설정 필요.
- 미들웨어 생태계가 Traefik 대비 제한적.

### Option C: Traefik v3 (채택)

- **Docker-native**: 컨테이너 레이블로 라우팅 자동 설정. 서비스 추가 시 `docker-compose.yml` 레이블만 추가하면 됨.
- 자동 TLS (Let's Encrypt 내장, 인증서 갱신 자동).
- ForwardAuth 미들웨어 내장 → Keycloak 토큰 검증 연동 용이.
- Rate Limiting, IP Allowlist, Circuit Breaker 미들웨어 내장.
- Traefik Dashboard로 라우팅 현황 시각화.

---

## Decision

**Traefik v3를 API Gateway 및 리버스 프록시로 채택한다.**

주요 설정:
- Let's Encrypt HTTP Challenge로 자동 TLS.
- Docker Provider로 서비스 자동 디스커버리.
- ForwardAuth 미들웨어 → Keycloak 연동.
- IP Allowlist 미들웨어 → local-inquiry-site LAN 전용 제한.
- Rate Limiting → DART 수집 API 보호.

---

## Consequences

**긍정적:**
- 컨테이너 레이블 기반 설정 → 서비스 추가·삭제 시 Traefik 재시작 불필요.
- TLS 인증서 자동 갱신으로 운영 부담 감소.
- 단일 진입점으로 보안 정책(Rate Limit, IP 차단) 일원화.

**부정적·주의사항:**
- Nginx 대비 학습 곡선 존재 (특히 미들웨어 체인 개념).
- Traefik 컨테이너 장애 시 전체 서비스 접근 불가 → 헬스체크 및 자동 재시작 설정 필수.
