# dart-for-auditor API-first 리팩토링 계획

**상태:** ✅ 완료 (2026-03-04)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `rf-2026-03-03-service-integration-guidelines.md` §7~§10 체크리스트를 기준으로 `dart-for-auditor`를 API-first 규약에 맞게 정렬한다.

**Architecture:** dart-for-auditor API 서버는 이미 도메인/API 레이어 분리가 되어 있으나, 응답 포맷·에러 코드·인증 패턴·URL 구조가 가이드라인과 어긋난다. 각 Task는 가이드라인 §10 체크리스트의 항목 하나씩을 충족시키고 테스트를 통과한 뒤 커밋한다.

**Tech Stack:** Node.js/Express (dart-for-auditor), Next.js 15 App Router (apps/web), Jest + supertest, Traefik v3 YAML

---

## 현황 분석 (Gap Analysis)

| §10 항목 | 현재 상태 | 필요 작업 |
|---------|-----------|-----------|
| 응답 포맷 `{ data }` / `{ data, pagination }` | `{ total, disclosures }` (비준수) | disclosureService + controller + BFF + Client 변경 |
| 에러 포맷 `{ error: { code, message } }` | `{ error: 'Bad Request', message }` (비준수) | controller 에러 핸들러 전면 변경 |
| 목록 API `page, limit, sort, order` | ✅ 지원됨 | — |
| SKIP_AUTH + NODE_ENV guard | `SKIP_KEYCLOAK_AUTH` 사용, production guard 없음 | keycloakJwt.js 변경 + .env.example 업데이트 |
| Keycloak JWKS JWT 검증 | ✅ 동작 | — |
| `req.user.roles` | ✅ 구현됨 | — |
| Traefik 라우팅 (`/api/dart`) | `/api/dart` prefix strip으로 동작 | `/api/v1` prefix 도입 후 Traefik + BFF URL 업데이트 |
| `GET /health` → `200 { "status": "ok" }` | `/api/health` 경로 + 복잡 응답 | `/health` 경로 추가 |
| BFF/Server Component | ✅ BFF route handlers 구현됨 | — |
| `Authorization: Bearer` 전달 | ✅ BFF에서 전달 | — |
| 환경변수 `DART_INTERNAL_URL` | ✅ 사용 중 | — |

**핵심 변경 범위:**
- `dart-for-auditor/api/` — 응답 포맷, 에러 코드, 인증 패턴, 헬스체크
- `apps/web/src/app/api/web/dart/` — BFF URL 업데이트
- `apps/web/src/app/dart/DartPageClient.tsx` — 새 응답 포맷으로 파싱 변경
- `traefik/dynamic/services.yml` — 헬스체크 경로만 업데이트 (없으면 skip)

---

## Task 1: 응답 포맷 §7 준수 — 목록 API (`/api/disclosures`)

**목표:** `disclosureService`와 `disclosureController`를 수정해 성공 응답을
`{ data: [...], pagination: { total, page, limit, totalPages } }` 형태로 변경한다.

**Files:**
- Modify: `dart-for-auditor/api/services/disclosureService.js` (line 324)
- Modify: `dart-for-auditor/api/controllers/disclosureController.js` (line 104)
- Modify: `apps/web/src/app/dart/DartPageClient.tsx` (lines 17~22, 84~85)
- Test: `dart-for-auditor/tests/unit/api/controllers/disclosureController.test.js`

### Step 1-1: 실패 테스트 작성

`dart-for-auditor/tests/unit/api/controllers/disclosureController.test.js` 를 열어 아래 테스트를 추가한다.

