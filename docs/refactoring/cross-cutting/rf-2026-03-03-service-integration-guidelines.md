## 통합 웹 셸 + 개별 서비스 설계 일반론

### 1. 배경 (Background)

- **상황**
  - 각 서비스(`dart-for-auditor`, `qualityEval`, `timesheet`, Flask 기반 앱 등)는 원래 개별 웹앱(자체 UI + 서버)으로 설계되었고, 현재는 Next.js 웹 셸(`apps/web`) 안에서도 함께 제공하려고 합니다.
- **문제**
  - 같은 기능이라도
    - 서비스 **독립 실행 UI**에서의 동작·URL·권한 처리와
    - **통합 웹 셸(Next.js)** 안에서의 동작·URL·권한 처리
    가 어긋나면서 사용 경험과 유지보수가 복잡해지는 현상이 발생합니다.
- **목적**
  - 이 문서는 위 문제를 줄이기 위해, 모든 서비스에 공통으로 적용 가능한 **서비스 설계 및 리팩토링 일반 원칙**을 정의합니다.

### 2. 범위 (Scope)

- 포함되는 대상:
  - `audit-quality` 루트 리포지토리에서 관리하는 모든 웹 서비스
    - 예: `dart-for-auditor`, `qualityEval`, `timesheet`, Flask 기반 앱, `apps/web` 등
  - 해당 서비스들의
    - 도메인 로직 구조
    - HTTP API 설계
    - 독립 UI와 Next.js 웹 셸 UI 간의 관계
- 포함하지 않는 것(Out of scope):
  - 개별 화면의 상세 UI/UX 디자인(색상, 여백, Typography 등)
  - 특정 라이브러리(예: React Table, Chart 등)의 선택 자체

### 3. 변경 내용 (Changes) — 서비스 설계 관점

#### 3.1 서비스는 API-우선(API-first)로

각 서비스(`dart-for-auditor`, `qualityEval`, `timesheet`, Flask 앱 등)는 공통적으로 아래 세 레이어를 갖는 것을 목표로 합니다.

- **도메인 서비스 계층**
  - 비즈니스 로직, 권한 체크, 필터링/정렬, DB 처리 담당.
- **HTTP API 계층**
  - REST/GraphQL 등으로 외부에 노출되는 계약.
  - 응답 포맷, 에러 구조, 페이지네이션, 정렬·검색 파라미터 규약을 명시합니다.
- **(선택) 자체 UI 계층**
  - 자신의 API를 호출해 화면을 구성하는 전용 웹 UI.

> 결과적으로, “도메인 + API”가 항상 먼저 존재하고,  
> Next.js 웹 셸의 페이지와 각 서비스의 독립 UI는 **같은 API를 사용하는 클라이언트**가 됩니다.

#### 3.2 통합 웹 셸은 “얇은 통합 레이어”

- Next.js(`apps/web`)의 역할:
  - **메뉴/라우팅/레이아웃/인증 UX** 담당.
  - 각 서비스별 페이지는 **서비스 API를 호출해 화면만 그리는 역할**에 최대한 가깝게 유지합니다.
- 설계 규칙:
  - 비즈니스 판단·필터·권한 로직은 서비스 쪽에 두고,
  - Next.js 측에서는 쿼리 파라미터 조합, 폼 입력 수집, 결과 표시 역할에 집중합니다.

#### 3.3 인증·권한 공통화

- 공통 규칙:
  - 모든 서비스 API는 **같은 인증 방식을 이해**하도록 맞춥니다.
    - 예: `Authorization: Bearer <token>`, 토큰 안의 `roles`, `org` 클레임 등.
  - Next.js 웹 셸은 로그인 후 받은 세션/토큰을 **백엔드 서비스 호출 시 그대로 전달**합니다.
- 서비스 쪽에서는:
  - “이 토큰/헤더를 받으면 이런 역할/조직으로 해석한다”는 **권한 매핑 규칙을 공통 문서화**합니다.
- 독립 실행 시에도 되도록 같은 Keycloak/SSO 플로우를 쓰되,
  - 최소한 **토큰 구조와 권한 해석 로직은 동일**하게 유지합니다.

#### 3.4 URL·네비게이션 규칙 통일

- 웹 셸 내 공통 규칙 예시:
  - 툴/서비스 계열: `/tools/{service}/...`
    - `/tools/dart/search`
    - `/tools/quality-eval/risk-items`
    - `/tools/timesheet/report`
- 각 서비스의 독립 UI:
  - 내부 URL 구조, 쿼리 파라미터, 상세 페이지 패턴을 **웹 셸과 최대한 맞추거나, 최소한 대응 관계를 문서화**합니다.
  - 필요하면 리버스 프록시/리다이렉트로 외부 링크·북마크가 깨지지 않게 조정합니다.

#### 3.5 공통 UI 패턴 정의

- 포털 기준으로:
  - **검색/필터 폼, 테이블, 페이징, 상세 패널, 모달** 등 자주 쓰는 패턴을 공통 컴포넌트로 정의합니다.
  - 각 서비스 페이지는 이 컴포넌트에 **서비스별 API URL·파라미터만 주입**하는 형태로 통일합니다.
