# dart-for-auditor 링크 입수 리팩토링 계획

**상태:** ✅ 완료

> **For Claude/Cursor:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** DART 공시 뷰어 API(`report_docs`)의 실시간 스크래핑 의존을 제거하고, Level 2(문서 목록)·Level 3(목차 노드) 수집 로직을 `toc-collector.js` 단일 진입점으로 통합한 뒤, 수집 결과를 `dart_documents`·`dart_toc_nodes` 컬렉션에 저장한다. API는 DB를 먼저 조회하고 미스일 때만 스크래핑으로 폴백한다.

**Architecture:** `toc-collector.js`가 이미 Level 2·3 수집을 구현하고 있으나 `parent_eleId`·`depth`가 없고 DB 적재 레이어가 없다. `disclosure-parser.js`·`viewerController.js`가 같은 파싱 로직을 각자 구현하고 있어 중복이 있다. 이번 리팩토링은 (1) toc-collector 확장, (2) DB 모델·적재 모듈 신규 생성, (3) 인덱서 연동, (4) 파서·컨트롤러 정리의 4개 축으로 진행한다.

**Reference:** `docs/refactoring/services/dart-for-auditor/rf-2026-03-05-link-ingestion-refactor.md`

**Tech Stack:** Node.js/Express (dart-for-auditor), Mongoose 8.x, MongoDB

---

## 현황 분석 (Gap Analysis)

| 항목 | 현재 상태 | 필요 작업 |
|------|-----------|-----------|
| `toc-collector.js` parent_eleId/depth | 미구현 | `children.push` 패턴 파싱 추가 |
| dart_documents 컬렉션 | 없음 | Mongoose 모델 신규 생성 |
| dart_toc_nodes 컬렉션 | 없음 | Mongoose 모델 신규 생성 |
| toc DB 적재 레이어 | 없음 | `toc-persistence.js` 신규 생성 |
| indexer-v2.js toc 연동 | 없음 | 옵션 기반 분기 추가 |
| disclosure-parser 문서 목록 추출 | 자체 셀렉터 구현 (중복) | toc-collector 위임으로 교체 |
| viewerController report_docs | 매 요청 실시간 스크래핑 | DB-first + 폴백 구조로 변경 |
| reset-database.js / init_indexes.js | 신규 모델 미포함 | 신규 모델 syncIndexes 추가 |

---

## Task 1: toc-collector.js 확장 — parent_eleId / depth 추가

**파일:** `dart-for-auditor/ingestion/utils/toc-collector.js`

**목표:** `extractTocNodesFromScript`에서 `node['children'].push(nodeX)` 구문을 추적하여 각 노드에 `parent_eleId`(부모 eleId, 최상위 = `null`)·`depth`(0-based)를 부여한다.

### Step 1-1: extractTocNodesFromScript 변경

`toc-collector.js`의 `extractTocNodesFromScript` 함수 전체를 아래로 교체한다.

**핵심 변경 포인트:**
- `jsCode.split(/\bvar\s+node\d+\s*=\s*\{\}\s*;/)` → 캡처 그룹 추가 `/\bvar\s+node(\d+)\s*=\s*\{\}\s*;/` 로 변경해 인덱스 추출
- split 결과 `[before, idx1, chunk1, idx2, chunk2, ...]` 구조로 2칸씩 순회
- `/node(\d+)\['children'\]\.push\(node(\d+)\)/g` 로 `childToParent` Map 구성
- 각 rawNode에서 조상 체인을 역추적해 `depth` 계산

