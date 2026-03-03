# 서비스 통합 가이드라인 — Agent 참조 섹션 설계

## 배경

`docs/refactoring/cross-cutting/rf-2026-03-03-service-integration-guidelines.md`의 §1~§6은
아키텍처 방향 합의용으로 잘 작성되어 있으나, AI 코딩 에이전트가 서비스 개발 시
실행 근거로 참조하기 위한 **명시적 규칙, 코드 예제, 판단 기준, 완료 체크리스트**가 없음.

## 목표

기존 문서에 §7~§10을 추가하여 에이전트가 "이 문서를 읽으면 바로 실행할 수 있는" 상태로 만든다.

---

## §7. API 공통 규약

### 응답 포맷 (3가지 공통 셰입)

```json
// 단건 조회/생성/수정
{ "data": { ... } }

// 목록 조회
{
  "data": [...],
  "pagination": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
}

// 에러
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

### HTTP 상태 코드 → error.code 매핑

| 상황 | HTTP | error.code |
|------|------|-----------|
| 성공 (조회/수정/삭제) | 200 | — |
| 생성 성공 | 201 | — |
| 요청 오류 | 400 | `VALIDATION_ERROR` |
| 인증 실패 | 401 | `UNAUTHORIZED` |
| 권한 없음 | 403 | `FORBIDDEN` |
| 리소스 없음 | 404 | `NOT_FOUND` |
| 충돌 | 409 | `CONFLICT` |
| 서버 오류 | 500 | `INTERNAL_ERROR` |

### API 버전 관리

- prefix: `/api/v1/`
- Breaking change 발생 시: `/api/v2/` 추가, v1 응답에 `Deprecation: true` 헤더 추가
- v1 → v2 전환 시 최소 3개월 병행 유지 후 v1 제거

### 페이지네이션 쿼리 파라미터

목록 API는 다음 파라미터를 일관되게 지원한다.

- `page` (default: 1)
- `limit` (default: 20)
- `sort` (정렬 필드명, default: `createdAt`)
- `order` (`asc` | `desc`, default: `desc`)

---

## §8. BFF(Route Handler) 사용 판단 기준

### 의사결정 트리

```
새 Next.js 페이지/컴포넌트에서 데이터를 가져올 때:

Q1. 여러 서비스 API를 조합해 단일 응답을 만들어야 하는가?
  YES → BFF 사용
  NO  → Q2

Q2. 서버 전용 자격증명(API key, service account 등)이 필요한가?
  YES → BFF 사용
  NO  → Q3

Q3. 클라이언트에서 직접 호출 시 CORS 제한이 있는가?
  YES → BFF 사용
  NO  → Server Component에서 직접 fetch [기본값]

