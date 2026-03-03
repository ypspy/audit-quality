# Keycloak 24 SSO (Phase 1-3)

- **Realm:** `yss`
- **클라이언트:** `next-app`(공개), `express-services`(bearer-only), `flask-service`(bearer-only)
- **Realm 역할:** `admin`, `auditor`, `qc-manager`

## Realm import

`realm/yss-realm.json`은 Keycloak 기동 시 `--import-realm`으로 자동 로드됩니다.
이미 동일 이름 realm이 있으면 import는 건너뜁니다.

## 관리자

- URL: https://localhost/auth (Traefik 경유) 또는 http://keycloak:8080 (내부)
- 기본 계정: `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` (docker-compose 또는 .env)

## JWKS (JWT 검증용)

- 공개 키: `https://localhost/auth/realms/yss/protocol/openid-connect/certs`
- 내부: `http://keycloak:8080/auth/realms/yss/protocol/openid-connect/certs`

## 사용자/역할 생성

관리 콘솔에서 Realm `yss` → Users → Add user, Role mapping으로 realm roles 부여.