```javascript
// 기존 테스트 아래에 추가
describe('§7 응답 포맷 준수', () => {
  it('getDisclosures 성공 시 { data, pagination } 형태 반환', async () => {
    const mockDisclosures = [{ _id: '1', corp_name: '삼성' }];
    jest.spyOn(DisclosureService, 'getDisclosures').mockResolvedValue({
      data: mockDisclosures,
      pagination: { total: 1, page: 1, limit: 20, totalPages: 1 }
    });

    const req = { query: {} };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await disclosureController.getDisclosures(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.any(Array),
        pagination: expect.objectContaining({
          total: expect.any(Number),
          page: expect.any(Number),
          limit: expect.any(Number),
          totalPages: expect.any(Number),
        })
      })
    );
  });
});
```

### Step 1-2: 테스트 실패 확인

```bash
cd dart-for-auditor
npx jest tests/unit/api/controllers/disclosureController.test.js -t "§7 응답 포맷" --no-coverage
```
Expected: FAIL — `disclosures` 키가 반환되어 `data` 키 없음.

### Step 1-3: disclosureService return 값 변경

`dart-for-auditor/api/services/disclosureService.js` line 324 부근:

```javascript
// Before
const response = { total, disclosures };

// After
const totalPages = limitValue > 0 ? Math.ceil(total / limitValue) : 1;
const response = {
  data: disclosures,
  pagination: { total, page: pageNum, limit: limitValue, totalPages }
};
```

### Step 1-4: disclosureController 응답 변경

`dart-for-auditor/api/controllers/disclosureController.js` line 104~105:

```javascript
// Before
const result = await DisclosureService.getDisclosures({ ... });
res.json(result);

// After
const result = await DisclosureService.getDisclosures({ ... });
res.json(result); // service가 이미 { data, pagination } 반환하므로 그대로 전달
```

(controller는 이미 pass-through이므로 service 변경만으로 충분)

### Step 1-5: DartPageClient.tsx ApiResponse 타입 및 파싱 변경

`apps/web/src/app/dart/DartPageClient.tsx`:

```typescript
// Before
type ApiResponse = {
  total: number;
  disclosures: Disclosure[];
  page: number;
  limit: number;
};

// After
type ApiResponse = {
  data: Disclosure[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};
```

같은 파일 line 84~85:
```typescript
// Before
setDisclosures(json.disclosures ?? []);
setTotal(json.total ?? 0);

// After
setDisclosures(json.data ?? []);
setTotal(json.pagination?.total ?? 0);
```

### Step 1-6: 테스트 통과 확인

```bash
cd dart-for-auditor
npx jest tests/unit/api/controllers/disclosureController.test.js --no-coverage
```
Expected: PASS

### Step 1-7: Commit

```bash
cd dart-for-auditor
git add api/services/disclosureService.js api/controllers/disclosureController.js tests/unit/api/controllers/disclosureController.test.js
git commit -m "feat(api): §7 응답 포맷 준수 — disclosures { data, pagination } 형태로 변경"
cd ../apps/web
git add src/app/dart/DartPageClient.tsx
git commit -m "feat(dart-page): §7 응답 포맷 변경에 맞게 ApiResponse 타입 및 파싱 업데이트"
```

---

## Task 2: 에러 응답 포맷 §7 준수

**목표:** 모든 API 에러 응답을 `{ error: { code, message, details? } }` 형태로 통일한다.

**Files:**
- Modify: `dart-for-auditor/api/controllers/disclosureController.js`
- Modify: `dart-for-auditor/api/controllers/healthController.js`
- Modify: `dart-for-auditor/api/controllers/viewerController.js`
- Test: `dart-for-auditor/tests/unit/api/controllers/disclosureController.test.js`

### Step 2-1: 실패 테스트 작성

```javascript
describe('§7 에러 포맷 준수', () => {
  it('page 파라미터 오류 시 { error: { code, message } } 반환', async () => {
    const req = { query: { page: '1.5' } };
    const json = jest.fn();
    const res = { json, status: jest.fn().mockReturnThis() };
    await disclosureController.getDisclosures(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.any(String),
        })
      })
    );
  });
});
```

### Step 2-2: 테스트 실패 확인

