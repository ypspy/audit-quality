# dart-for-auditor: DB 초기화 + 다층 구조 트리 API

**상태:** ✅ 완료 (코드 완료, DB 재수집은 운영 시 수행)

> Tasks 1–8 (link-ingestion-refactor) 완료 이후 수행. DB를 신규 스키마로 초기화하고, 3-level 계층 트리 API를 신규 생성한다.

**작성일**: 2026-03-06

---

## 배경

Tasks 1–8 완료 후 기존 DB 데이터는 구버전 파이프라인으로 수집된 상태 (dart_documents·dart_toc_nodes 없음).  
세 레벨 계층(공시 메타 → 문서 목록 → 목차 트리)을 단일 API로 조회하는 엔드포인트도 없었음.

---

## 구현 내용

### Task 1-1: tocCollection 활성화

**파일:** `ingestion/config/collection-strategy.js`

```
tocCollection.enabled: false → true
```

재수집 시 각 공시마다 dart_documents·dart_toc_nodes가 적재됨.

### Task 2: disclosureTreeController.js 신규 생성

**파일:** `api/controllers/disclosureTreeController.js`

- Level 1: `Disclosure.findOne({ rcept_no: rcpNo })` — 공시 메타
- Level 2: `DartDocument.find({ rcpNo })` — 문서 목록
- Level 3: `DartTocNode.find({ rcpNo })` — 목차 노드 전체
- `buildTree(nodes)`: `parent_eleId` 기반으로 평탄 배열 → 중첩 트리 변환
- disc + documents 모두 없을 때 404 반환

### Task 3: GET /api/v1/dart/tree 라우트 등록

**파일:** `api/routes/viewer.js`

```javascript
router.get('/dart/tree', disclosureTreeController.getTree);
```

viewer 라우터는 `/api/v1`에 마운트되므로 최종 경로: `GET /api/v1/dart/tree?rcpNo={rcpNo}`

---

## 응답 스키마

```json
{
  "disclosure": {
    "rcpNo": "20260305001603",
    "corpCode": "00123456",
    "corpName": "삼성전자",
    "stockCode": null,
    "reportNm": "사업보고서 (2025.12)",
    "bsnsYear": "2025",
    "yearEnd": "(2025.12)",
    "rcptDt": "2026-03-05T00:00:00.000Z",
    "correctionType": "최초공시",
    "url": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260305001603"
  },
  "documents": [
    {
      "dcmNo": null,
      "docKind": "본문",
      "title": "사업보고서 (본문)",
      "documentUrl": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260305001603",
      "tocNodes": [
        {
          "eleId": "0",
          "text": "I. 회사의 개요",
          "viewerUrl": "https://dart.fss.or.kr/report/viewer.do?rcpNo=...&eleId=0&...",
          "depth": 0,
          "parent_eleId": null,
          "children": [...]
        }
      ]
    }
  ]
}
```

**참고:** `Disclosure` 모델에 `stock_code` 필드가 없으므로 `stockCode`는 항상 `null`.

---

## DB 재수집 절차 (Docker)

```bash
# 1. DB 전체 초기화 (컨테이너 내에서 인터랙티브 실행)
docker exec -it audit-quality-dart node jobs/reset-database.js

# 2. 인덱스 재생성
docker exec audit-quality-dart node jobs/init_indexes.js

# 3. TOC 포함 재수집 (daily 모드 — 최근 3년)
docker exec audit-quality-dart node ingestion/indexer-v2.js daily

# 백그라운드 실행 시
docker exec -d audit-quality-dart node ingestion/indexer-v2.js daily
docker logs -f audit-quality-dart
```

---

## 검증 결과 (2026-03-06)

### 코드 로딩 검증

```
Viewer routes:
  - GET /html_proxy
  - GET /doc_outline
  - GET /report_docs
  - GET /dart/tree    ✓ 신규

getTree export: OK
VERIFICATION PASS
```

### 설정 검증

```
tocCollection.enabled: true    ✓
tocCollection.delayMs: 1000    ✓
VERIFICATION PASS
```

### 기존 테스트

```
> node tests/smoke-routes.js
SMOKE OK    ✓ 회귀 없음
```

---

## 수정 파일 목록

| 파일 | 변경 |
|------|------|
| `ingestion/config/collection-strategy.js` | `tocCollection.enabled: true` |
| `api/controllers/disclosureTreeController.js` | **신규 생성** |
| `api/routes/viewer.js` | `GET /dart/tree` 라우트 추가 |

---

## 진행 상태

| Task | 항목 | 상태 |
|------|------|------|
| 1-1 | tocCollection.enabled → true | 완료 |
| 1-2 | DB 초기화 (reset-database.js) | Docker에서 수동 실행 |
| 1-3 | 인덱스 재생성 (init_indexes.js) | Docker에서 수동 실행 |
| 1-4 | 재수집 (indexer-v2.js daily) | Docker에서 수동 실행 |
| 2 | disclosureTreeController.js 신규 생성 | 완료 |
| 3 | GET /api/v1/dart/tree 라우트 등록 | 완료 |