```javascript
function extractTocNodesFromScript(scriptContent) {
  if (!scriptContent || !scriptContent.includes('treeData') || !scriptContent.includes('rcpNo')) {
    return [];
  }

  let jsCode = scriptContent;
  if (jsCode.includes("winCorpInfo');")) {
    jsCode = jsCode.split("winCorpInfo');")[1] || jsCode;
  }
  if (jsCode.includes('//js tree')) {
    jsCode = jsCode.split('//js tree')[0] || jsCode;
  }

  // 1단계: 각 노드 블록 파싱 (인덱스 → eleId 매핑 포함)
  const rawNodes = [];
  const parts = jsCode.split(/\bvar\s+node(\d+)\s*=\s*\{\}\s*;/);
  // split with capture group: [before, idx1, chunk1, idx2, chunk2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const idx = parseInt(parts[i], 10);
    const chunk = parts[i + 1] || '';
    const endIdx = chunk.search(/(?:treeData\.push\(node\d+\)|node\d+\['children'\]\.push\(node\d+\))/);
    const block = endIdx >= 0 ? chunk.slice(0, endIdx) : chunk;

    const textMatch = block.match(/\['text'\]\s*=\s*"([^"]*)"/);
    const rcpNoMatch = block.match(/\['rcpNo'\]\s*=\s*"([^"]*)"/);
    const dcmNoMatch = block.match(/\['dcmNo'\]\s*=\s*"([^"]*)"/);
    const eleIdMatch = block.match(/\['eleId'\]\s*=\s*"([^"]*)"/);
    const offsetMatch = block.match(/\['offset'\]\s*=\s*"([^"]*)"/);
    const lengthMatch = block.match(/\['length'\]\s*=\s*"([^"]*)"/);
    const dtdMatch = block.match(/\['dtd'\]\s*=\s*"([^"]*)"/);

    if (textMatch && rcpNoMatch && dcmNoMatch && eleIdMatch) {
      rawNodes.push({
        idx,
        text: (textMatch[1] || '').replace(/&nbsp;/g, ' ').trim(),
        rcpNo: rcpNoMatch[1],
        dcmNo: dcmNoMatch[1],
        eleId: eleIdMatch[1],
        offset: (offsetMatch && offsetMatch[1]) || '',
        length: (lengthMatch && lengthMatch[1]) || '',
        dtd: (dtdMatch && dtdMatch[1]) || 'dart4.xsd',
      });
    }
  }

  // 2단계: parent-child 매핑 테이블 구성 (childIdx → parentIdx)
  const childToParent = new Map();
  const childRe = /node(\d+)\['children'\]\.push\(node(\d+)\)/g;
  let m;
  while ((m = childRe.exec(jsCode)) !== null) {
    const parentIdx = parseInt(m[1], 10);
    const childIdx = parseInt(m[2], 10);
    childToParent.set(childIdx, parentIdx);
  }

  // 3단계: 인덱스 → eleId 역매핑
  const idxToEleId = new Map();
  for (const n of rawNodes) {
    idxToEleId.set(n.idx, n.eleId);
  }

  // 4단계: 각 노드에 parent_eleId·depth 부여
  const nodes = [];
  for (const n of rawNodes) {
    const parentIdx = childToParent.get(n.idx);
    const parent_eleId = parentIdx !== undefined ? (idxToEleId.get(parentIdx) || null) : null;

    let depth = 0;
    let cur = n.idx;
    const visited = new Set();
    while (childToParent.has(cur) && !visited.has(cur)) {
      visited.add(cur);
      cur = childToParent.get(cur);
      depth++;
    }

    nodes.push({ text: n.text, rcpNo: n.rcpNo, dcmNo: n.dcmNo, eleId: n.eleId,
      offset: n.offset, length: n.length, dtd: n.dtd, parent_eleId, depth });
  }
  return nodes;
}
```

### Step 1-2: 검증

```bash
cd dart-for-auditor
node ingestion/scripts/collect-toc-links.js <실제_rcpNo>
```

출력에 각 tocLink 항목에 `parent_eleId`·`depth` 필드가 포함되어야 한다.
최상위 노드는 `parent_eleId: null, depth: 0`, 하위 노드는 `depth: 1` 이상.

---

## Task 2: Mongoose 모델 생성 — DartDocument / DartTocNode

**신규 파일:**
- `dart-for-auditor/models/DartDocument.js`
- `dart-for-auditor/models/DartTocNode.js`

**패턴 참고:** `models/Disclosure.js` (Schema + `timestamps: { createdAt, updatedAt }` 옵션)

### Step 2-1: DartDocument.js 생성