- 효과:
  - UX·스타일은 포털이 통제하고,
  - 데이터·도메인 규칙은 각 서비스가 통제하는 구조가 됩니다.

#### 3.6 멀티 리포지토리/멀티 스택 정렬

- 각 서비스는 **자기 리포지토리·자기 Dockerfile**로 독립 개발/배포 가능합니다.
- 루트 인프라 리포지토리(`audit-quality`)는:
  - 각 서비스를 **컨테이너 단위로 조합**하고,
  - Traefik/Keycloak/Observability/Next.js 셸 구성을 관리합니다.
- 공통 규칙:
  - “서비스 내부 로직을 건드릴 때는 서비스 리포지토리에서 작업”
  - “라우팅, 프록시, 인증 흐름, 포털 UI는 루트 인프라/Next.js에서 작업”

### 4. 적용 방법 (Migration / Usage)

리팩토링이나 신규 서비스 설계 시, 이 문서를 다음과 같이 사용합니다.

1. **현재 상태 인벤토리 작성**
   - 각 서비스에 대해:
     - 제공 기능·URL 목록
     - 검색/필터/정렬 옵션
     - 권한/역할 제약
     - **독립 실행 UX vs 포털 UX** 차이를 정리합니다.
   - 이를 표로 정리하여:
     - **API로 끌어올릴 공통 도메인 기능**
     - **포털 전용 UX 요소**
     를 구분합니다.

2. **도메인/서비스 계층 분리 리팩토링**
   - 컨트롤러/라우터에서 도메인 로직을 제거하고 `services/`, `core/` 등으로 이동합니다.
   - 이 도메인 계층만 테스트해도 대부분의 로직이 커버되도록 구조를 재편합니다.
   - UI(템플릿/뷰)는 가능한 한 이 도메인 계층 또는 HTTP API를 호출하도록 변경합니다.

3. **Next.js 통합 패턴 적용**
   - Next.js에서 서비스별 페이지를 만들 때:
     - 공통 레이아웃 + 공통 컴포넌트를 사용합니다.
     - 데이터는 **서비스 API에서만 가져오기**(로컬 모킹/별도 비즈니스 로직 재구현 지양)를 원칙으로 합니다.
   - 필요 시 서비스별로 “BFF(Route Handler)”를 두고, 여기서만 서비스 API를 호출하도록 구성할 수 있습니다.

4. **인증/URL 정리**
   - Keycloak/Traefik 설정에서 각 서비스를 동일한 인증 정책 아래에서 보호합니다.
   - 포털–서비스 간 토큰 전달/검증 방식을 하나의 규약으로 정리하고, 서비스별 구현을 이 규약에 맞춥니다.
   - URL 매핑/리다이렉트 정책을 Traefik 또는 앱 레벨에서 정리해, 북마크와 외부 링크가 최대한 유지되도록 합니다.

5. **리팩토링 문서와 로드맵 연동**
   - 이 문서를 기반으로:
     - `docs/roadmap.md`에 서비스별 작업 단위를 체크리스트로 추가합니다.
       - 도메인 계층 분리
       - API 규약 정렬
       - Next.js 통합 페이지 구성
       - 인증/URL 정리
       - 테스트 및 운영 검증
   - 실제 리팩토링을 수행한 후에는, 각 서비스 또는 횡단 영역에 대해 별도의 리팩토링 문서를 `docs/refactoring/` 하위에 추가합니다.

### 5. 영향 범위 및 리스크 (Impact)

- **긍정적 영향**
  - 서비스별 독립 UI와 포털 UI 간의 동작 차이를 줄여, 사용자 경험을 일관되게 유지할 수 있습니다.
  - 도메인 로직과 UI를 분리함으로써, 테스트·변경·재사용성이 높아집니다.
  - 신규 서비스 추가 시에도 동일한 패턴으로 설계·통합할 수 있어, 장기적인 유지보수 비용이 감소합니다.
- **리스크 / 고려사항**
  - 초기에는 각 서비스 구조를 재정렬해야 하므로, 일정/리스크 관리가 필요합니다.
  - 인증/권한 구조를 통합하는 과정에서 기존 권한 정책과의 차이를 면밀히 검토해야 합니다.
  - Next.js 웹 셸에 과도한 도메인 로직이 남아 있지 않은지 점검하고, 점진적으로 서비스 계층으로 내려보내야 합니다.

### 6. 관련 문서/PR (References)

- **기획/요약**
  - `docs/project-planning.md`
  - `docs/requirements.md`
  - `docs/project-summary.md`
- **Architecture Decision Records**
  - `docs/adr/001-nextjs.md` — Next.js 15 통합 UI 셸 도입
  - `docs/adr/002-keycloak.md` — Keycloak OIDC/SSO 선택
  - `docs/adr/003-traefik.md` — Traefik v3 API Gateway 선택
  - `docs/adr/004-postgres.md` — PostgreSQL 마이그레이션 결정
  - `docs/adr/005-mkdocs-traefik-integration.md` — MkDocs → Next.js MDX 렌더링 전환
- **로드맵**
  - `docs/roadmap.md` — Phase별 서비스 통합 및 리팩토링 과제

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