```bash
npx jest tests/unit/api/controllers/disclosureController.test.js -t "에러 포맷" --no-coverage
```
Expected: FAIL

### Step 2-3: disclosureController 에러 포맷 변경

`disclosureController.js` 내 모든 에러 응답 변경 (검색/치환):

```javascript
// Before 패턴들
res.status(400).json({ error: 'Bad Request', message: '...' })
res.status(404).json({ error: 'Not Found', message: '...' })
res.status(500).json({ error: 'Internal Server Error', message: '...' })

// After 패턴들 (HTTP 상태코드 → error.code 매핑표 §7.2 기준)
res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '...' } })
res.status(404).json({ error: { code: 'NOT_FOUND', message: '...' } })
res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '...' } })
```

`disclosureController.js` 전체에서 변경할 목록:
- `page` 파라미터 오류 (line 33~36): `VALIDATION_ERROR`
- `limit` 파라미터 오류 (line 46~59): `VALIDATION_ERROR`
- `sort` 파라미터 오류 (line 62~68): `VALIDATION_ERROR`
- `order` 파라미터 오류 (line 71~77): `VALIDATION_ERROR`
- 문자열 파라미터 길이 오류 (line 81~88): `VALIDATION_ERROR`
- `DateValidationError` catch (line 110~116): `VALIDATION_ERROR`
- MongoDB 오류 catch (line 120~126): `INTERNAL_ERROR`
- ValidationError catch (line 129~134): `VALIDATION_ERROR`
- 일반 서버 오류 (line 138~143): `INTERNAL_ERROR`
- `getCompanyNameHistory` 내 corp_code 오류 (line 153~165): `VALIDATION_ERROR`
- 404 Not Found (line 183~186): `NOT_FOUND`
- MongoDB 오류 (line 202~207): `INTERNAL_ERROR`
- ValidationError (line 211~216): `VALIDATION_ERROR`
- 일반 오류 (line 219~224): `INTERNAL_ERROR`

`healthController.js` 내 에러 응답도 동일하게 변경:
- 캐시 invalidate 400 오류: `VALIDATION_ERROR`
- 각 500 오류: `INTERNAL_ERROR`

`viewerController.js` 내 에러 응답 변경:
- 400 오류: `VALIDATION_ERROR`
- 500/502 오류: `INTERNAL_ERROR`

### Step 2-4: 테스트 통과 확인

```bash
npx jest tests/unit/api/controllers/ --no-coverage
```
Expected: PASS

### Step 2-5: Commit

```bash
git add api/controllers/disclosureController.js api/controllers/healthController.js api/controllers/viewerController.js tests/unit/api/controllers/
git commit -m "feat(api): §7 에러 포맷 준수 — { error: { code, message } } 형태로 통일"
```

---

## Task 3: SKIP_AUTH 패턴 정규화 (§9 준수)

**목표:** `keycloakJwt.js`를 가이드라인 §9의 `SKIP_AUTH` + `NODE_ENV !== 'production'` guard 패턴에 맞게 변경한다.

**Files:**
- Modify: `dart-for-auditor/api/middleware/keycloakJwt.js`
- Modify: `dart-for-auditor/.env.example`
- Test: `dart-for-auditor/tests/unit/api/controllers/disclosureController.test.js` (미들웨어 테스트 추가)

### Step 3-1: 실패 테스트 작성

`dart-for-auditor/tests/unit/api/middleware/keycloakJwt.test.js` 신규 파일:

