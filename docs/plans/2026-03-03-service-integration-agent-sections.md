# 서비스 통합 가이드라인 — Agent 참조 섹션 추가 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `rf-2026-03-03-service-integration-guidelines.md`에 §7~§10 (API 공통 규약, BFF 판단 기준, 로컬 인증 처리, 마이그레이션 체크리스트)을 추가하여 AI 코딩 에이전트가 서비스 개발 시 즉시 참조할 수 있도록 한다.

**Architecture:** 기존 §1~§6 설계 원칙 문서 하단에 4개 섹션 추가. 각 섹션은 코드 예제, 판단 기준, 완료 체크리스트 형태로 작성.

**Tech Stack:** Markdown (Korean), JSON code blocks, TypeScript/JavaScript/Python 코드 예제

**Design doc:** `docs/plans/2026-03-03-service-integration-agent-guide-design.md`

---

### Task 1: §7 API 공통 규약 추가

**Files:**
- Modify: `docs/refactoring/cross-cutting/rf-2026-03-03-service-integration-guidelines.md` (파일 끝에 추가)

**Step 1: 파일 끝 확인**

`docs/refactoring/cross-cutting/rf-2026-03-03-service-integration-guidelines.md` 파일의 마지막 줄을 확인한다.
현재 마지막 줄은 `### 6. 관련 문서/PR (References)` 섹션의 `docs/roadmap.md` 항목이어야 한다.

**Step 2: §7 섹션 추가**

파일 끝에 다음 내용을 추가한다.

```markdown
---

### 7. API 공통 규약 (Agent 참조 표준)

> 이 섹션은 AI 코딩 에이전트가 서비스 개발 시 직접 참조하는 실행 기준입니다.

#### 7.1 응답 포맷 (3가지 공통 셰입)

모든 서비스 API는 아래 세 가지 셰입 중 하나를 반환한다.

```json
// 단건 조회 / 생성 / 수정 / 삭제
{ "data": { ... } }

// 목록 조회
{
  "data": [...],
  "pagination": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
}

// 에러 (4xx / 5xx)
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

#### 7.2 HTTP 상태 코드 → error.code 매핑

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

#### 7.3 API 버전 관리

- 기본 prefix: `/api/v1/`
- Breaking change 발생 시: `/api/v2/` 엔드포인트를 추가하고, 기존 v1 응답에 `Deprecation: true` 헤더를 추가한다.
- v1 → v2 전환 시 최소 3개월 병행 유지 후 v1 제거.

#### 7.4 페이지네이션 쿼리 파라미터

목록을 반환하는 모든 API는 다음 파라미터를 지원한다.

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `page` | `1` | 페이지 번호 |
| `limit` | `20` | 페이지당 항목 수 |
| `sort` | `createdAt` | 정렬 필드 |
| `order` | `desc` | 정렬 방향 (`asc` \| `desc`) |
```

**Step 3: 추가 결과 확인**

파일을 열어 `### 7. API 공통 규약` 섹션이 정상적으로 존재하는지 확인한다.

---

### Task 2: §8 BFF 판단 기준 추가

**Files:**
- Modify: `docs/refactoring/cross-cutting/rf-2026-03-03-service-integration-guidelines.md`

**Step 1: §8 섹션 추가**

§7 섹션 바로 뒤에 다음 내용을 추가한다.

```markdown
---

### 8. BFF(Route Handler) 사용 판단 기준

#### 8.1 의사결정 트리

새 Next.js 페이지/컴포넌트에서 데이터를 가져올 때 아래 순서로 판단한다.

```
Q1. 여러 서비스 API를 조합해 단일 응답을 만들어야 하는가?
  YES → BFF 사용
  NO  → Q2

Q2. 서버 전용 자격증명(API key, service account token 등)이 필요한가?
  YES → BFF 사용
  NO  → Q3

Q3. 클라이언트에서 직접 호출 시 CORS 제한이 있는가?
  YES → BFF 사용
  NO  → Server Component에서 직접 fetch [기본값]

판단 불명확 시 기본값: 직접 호출 (YAGNI)
```

#### 8.2 BFF 파일 위치

```
apps/web/src/app/api/{service}/[...path]/route.ts
```

#### 8.3 Server Component 직접 호출 예시 (BFF 불필요한 경우)

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

#### 8.4 BFF Route Handler 예시 (여러 서비스 조합)

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
```

**Step 2: 추가 결과 확인**

`### 8. BFF(Route Handler) 사용 판단 기준` 섹션이 존재하는지 확인한다.

---

### Task 3: §9 로컬 개발 인증 처리 추가

**Files:**
- Modify: `docs/refactoring/cross-cutting/rf-2026-03-03-service-integration-guidelines.md`

**Step 1: §9 섹션 추가**

§8 섹션 바로 뒤에 다음 내용을 추가한다.