```javascript
// MongoDB dart_documents 컬렉션 모델
// 공시 한 건(rcpNo) 안의 본문·첨부 문서 목록. 문서당 1 레코드.
const mongoose = require('mongoose');

const DartDocumentSchema = new mongoose.Schema(
  {
    rcpNo:      { type: String, required: true },
    dcmNo:      { type: String, default: null },   // 본문은 null 가능
    docKind:    { type: String, required: true },   // "본문" | "첨부"
    title:      { type: String, required: true },
    reportType: { type: String, required: true },   // "F001" | "A001" 등
  },
  {
    collection: 'dart_documents',
    versionKey: false,
    timestamps: { createdAt: 'collected_at', updatedAt: 'updated_at' },
  }
);

DartDocumentSchema.index({ rcpNo: 1, dcmNo: 1 }, { unique: true });
DartDocumentSchema.index({ rcpNo: 1 });
DartDocumentSchema.index({ reportType: 1, collected_at: -1 });

module.exports = mongoose.model('DartDocument', DartDocumentSchema);
```

### Step 2-2: DartTocNode.js 생성

```javascript
// MongoDB dart_toc_nodes 컬렉션 모델
// makeToc() 목차 노드 하나 = 뷰어 URL 하나. 노드당 1 레코드.
const mongoose = require('mongoose');

const DartTocNodeSchema = new mongoose.Schema(
  {
    rcpNo:        { type: String, required: true },
    dcmNo:        { type: String, required: true },
    eleId:        { type: String, required: true },   // 목차 노드 ID
    tocNo:        { type: String, default: '' },
    atocId:       { type: String, default: '' },
    offset:       { type: String, default: '' },
    length:       { type: String, default: '' },
    dtd:          { type: String, default: 'dart4.xsd' },
    text:         { type: String, default: '' },      // 목차 제목
    parent_eleId: { type: String, default: null },    // 부모 노드 eleId (최상위 null)
    depth:        { type: Number, default: 0 },       // 0-based
    reportType:   { type: String, required: true },   // "F001" | "A001" 등
  },
  {
    collection: 'dart_toc_nodes',
    versionKey: false,
    timestamps: { createdAt: 'collected_at', updatedAt: 'updated_at' },
  }
);

DartTocNodeSchema.index({ rcpNo: 1, dcmNo: 1, eleId: 1 }, { unique: true });
DartTocNodeSchema.index({ rcpNo: 1, dcmNo: 1 });
DartTocNodeSchema.index({ reportType: 1, collected_at: -1 });

module.exports = mongoose.model('DartTocNode', DartTocNodeSchema);
```

### Step 2-3: 검증

```bash
cd dart-for-auditor
node -e "
  require('dotenv').config({ path: 'api/.env' });
  const mongoose = require('mongoose');
  const D = require('./models/DartDocument');
  const T = require('./models/DartTocNode');
  mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('DartDocument collection:', D.collection.name);
    console.log('DartTocNode collection:', T.collection.name);
    mongoose.disconnect();
  });
"
```

---

## Task 3: toc-persistence.js 신규 생성

**신규 파일:** `dart-for-auditor/ingestion/utils/toc-persistence.js`

**목표:** `collectAllTocLinks` 반환값(`{ rcpNo, documents, tocLinks }`)을 받아 `dart_documents`·`dart_toc_nodes` 컬렉션에 bulk upsert한다.

### Step 3-1: toc-persistence.js 생성

```javascript
/**
 * TOC 수집 결과를 dart_documents·dart_toc_nodes 컬렉션에 upsert
 */
const DartDocument = require('../../models/DartDocument');
const DartTocNode = require('../../models/DartTocNode');
const logger = require('../../utils/logger');

/**
 * @param {{ rcpNo: string, documents: Array, tocLinks: Array }} tocResult
 * @param {string} reportType - "F001" | "A001" 등
 */
async function persistTocData(tocResult, reportType) {
  const { rcpNo, documents, tocLinks } = tocResult;
  const now = new Date();

  // dart_documents upsert
  const docOps = documents.map(doc => DartDocument.updateOne(
    { rcpNo: doc.rcpNo, dcmNo: doc.dcmNo ?? null },
    {
      $set:         { docKind: doc.docKind, title: doc.title, reportType, updated_at: now },
      $setOnInsert: { collected_at: now },
    },
    { upsert: true }
  ));

  // dart_toc_nodes upsert
  const nodeOps = tocLinks.map(n => DartTocNode.updateOne(
    { rcpNo: n.rcpNo, dcmNo: n.dcmNo, eleId: n.eleId },
    {
      $set: {
        tocNo: n.tocNo || '', atocId: n.atocId || '',
        offset: n.offset, length: n.length, dtd: n.dtd,
        text: n.text, parent_eleId: n.parent_eleId ?? null,
        depth: n.depth ?? 0, reportType, updated_at: now,
      },
      $setOnInsert: { collected_at: now },
    },
    { upsert: true }
  ));

  const allOps = [...docOps, ...nodeOps];
  const results = await Promise.allSettled(allOps);

  let inserted = 0, updated = 0, errors = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value.upsertedCount) inserted++;
      else updated++;
    } else {
      // E11000 duplicate key는 경쟁 조건에서 발생 가능 — 무시
      if (r.reason?.code === 11000) {
        logger.debug({ err: r.reason.message }, 'toc-persistence: duplicate key 무시');
      } else {
        logger.warn({ err: r.reason?.message }, 'toc-persistence: upsert 오류');
        errors++;
      }
    }
  }

  logger.info({ rcpNo, reportType, docs: documents.length, nodes: tocLinks.length,
    inserted, updated, errors }, 'TOC 적재 완료');
  return { inserted, updated, errors };
}

module.exports = { persistTocData };
```