```javascript
const keycloakJwt = require('../../../../api/middleware/keycloakJwt');

describe('keycloakJwt 미들웨어', () => {
  let req, res, next;
  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    delete process.env.SKIP_AUTH;
    delete process.env.KEYCLOAK_JWKS_URI;
  });

  it('SKIP_AUTH=true + NODE_ENV=test 환경에서 dev user 주입 후 next() 호출', () => {
    process.env.SKIP_AUTH = 'true';
    process.env.NODE_ENV = 'test';
    process.env.DEV_ROLES = 'admin,auditor';
    keycloakJwt(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(expect.objectContaining({
      sub: 'dev-user',
      roles: ['admin', 'auditor'],
    }));
  });

  it('SKIP_AUTH=true이더라도 NODE_ENV=production이면 우회하지 않음', () => {
    process.env.SKIP_AUTH = 'true';
    process.env.NODE_ENV = 'production';
    process.env.KEYCLOAK_JWKS_URI = '';
    keycloakJwt(req, res, next);
    // JWKS_URI 없으므로 next() 호출 (실제 prod 환경 시뮬레이션)
    // 이 테스트는 production에서 SKIP_AUTH가 무시됨을 확인
    expect(req.user).toBeUndefined();
  });
});
```

### Step 3-2: 테스트 실패 확인

```bash
npx jest tests/unit/api/middleware/ --no-coverage 2>/dev/null || npx jest --testPathPattern=keycloakJwt --no-coverage
```
Expected: FAIL — `keycloakJwt` 테스트 디렉토리가 없거나 SKIP_AUTH 변수명 불일치로 실패

### Step 3-3: keycloakJwt.js 변경

`dart-for-auditor/api/middleware/keycloakJwt.js` 전체 교체:

```javascript
/**
 * Keycloak JWT 검증 미들웨어 (§9 준수)
 * - SKIP_AUTH=true + NODE_ENV !== 'production' → 개발 우회 (DEV_ROLES, DEV_ORG 주입)
 * - KEYCLOAK_JWKS_URI, KEYCLOAK_ISSUER 설정 시 Bearer 토큰 검증
 * - 미설정 시 통과 (로컬 개발 편의)
 */
function keycloakJwtMiddleware(req, res, next) {
  // §9 개발 우회 패턴: SKIP_AUTH=true + production이 아닌 환경
  if (process.env.SKIP_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    req.user = {
      sub: 'dev-user',
      roles: (process.env.DEV_ROLES || 'admin').split(','),
      org: process.env.DEV_ORG || 'dev',
    };
    return next();
  }

  const jwksUri = process.env.KEYCLOAK_JWKS_URI;
  const issuer = process.env.KEYCLOAK_ISSUER;
  if (!jwksUri || !issuer) {
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth || !/^Bearer\s+/i.test(auth)) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } });
  }

  const token = auth.slice(7);
  const jwksClient = require('jwks-rsa');
  const jwt = require('jsonwebtoken');
  const client = jwksClient({ cache: true, rateLimit: true, jwksUri });
  const getKey = (header, cb) => {
    client.getSigningKey(header.kid, (err, key) => {
      if (err) return cb(err);
      const signingKey = key?.publicKey || key?.rsaPublicKey;
      cb(null, signingKey);
    });
  };
  jwt.verify(token, getKey, { algorithms: ['RS256'], issuer }, (err, decoded) => {
    if (err) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token', details: err.message } });
    req.oidc = decoded;
    req.user = {
      sub: decoded.sub,
      username: decoded.preferred_username || decoded.sub,
      roles: decoded.realm_access?.roles || [],
      org: decoded.org || '',
    };
    next();
  });
}

module.exports = keycloakJwtMiddleware;
```

### Step 3-4: .env.example 업데이트

`dart-for-auditor/.env.example`에 아래 항목 추가/수정:

```env
# §9 개발 인증 우회 (.env.local 전용, 프로덕션 절대 금지)
# SKIP_AUTH=true
# DEV_ROLES=admin,auditor
# DEV_ORG=dev

# Keycloak JWT 검증 (SKIP_AUTH 미사용 시 필수)
# KEYCLOAK_JWKS_URI=http://localhost/auth/realms/yss/protocol/openid-connect/certs
# KEYCLOAK_ISSUER=http://localhost/auth/realms/yss
```

> **Note:** 기존 `SKIP_KEYCLOAK_AUTH` 항목이 있으면 제거하고 `SKIP_AUTH`로 교체한다.