판단 불명확 시 기본값: 직접 호출 (YAGNI)
```

### BFF 파일 위치

```
apps/web/src/app/api/{service}/[...path]/route.ts
```

### Server Component 직접 호출 예시 (BFF 불필요)

```typescript
// apps/web/src/app/eval/page.tsx
async function EvalPage() {
  const res = await fetch(`${process.env.QUALITYEVAL_URL}/api/v1/risk-items`, {
    headers: { Authorization: `Bearer ${await getToken()}` },
  });
  const { data, pagination } = await res.json();
  return <RiskItemList items={data} pagination={pagination} />;
}
```

### BFF Route Handler 예시 (여러 서비스 조합)

```typescript
// apps/web/src/app/api/dashboard/route.ts
export async function GET() {
  const [evalRes, timesheetRes] = await Promise.all([
    fetch(`${process.env.QUALITYEVAL_URL}/api/v1/summary`),
    fetch(`${process.env.TIMESHEET_URL}/api/v1/summary`),
  ]);
  return Response.json({
    data: {
      eval: (await evalRes.json()).data,
      timesheet: (await timesheetRes.json()).data,
    },
  });
}
```

---

## §9. 로컬 개발 인증 처리

### 3가지 시나리오

**A. 전체 스택 (Docker Compose + Keycloak)**

```bash
docker compose up -d
# Keycloak /auth/admin 에서 yss realm 유저 생성 후 로그인
```

**B. 서비스 단독 실행 (실제 Keycloak 연동)**

```env
KEYCLOAK_JWKS_URI=http://localhost/auth/realms/yss/protocol/openid-connect/certs
TOKEN_ISSUER=http://localhost/auth/realms/yss
```

**C. 인증 없이 개발 (SKIP_AUTH)**

Express 미들웨어 권장 패턴:

```javascript
// middleware/auth.js
const jwtMiddleware = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production' && process.env.SKIP_AUTH === 'true') {
    req.user = {
      sub: 'dev-user',
      roles: (process.env.DEV_ROLES || 'admin').split(','),
      org: process.env.DEV_ORG || 'dev',
    };
    return next();
  }
  verifyJwt(req, res, next);
};
```

Flask 미들웨어 권장 패턴:

```python
# utils/auth.py
import os
from functools import wraps

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if os.getenv('SKIP_AUTH') == 'true' and os.getenv('FLASK_ENV') != 'production':
            g.user = {
                'sub': 'dev-user',
                'roles': os.getenv('DEV_ROLES', 'admin').split(','),
                'org': os.getenv('DEV_ORG', 'dev'),
            }
            return f(*args, **kwargs)
        return verify_jwt(f)(*args, **kwargs)
    return decorated
```

### 환경변수 규칙

| 변수 | 설명 | 허용 환경 |
|------|------|----------|
| `SKIP_AUTH=true` | JWT 검증 우회, `DEV_ROLES`로 역할 주입 | `.env.local` 전용 |
| `DEV_ROLES` | 개발 시 주입할 역할 목록 (comma-separated) | `.env.local` 전용 |
| `DEV_ORG` | 개발 시 주입할 조직 | `.env.local` 전용 |

> **주의:** `SKIP_AUTH=true`는 `docker-compose.prod.yml` 및 프로덕션 `.env`에 절대 포함 금지.

---

## §10. 서비스별 마이그레이션 완료 기준 (Agent 체크리스트)

각 서비스의 API-first 전환 완료 여부를 다음 체크리스트로 검증한다.

### 도메인/API 계층

- [ ] UI 레이어(EJS 뷰, Jinja 템플릿, 정적 HTML 서빙) 완전 제거
- [ ] 모든 API 응답이 §7 공통 포맷(`{ data }` / `{ data, pagination }` / `{ error }`) 준수
- [ ] 목록 API에 `page`, `limit`, `sort`, `order` 파라미터 지원
- [ ] Breaking change 발생 시 `/api/v2/` 추가 및 `Deprecation: true` 헤더 적용

### 인증/권한

- [ ] Keycloak JWKS URI로 JWT 서명 검증 동작
- [ ] `req.user.roles` 또는 `X-Forwarded-Roles` 헤더 기반 권한 체크 동작
- [ ] `SKIP_AUTH=true` + `NODE_ENV !== 'production'` guard 포함한 개발 우회 패턴 구현

### 인프라 연동

- [ ] Traefik `traefik/dynamic/services.yml`에 라우팅 정의 완료
  - 웹 셸 내 경로: `/tools/{service}/...`
  - API 경로: `/{service}/api/v1/...`
- [ ] `GET /health` 헬스체크 엔드포인트가 `200 { status: "ok" }` 응답

### Next.js 통합

- [ ] §8 판단 기준에 따라 BFF 또는 Server Component 직접 호출 방식 결정 및 적용
- [ ] 서비스 API 호출 시 `Authorization: Bearer <token>` 헤더 전달
- [ ] 환경변수 `{SERVICE}_URL` (예: `QUALITYEVAL_URL`)로 서비스 주소 참조