### Step 3-2: 검증

```bash
cd dart-for-auditor
node -e "
  require('dotenv').config({ path: 'api/.env' });
  const mongoose = require('mongoose');
  const { collectAllTocLinks } = require('./ingestion/utils/toc-collector');
  const { persistTocData } = require('./ingestion/utils/toc-persistence');
  mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const result = await collectAllTocLinks('<실제_rcpNo>');
    await persistTocData(result, 'F001');
    // 재실행 시 에러 없이 완료되어야 함
    await persistTocData(result, 'F001');
    mongoose.disconnect();
  });
"
```

MongoDB Compass에서 `dart_documents`·`dart_toc_nodes` 컬렉션에 레코드가 생성되고, 재실행 시 `updated` 카운트만 증가하며 에러 없이 완료되어야 한다.

---

## Task 4: collection-strategy.js 수정 — tocCollection 섹션 추가

**파일:** `dart-for-auditor/ingestion/config/collection-strategy.js`

### Step 4-1: tocCollection 설정 추가

`module.exports = {` 객체의 마지막 항목(`modes`) 뒤에 아래 섹션을 추가한다.

```javascript
  // TOC 목차 수집 설정 (dart_documents·dart_toc_nodes 적재)
  // 초기 배포 시 false — true로 변경 후 소량 배치로 부하 확인 후 활성화
  tocCollection: {
    enabled: false,  // true로 변경 시 indexer-v2에서 TOC 수집 활성화
    delayMs: 1000,   // 문서당 DART 요청 간격(ms) — DART rate limit 준수
  },
```

---

## Task 5: indexer-v2.js 연동 — TOC 수집 분기 추가

**파일:** `dart-for-auditor/ingestion/indexer-v2.js`

**목표:** F001/A001 `upsertDisclosures` 완료 후, `config.tocCollection.enabled === true`이면 해당 공시(rcpNo)마다 순차적으로 TOC 수집 및 적재를 실행한다.

### Step 5-1: import 추가

파일 상단 require 블록에 추가:

```javascript
const { collectAllTocLinks } = require('./utils/toc-collector');
const { persistTocData } = require('./utils/toc-persistence');
```

### Step 5-2: collectYearType 메서드 내 toc 연동 분기 추가

`upsertDisclosures(toInsert)` 호출로 `result`를 받은 직후(A001 감사보고서 파싱 블록 전), 아래 블록을 삽입한다:

```javascript
      // TOC 목차 수집 (config.tocCollection.enabled 시 실행)
      if (config.tocCollection && config.tocCollection.enabled) {
        logger.info({ reportType, year, count: toInsert.length }, 'TOC 수집 시작');
        for (const disclosure of toInsert) {
          const rcpNo = disclosure.rcept_no;
          try {
            const tocResult = await collectAllTocLinks(rcpNo, { delayMs: config.tocCollection.delayMs });
            await persistTocData(tocResult, reportType);
          } catch (err) {
            logger.warn({ rcpNo, err: err.message }, 'TOC 수집 실패 — 스킵');
          }
          // rate limit 유지: 문서 간 delay는 collectAllTocLinks 내부에서 처리
        }
        logger.info({ reportType, year }, 'TOC 수집 완료');
      }
```