### Step 3-5: 테스트 통과 확인

```bash
npx jest --testPathPattern=keycloakJwt --no-coverage
```
Expected: PASS

### Step 3-6: Commit

```bash
git add api/middleware/keycloakJwt.js .env.example
# 테스트 파일도 함께 commit
mkdir -p tests/unit/api/middleware
git add tests/unit/api/middleware/keycloakJwt.test.js
git commit -m "feat(auth): §9 SKIP_AUTH 패턴 정규화 + NODE_ENV production guard 추가"
```

---

## Task 4: Health Endpoint 정규화 (§10 인프라 연동)

**목표:** `GET /health` 경로를 추가하고 `200 { "status": "ok" }` 응답을 반환한다.
(기존 `/api/health` 상세 응답 엔드포인트는 유지한다.)

**Files:**
- Modify: `dart-for-auditor/api/routes/health.js`
- Modify: `dart-for-auditor/api/controllers/healthController.js`
- Modify: `dart-for-auditor/api/server.js`
- Test: `dart-for-auditor/tests/unit/api/routes/health.test.js`

### Step 4-1: 실패 테스트 작성

`dart-for-auditor/tests/unit/api/routes/health.test.js`에 추가:

```javascript
const request = require('supertest');
const express = require('express');
const healthRouter = require('../../../../api/routes/health');

describe('GET /health (§10 헬스체크)', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use(healthRouter);
  });

  it('GET /health → 200 { status: "ok" }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

### Step 4-2: 테스트 실패 확인

```bash
npx jest tests/unit/api/routes/health.test.js --no-coverage
```
Expected: FAIL — `/health` 경로 없음

### Step 4-3: healthController에 간단한 헬스체크 핸들러 추가

`dart-for-auditor/api/controllers/healthController.js` 맨 위에 추가:

```javascript
// §10 간단 헬스체크: GET /health → 200 { status: "ok" }
exports.getSimpleHealth = (req, res) => {
  res.status(200).json({ status: 'ok' });
};
```

### Step 4-4: health 라우터에 `/health` 경로 추가

`dart-for-auditor/api/routes/health.js`:

```javascript
// §10 인프라 연동용 간단 헬스체크
router.get('/health', healthController.getSimpleHealth);