```markdown
---

### 9. 로컬 개발 인증 처리

#### 9.1 3가지 시나리오

**시나리오 A: 전체 스택 (Docker Compose + Keycloak)**

```bash
docker compose up -d
# Keycloak 어드민 콘솔(/auth/admin)에서 yss realm 유저 생성 후 로그인
```

**시나리오 B: 서비스 단독 실행 (실제 Keycloak 연동)**

```env
KEYCLOAK_JWKS_URI=http://localhost/auth/realms/yss/protocol/openid-connect/certs
TOKEN_ISSUER=http://localhost/auth/realms/yss
```

**시나리오 C: 인증 없이 개발 (SKIP_AUTH)**

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
from flask import g

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

#### 9.2 환경변수 규칙

| 변수 | 설명 | 허용 환경 |
|------|------|----------|
| `SKIP_AUTH=true` | JWT 검증 우회, `DEV_ROLES`로 역할 주입 | `.env.local` 전용 |
| `DEV_ROLES` | 개발 시 주입할 역할 (comma-separated, e.g. `admin,auditor`) | `.env.local` 전용 |
| `DEV_ORG` | 개발 시 주입할 조직 식별자 | `.env.local` 전용 |

> **주의:** `SKIP_AUTH=true`는 `docker-compose.prod.yml` 및 프로덕션 `.env`에 절대 포함 금지.
```

**Step 2: 추가 결과 확인**

`### 9. 로컬 개발 인증 처리` 섹션이 존재하는지 확인한다.

---

### Task 4: §10 마이그레이션 완료 기준 추가

**Files:**
- Modify: `docs/refactoring/cross-cutting/rf-2026-03-03-service-integration-guidelines.md`

**Step 1: §10 섹션 추가**

§9 섹션 바로 뒤에 다음 내용을 추가한다.

```markdown
---

### 10. 서비스별 마이그레이션 완료 기준 (Agent 체크리스트)

각 서비스의 API-first 전환이 완료되었는지 이 체크리스트로 검증한다.
모든 항목이 충족될 때 해당 서비스의 마이그레이션이 완료된 것으로 간주한다.

#### 도메인/API 계층

- [ ] UI 레이어(EJS 뷰, Jinja 템플릿, 정적 HTML 서빙) 완전 제거
- [ ] 모든 API 응답이 §7 공통 포맷(`{ data }` / `{ data, pagination }` / `{ error }`) 준수
- [ ] 목록 API에 `page`, `limit`, `sort`, `order` 파라미터 지원
- [ ] Breaking change 발생 시 `/api/v2/` 추가 및 `Deprecation: true` 헤더 적용

#### 인증/권한

- [ ] Keycloak JWKS URI로 JWT 서명 검증 동작
- [ ] `req.user.roles` 또는 `X-Forwarded-Roles` 헤더 기반 권한 체크 동작
- [ ] `SKIP_AUTH=true` + `NODE_ENV !== 'production'` guard 포함한 개발 우회 패턴 구현 (§9 참조)

#### 인프라 연동

- [ ] Traefik `traefik/dynamic/services.yml`에 라우팅 정의 완료
  - 웹 셸 내 경로: `/tools/{service}/...`
  - API 경로: `/{service}/api/v1/...`
- [ ] `GET /health` 헬스체크 엔드포인트가 `200 { "status": "ok" }` 응답

#### Next.js 통합

- [ ] §8 판단 기준에 따라 BFF 또는 Server Component 직접 호출 방식 적용
- [ ] 서비스 API 호출 시 `Authorization: Bearer <token>` 헤더 전달
- [ ] 환경변수 `{SERVICE}_URL` (예: `QUALITYEVAL_URL`, `TIMESHEET_URL`)로 서비스 주소 참조
```

**Step 2: 추가 결과 확인**

`### 10. 서비스별 마이그레이션 완료 기준` 섹션이 존재하는지 확인한다.
최종적으로 파일이 `### 10.` 으로 끝나는지 확인한다.

---

### Task 5: docs/plans/README.md 인덱스 업데이트

**Files:**
- Modify: `docs/plans/README.md`

**Step 1: 테이블에 새 설계 문서 항목 추가**

`docs/plans/README.md`의 현재 문서 테이블에 다음 행을 추가한다.

```markdown
| [2026-03-03-service-integration-agent-guide-design.md](./2026-03-03-service-integration-agent-guide-design.md) | `rf-2026-03-03-service-integration-guidelines.md` §7~§10 Agent 참조 섹션 설계 (API 규약, BFF 기준, 로컬 인증, 체크리스트) |
```

---

### Task 6: 최종 커밋

**Step 1: 변경 파일 확인**

```bash
git diff --stat
```

예상 출력:
```
docs/refactoring/cross-cutting/rf-2026-03-03-service-integration-guidelines.md | 추가됨
docs/plans/2026-03-03-service-integration-agent-guide-design.md               | 추가됨
docs/plans/2026-03-03-service-integration-agent-sections.md                   | 추가됨
docs/plans/README.md                                                           | 수정됨
```

**Step 2: 커밋**

```bash
git add docs/refactoring/cross-cutting/rf-2026-03-03-service-integration-guidelines.md \
        docs/plans/2026-03-03-service-integration-agent-guide-design.md \
        docs/plans/2026-03-03-service-integration-agent-sections.md \
        docs/plans/README.md

git commit -m "docs: add agent-reference sections (§7~§10) to service integration guidelines

- §7: API 공통 규약 (응답 포맷, 상태코드 매핑, 버전 관리, 페이지네이션)
- §8: BFF 판단 기준 (의사결정 트리 + TS 코드 예제)
- §9: 로컬 개발 인증 처리 (SKIP_AUTH 패턴 Express/Flask)
- §10: 서비스별 마이그레이션 완료 체크리스트"
```