### Step 5-3: 검증 (비활성 상태 확인)

```bash
cd dart-for-auditor
node ingestion/indexer-v2.js daily
```

`tocCollection.enabled: false` 상태이므로 기존 수집 흐름과 동일하게 동작하고 TOC 관련 로그가 없어야 한다.

---

## Task 6: disclosure-parser.js 정리 — 문서 목록 추출 위임

**파일:** `dart-for-auditor/ingestion/utils/disclosure-parser.js`

**목표:** `parseAuditorReportFromDisclosure` 내부의 `#att option`, `#doc option` 셀렉터로 문서 목록을 직접 추출하는 로직을 `toc-collector.extractDocumentListFromWrapper` 호출로 위임한다. A001 감사보고서 **필터·disclosures 행 생성** 로직은 disclosure-parser에 그대로 유지한다.

### Step 6-1: require 추가

파일 상단에 추가:

```javascript
const { extractDocumentListFromWrapper } = require('./toc-collector');
```

### Step 6-2: extractAuditorReports 내부 HTML 취득 방식 변경

`parseAuditorReportFromDisclosure` 내부에서 `axios.get` 후 `cheerio.load`하여 `$('#att option')`·`$('#doc option')`을 직접 파싱하는 대신, 동일한 HTML을 `extractDocumentListFromWrapper`에 전달한 뒤 문서 목록을 받아 감사보고서 필터 로직에 적용한다.

**변경 전 (내부 직접 파싱):**
```javascript
const $ = cheerio.load(response.data);
const attOptions = $('#att option');
const docOptions = $('#doc option');
const combined = [
  ...extractAuditorReports($, attOptions),
  ...extractAuditorReports($, docOptions, true)
];
```

**변경 후 (toc-collector 위임):**
```javascript
// toc-collector의 extractDocumentListFromWrapper로 문서 목록 취득
const allDocs = extractDocumentListFromWrapper(response.data, rcpNo);

// 감사보고서 필터: docKind=첨부 중 보고서명이 감사보고서·연결감사보고서인 것만 추출
const combined = [];
for (const doc of allDocs) {
  if (doc.docKind !== '첨부' || !doc.dcmNo) continue;
  const text = doc.title || '';
  if (/감사의\s*감사보고서/.test(text)) continue;
  let reportName = null;
  if (/\b연결감사보고서\b/.test(text)) reportName = '연결감사보고서';
  else if (/\b감사보고서\b/.test(text)) reportName = '감사보고서';
  if (!reportName) continue;

  const dateMatch = text.match(/\d{4}\.\d{2}\.\d{2}/);
  let correctionType = '';
  if (text.includes('[기재정정]')) correctionType = '기재정정';
  else if (text.includes('[정정]')) correctionType = '정정';

  combined.push({
    type: 'auditor_report',
    name: reportName,
    url: doc.documentUrl,
    rcpNo: doc.rcpNo,
    dcmNo: doc.dcmNo,
    reportDate: dateMatch ? dateMatch[0] : '',
    correctionType,
  });
}
```

> **주의:** `isMobile` 분기(`value.includes('dcmNo')` 체크)는 `extractDocumentListFromWrapper`에서 이미 `#att`·`#doc`를 통합 처리하므로 제거한다. 중복 제거(seen Set) 로직은 그대로 유지한다.

### Step 6-3: 검증

```bash
cd dart-for-auditor
npx jest tests/unit/ingestion/ tests/parser.test.js --no-coverage
```

기존 파서 테스트가 통과해야 한다.

---

## Task 7: viewerController.js 리팩토링 — report_docs DB-first

**파일:** `dart-for-auditor/api/controllers/viewerController.js`

**목표:** `exports.reportDocs`를 DB 조회 우선, 미스 시 폴백 스크래핑 구조로 변경한다. 폴백에서도 toc-collector 함수를 재사용하고 내부 중복 treeData 정규식을 제거한다.

### Step 7-1: require 추가

파일 상단에 추가:

```javascript
const { extractTocNodesFromHtml, extractDocumentListFromWrapper } = require('../../ingestion/utils/toc-collector');
const DartTocNode = require('../../models/DartTocNode');
const DartDocument = require('../../models/DartDocument');
const { classifyDocument } = require('../../viewer/lib/docClassifier');
```