// 기존 상세 헬스체크 유지 (내부 모니터링용)
router.get('/api/health', healthController.getHealth);
router.get('/api/cache/stats', healthController.getCacheStats);
// ...
```

### Step 4-5: server.js에서 `/health` 경로가 인증 미들웨어를 우회하도록 처리

`dart-for-auditor/api/server.js`에서 `keycloakJwt` 미들웨어 등록 위치 조정:

```javascript
// 헬스체크는 인증 없이 접근 가능 (Traefik healthcheck 용도)
app.use('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// 이후 인증 미들웨어 적용
app.use(keycloakJwt);
app.use('/api', disclosureRouter);
app.use('/api', healthRouter);
app.use('/api', viewerRouter);
```

> **Note:** `/health` 경로는 `keycloakJwt` 미들웨어 이전에 등록해야 Traefik healthcheck가 인증 없이 동작한다.

### Step 4-6: 테스트 통과 확인

```bash
npx jest tests/unit/api/routes/health.test.js --no-coverage
```
Expected: PASS

### Step 4-7: Commit

```bash
git add api/server.js api/routes/health.js api/controllers/healthController.js tests/unit/api/routes/health.test.js
git commit -m "feat(health): §10 GET /health 엔드포인트 추가 — 200 { status: 'ok' } 응답"
```

---

## Task 5: API v1 Prefix 추가 (§7.3 API 버전 관리)

**목표:** 모든 API 엔드포인트에 `/api/v1/` prefix를 적용하고, Traefik 설정과 apps/web BFF URL을 업데이트한다.

**Files:**
- Modify: `dart-for-auditor/api/server.js`
- Modify: `dart-for-auditor/api/routes/disclosure.js` (경로 자체는 그대로, prefix만 server.js에서 적용)
- Modify: `apps/web/src/app/api/web/dart/disclosures/route.ts`
- Modify: `apps/web/src/app/api/web/dart/html_proxy/route.ts`
- Modify: `apps/web/src/app/api/web/dart/doc_outline/route.ts`
- Modify: `apps/web/src/app/api/web/dart/report_docs/route.ts`
- Modify: `apps/web/src/app/api/web/dart/company-names/[corp_code]/route.ts`
- Test: `dart-for-auditor/tests/integration/api.test.js`

### Step 5-1: 실패 테스트 작성

`dart-for-auditor/tests/integration/api.test.js` 내 기존 테스트에 v1 경로 테스트 추가:

```javascript
describe('API v1 prefix (§7.3)', () => {
  it('GET /api/v1/disclosures → 200 응답', async () => {
    const res = await request(app).get('/api/v1/disclosures?page=1&limit=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
  });

  it('GET /api/v1/health → 200 응답', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
  });
});
```

### Step 5-2: 테스트 실패 확인

```bash
npx jest tests/integration/api.test.js -t "API v1" --no-coverage
```
Expected: FAIL — 404

### Step 5-3: server.js에서 `/api` → `/api/v1` prefix 변경

`dart-for-auditor/api/server.js`:

```javascript
// Before
app.use('/api', disclosureRouter);
app.use('/api', healthRouter);
app.use('/api', viewerRouter);

// After
app.use('/api/v1', disclosureRouter);
app.use('/api/v1', healthRouter);
app.use('/api/v1', viewerRouter);
```

### Step 5-4: apps/web BFF URL 업데이트

모든 BFF route에서 `/api/...` → `/api/v1/...` 변경:

`apps/web/src/app/api/web/dart/disclosures/route.ts` line 22:
```typescript
// Before
const url = `${DART_BASE}/api/disclosures${query ? `?${query}` : ""}`;
// After
const url = `${DART_BASE}/api/v1/disclosures${query ? `?${query}` : ""}`;
```

`apps/web/src/app/api/web/dart/html_proxy/route.ts` line ~31:
```typescript
// Before
const url = `${DART_BASE}/api/html_proxy?url=...`;
// After
const url = `${DART_BASE}/api/v1/html_proxy?url=...`;
```

`apps/web/src/app/api/web/dart/doc_outline/route.ts` — 동일하게 변경
`apps/web/src/app/api/web/dart/report_docs/route.ts` — 동일하게 변경
`apps/web/src/app/api/web/dart/company-names/[corp_code]/route.ts` — 동일하게 변경

### Step 5-5: 테스트 통과 확인

```bash
cd dart-for-auditor
npx jest tests/integration/api.test.js --no-coverage
```
Expected: PASS (MongoDB 없이 실행 시 skip될 수 있음 — mongodb-memory-server 사용 필요)

```bash
# 단위 테스트 전체 확인
npx jest tests/unit/ --no-coverage
```
Expected: PASS

### Step 5-6: Commit

```bash
# dart-for-auditor 변경
git add api/server.js tests/integration/api.test.js
git commit -m "feat(api): §7.3 API v1 prefix 도입 — /api/v1/ 경로로 전환"

# apps/web 변경
cd ../
git add apps/web/src/app/api/web/dart/
git commit -m "feat(dart-bff): API v1 prefix 경로로 BFF URL 업데이트"
```

---

## Task 6: Traefik 라우팅 — `/tools/dart` 경로 추가 (§3.4 URL 규칙)

**목표:** Next.js 웹 셸의 DART 페이지를 `/tools/dart/search` 형태로 접근 가능하게 한다.
Traefik에서는 별도 처리 불필요(Next.js가 처리). Next.js 라우트만 추가한다.

**Files:**
- Create: `apps/web/src/app/tools/dart/page.tsx` (redirect 또는 real page)
- Modify: `apps/web/src/app/dart/page.tsx` (기존 페이지 → redirect 또는 유지)

### Step 6-1: Next.js redirect 설정

`apps/web/next.config.ts` (또는 `next.config.js`)에 redirect 추가:

```typescript
// next.config.ts
const nextConfig = {
  // ... 기존 설정
  async redirects() {
    return [
      {
        source: '/tools/dart',
        destination: '/dart',
        permanent: false,
      },
      {
        source: '/tools/dart/:path*',
        destination: '/dart/:path*',
        permanent: false,
      },
    ];
  },
};
```

> **Note:** 가이드라인은 `/tools/dart/search` 형태를 권장하나, 현재 `/dart` 페이지가 이미 동작 중이므로 redirect로 대응 관계를 유지한다. 향후 `/dart` → `/tools/dart`로 영구 이전 시 `permanent: true`로 변경.

### Step 6-2: 동작 확인

브라우저에서 `/tools/dart` 접속 → `/dart`로 리다이렉트 확인.

### Step 6-3: Commit

```bash
cd apps/web
git add next.config.ts  # 또는 next.config.js
git commit -m "feat(routing): §3.4 /tools/dart → /dart redirect 추가"
```

---

## Task 7: viewer/server.js 역할 정리 (§10 UI 레이어 제거)

**목표:** `viewer/server.js`의 API proxy 중복 로직을 제거한다.
API 서버(`api/server.js`)에 정적 파일 서빙을 통합하거나, viewer를 독립 실행 시에도 API 서버 URL을 직접 가리키게 단순화한다.

> **Note:** 이 Task는 `viewer/index.html` 독립 실행 지원 여부에 따라 범위가 달라진다.
> - 독립 실행 필요 없으면: viewer/server.js 전체 제거 → API 서버가 index.html 서빙
> - 독립 실행 필요하면: viewer/server.js에서 proxy 로직 제거 → index.html이 DART_API_URL 환경변수로 직접 API를 호출

**현재 중복 항목 (viewer/server.js에서 제거 가능):**
- `/api/disclosures` proxy (line 84~115) → API 서버 `/api/v1/disclosures` 직접 호출로 대체
- `/api/company-names/:corp_code` proxy (line 117~137) → API 서버 직접 호출
- `/api/html_proxy` (line 162~238) → API 서버 `/api/v1/html_proxy` 직접 호출
- `/api/doc_outline` (line 241~273) → API 서버 `/api/v1/doc_outline` 직접 호출
- `/api/report_docs` (line 276~474) → API 서버 `/api/v1/report_docs` 직접 호출
- `/api/disclosures/:id/update-corp-name` PUT (line 139~159) → 현재 API 서버에 해당 엔드포인트 없으므로 제거

**Files:**
- Modify: `dart-for-auditor/viewer/server.js` (proxy 로직 제거)
- Modify: `dart-for-auditor/viewer/index.html` (API URL을 환경변수/설정으로 처리)
- Modify: `dart-for-auditor/api/server.js` (정적 파일 서빙 추가)

### Step 7-1: viewer/server.js 간소화

`viewer/server.js`에서 모든 API proxy 라우트를 제거하고, 정적 파일 서빙 + health만 남긴다:

```javascript
// viewer/server.js 최소화 버전
const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const logger = require('../utils/logger');

const app = express();
const PORT = process.env.VIEWER_PORT || 3000;

// 정적 파일 서빙 (index.html 포함)
app.use(express.static(path.join(__dirname)));

// 기본 라우트
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Viewer 서버 시작 (정적 파일 전용)');
});
```

### Step 7-2: index.html에서 API Base URL 설정 가능하게 수정

`viewer/index.html`에서 API 호출 시 사용하는 base URL을 환경변수로 주입하거나,
`window.DART_API_BASE`를 설정할 수 있는 방식으로 변경한다. (상세 구현은 index.html의 JS 코드 구조에 따라 결정)

### Step 7-3: api/server.js에서 standalone 정적 서빙 지원 (선택)

독립 실행 시 뷰어가 필요하면 `api/server.js`에서 viewer 정적 파일을 서빙:

```javascript
// standalone 모드: SERVE_VIEWER=true 환경변수 시 viewer/index.html 서빙
if (process.env.SERVE_VIEWER === 'true') {
  app.use(express.static(path.join(__dirname, '..', 'viewer')));
}
```

### Step 7-4: 기능 확인

```bash
# API 서버 단독 실행 후 /api/v1/disclosures 동작 확인
node api/server.js &
curl http://localhost:4000/health
# Expected: { "status": "ok" }
curl http://localhost:4000/api/v1/disclosures?page=1&limit=1
# Expected: { data: [...], pagination: {...} }
```

### Step 7-5: Commit

```bash
git add viewer/server.js viewer/index.html api/server.js
git commit -m "refactor(viewer): §10 UI 레이어 제거 — viewer/server.js proxy 로직 API 서버로 통합"
```

---

## §10 최종 체크리스트

모든 Task 완료 후 아래를 확인한다:

### 도메인/API 계층
- [x] UI 레이어(정적 HTML 서빙 전용 서버) 제거 또는 최소화 (Task 7) ✅
- [x] 모든 API 응답이 `{ data }` / `{ data, pagination }` / `{ error: { code, message } }` 준수 (Task 1, 2) ✅
- [x] 목록 API `page`, `limit`, `sort`, `order` 파라미터 지원 ✅ (기존)
- [x] Breaking change 시 `/api/v2/` 추가 절차 문서화 → `.env.example`에 명시 ✅

### 인증/권한
- [x] Keycloak JWKS URI JWT 검증 동작 ✅ (기존)
- [x] `req.user.roles` 기반 권한 체크 동작 ✅ (기존)
- [x] `SKIP_AUTH=true` + `NODE_ENV !== 'production'` guard 구현 (Task 3) ✅

### 인프라 연동
- [x] Traefik `/api/dart` → `dart-for-auditor:4000` 라우팅 유지 ✅
  - 외부: `/api/dart/api/v1/disclosures` → strip → `/api/v1/disclosures` → API 서버 ✅
- [x] `GET /health` → `200 { "status": "ok" }` 응답 (Task 4) ✅

### Next.js 통합
- [x] BFF route handlers에서 dart API 호출 ✅ (기존)
- [x] `Authorization: Bearer` 헤더 전달 ✅ (기존)
- [x] `DART_INTERNAL_URL` 환경변수로 서비스 주소 참조 ✅ (기존)

### 전체 테스트 결과 (2026-03-04)
- unit + integration: **499/501 통과** (2개 실패는 `incremental-collector.test.js` 기존 버그, 이번 리팩토링과 무관)

---

## 전체 테스트 실행

```bash
cd dart-for-auditor
npx jest tests/unit/ tests/integration/ --no-coverage
```

---

## 진행 상태

| Task | 항목 | 상태 |
|------|------|------|
| 1 | 목록 API 응답 포맷 `{ data, pagination }` | ✅ 완료 (2026-03-04) |
| 2 | 에러 포맷 `{ error: { code, message } }` | ✅ 완료 (2026-03-04) |
| 3 | SKIP_AUTH 패턴 + NODE_ENV guard | ✅ 완료 (2026-03-04) |
| 4 | `/health` 엔드포인트 추가 | ✅ 완료 (2026-03-04) |
| 5 | API v1 prefix + BFF URL 업데이트 | ✅ 완료 (2026-03-04) |
| 6 | `/tools/dart` redirect (URL 규칙) | ✅ 완료 (2026-03-04) |
| 7 | viewer/server.js proxy 로직 제거 | ✅ 완료 (2026-03-04) |