### Step 7-2: exports.reportDocs 전체 교체

기존 `exports.reportDocs` 함수를 아래로 교체한다.

```javascript
/**
 * 보고서 문서 목록(목차) 파싱
 * 1. rcpNo 추출
 * 2. DB 조회 (dart_toc_nodes + dart_documents)
 * 3. DB hit → 기존 응답 형식 변환 후 반환
 * 4. DB miss → 기존 axios+cheerio 스크래핑 폴백 (toc-collector 함수 재사용)
 */
exports.reportDocs = async (req, res) => {
  const url = req.query.url;

  if (!url || !/^https:\/\/dart\.fss\.or\.kr\//.test(url)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid or missing url' } });
  }

  // rcpNo 추출
  let rcpNo = null;
  try {
    rcpNo = new URLSearchParams(url.split('?')[1]).get('rcpNo');
  } catch (_) {}

  // DB 조회 시도
  if (rcpNo) {
    try {
      const [tocNodes, docList] = await Promise.all([
        DartTocNode.find({ rcpNo }).lean(),
        DartDocument.find({ rcpNo }).lean(),
      ]);

      if (tocNodes.length > 0) {
        // DB hit: 응답 형식 { name, url, type, category } 변환
        const docs = [{ name: '공시원문', url, type: 'original', category: classifyDocument('공시원문') }];

        for (const n of tocNodes) {
          const viewerUrl = `https://dart.fss.or.kr/report/viewer.do?rcpNo=${n.rcpNo}&dcmNo=${n.dcmNo}&eleId=${n.eleId}&offset=${n.offset}&length=${n.length}&dtd=${n.dtd}`;
          docs.push({ name: n.text, url: viewerUrl, type: 'treeData', category: classifyDocument(n.text) });
        }
        for (const d of docList) {
          if (d.dcmNo) {
            const docUrl = `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcpNo}&dcmNo=${d.dcmNo}`;
            docs.push({ name: d.title, url: docUrl, type: 'attachment', category: classifyDocument(d.title) });
          }
        }

        logger.info({ rcpNo, nodeCount: tocNodes.length }, 'report_docs: DB hit');
        return res.json(docs);
      }
    } catch (dbErr) {
      logger.warn({ err: dbErr.message, rcpNo }, 'report_docs: DB 조회 실패 — 폴백');
    }
  }

  // DB miss: 기존 스크래핑 폴백 (toc-collector 함수 재사용)
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    const docs = [{ name: '공시원문', url, type: 'original', category: classifyDocument('공시원문') }];

    // toc-collector 함수 재사용 (중복 정규식 제거)
    const tocNodes = extractTocNodesFromHtml(response.data);
    for (const n of tocNodes) {
      const viewerUrl = `https://dart.fss.or.kr/report/viewer.do?rcpNo=${n.rcpNo}&dcmNo=${n.dcmNo}&eleId=${n.eleId}&offset=${n.offset}&length=${n.length}&dtd=${n.dtd}`;
      docs.push({ name: n.text, url: viewerUrl, type: 'treeData', category: classifyDocument(n.text) });
    }

    const attachmentDocs = extractDocumentListFromWrapper(response.data, rcpNo || '');
    for (const d of attachmentDocs) {
      if (d.dcmNo) {
        docs.push({ name: d.title, url: d.documentUrl, type: 'attachment', category: classifyDocument(d.title) });
      }
    }

    logger.info({ rcpNo, nodeCount: tocNodes.length }, 'report_docs: 폴백 스크래핑');
    return res.json(docs);
  } catch (err) {
    logger.error({ err }, '목차 파싱 오류');
    const fallbackDocs = [{ name: '공시원문', url, category: 'other' }];
    if (rcpNo) {
      [1, 2, 3].forEach(dcmNo => {
        fallbackDocs.push({ name: `문서 ${dcmNo}`, url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcpNo}&dcmNo=${dcmNo}`, category: 'other' });
      });
    }
    return res.json(fallbackDocs);
  }
};
```

### Step 7-3: 검증

```bash
# DB hit 경로: dart_toc_nodes에 rcpNo가 있는 URL 호출
curl "http://localhost:4000/api/v1/report_docs?url=https://dart.fss.or.kr/dsaf001/main.do?rcpNo=<적재된_rcpNo>"
# Expected: name/url/type/category 형식의 배열

# DB miss 경로: dart_toc_nodes에 없는 URL 호출
curl "http://localhost:4000/api/v1/report_docs?url=https://dart.fss.or.kr/dsaf001/main.do?rcpNo=<없는_rcpNo>"
# Expected: 동일한 형식으로 폴백 스크래핑 결과 반환
```

---

## Task 8: reset-database.js + init_indexes.js 업데이트

### Step 8-1: init_indexes.js — 신규 모델 추가

`dart-for-auditor/jobs/init_indexes.js`의 모델 로드 블록에 추가:

```javascript
const DartDocument = require('../models/DartDocument');
const DartTocNode = require('../models/DartTocNode');
```

`run()` 함수에서 `SubmitterHistory.syncIndexes()` 이후에 추가:

```javascript
  logger.info('DartDocument 인덱스 동기화 중...');
  await DartDocument.syncIndexes();
  logger.info('DartDocument 인덱스 완료');

  logger.info('DartTocNode 인덱스 동기화 중...');
  await DartTocNode.syncIndexes();
  logger.info('DartTocNode 인덱스 완료');
```

### Step 8-2: reset-database.js — 신규 모델 syncIndexes 추가

`dart-for-auditor/jobs/reset-database.js`의 모델 로드 블록에 추가:

```javascript
const DartDocument = require('../models/DartDocument');
const DartTocNode = require('../models/DartTocNode');
```

`resetDatabase()` 내 인덱스 재생성 블록(`Disclosure.syncIndexes()` 이후)에 추가:

```javascript
    await DartDocument.syncIndexes();
    console.log('✓ dart_documents 인덱스 생성 완료');

    await DartTocNode.syncIndexes();
    console.log('✓ dart_toc_nodes 인덱스 생성 완료');
```

> **참고:** 컬렉션 전체 삭제 루프는 이미 `listCollections`로 동적 처리하므로 `dart_documents`·`dart_toc_nodes`는 별도 추가 없이 자동 포함된다.

### Step 8-3: 검증

```bash
cd dart-for-auditor
# 인덱스 초기화 확인
node jobs/init_indexes.js
# Expected: DartDocument·DartTocNode 인덱스 완료 로그 포함

# DB 초기화 시 신규 컬렉션도 포함 확인 (interactive — y 입력)
node jobs/reset-database.js
# Expected: dart_documents·dart_toc_nodes 삭제 및 인덱스 재생성 포함
```

---

## 최종 체크리스트

### 기능
- [x] `toc-collector.js`: `parent_eleId`·`depth` 반환
- [x] `DartDocument.js`·`DartTocNode.js`: 모델 생성 및 인덱스 검증
- [x] `toc-persistence.js`: bulk upsert + E11000 무시
- [x] `collection-strategy.js`: `tocCollection.enabled: false` 기본값
- [x] `indexer-v2.js`: `tocCollection.enabled` 분기 — 기존 수집 흐름 영향 없음
- [x] `disclosure-parser.js`: 문서 목록 추출 toc-collector 위임
- [x] `viewerController.js`: DB-first + 폴백, 응답 스키마 유지
- [x] `reset-database.js`·`init_indexes.js`: 신규 모델 syncIndexes 포함

### 비기능
- [x] DART rate limit(초당 1회) 유지
- [x] 초기 배포: `tocCollection.enabled: false` — 기존 수집에 영향 없음
- [x] 응답 스키마 `{ name, url, type, category }` 프론트 호환 유지

---

## 진행 상태

| Task | 항목 | 상태 |
|------|------|------|
| 1 | toc-collector.js parent_eleId/depth 추가 | 완료 |
| 2 | DartDocument.js·DartTocNode.js 모델 생성 | 완료 |
| 3 | toc-persistence.js 신규 생성 | 완료 |
| 4 | collection-strategy.js tocCollection 섹션 추가 | 완료 |
| 5 | indexer-v2.js TOC 연동 분기 추가 | 완료 |
| 6 | disclosure-parser.js 문서 목록 추출 위임 | 완료 |
| 7 | viewerController.js report_docs DB-first 리팩토링 | 완료 |
| 8 | reset-database.js·init_indexes.js 신규 모델 추가 | 완료 |
