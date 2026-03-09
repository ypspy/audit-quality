## 리팩토링 문서 가이드

이 디렉터리는 `audit-quality` 및 하위 서비스들의 **리팩토링 이력과 구조 변경 가이드**를 기록하기 위한 곳입니다.

### 1. 폴더 구조

- `docs/refactoring/README.md` — 리팩토링 문서 목적·규칙·템플릿
- `docs/refactoring/cross-cutting/` — 여러 서비스에 동시에 영향을 주는 리팩토링
  - 예: 인증·권한 흐름 통합, 공통 로깅 구조 변경, Next.js 웹 셸 통합 패턴 변경 등
- `docs/refactoring/services/{서비스명}/` — 개별 서비스 내부 리팩토링 이력
  - 예: `docs/refactoring/services/dart-for-auditor/`
  - 예: `docs/refactoring/services/qualityEval/`
  - 예: `docs/refactoring/services/timesheet/`

> 폴더가 아직 비어 있을 수 있으므로, 최초 리팩토링 문서를 추가할 때 필요한 디렉터리가 없으면 함께 생성하세요.

### 2. 파일 이름 규칙

리팩토링 문서는 아래 규칙을 따릅니다.

- 형식: `rf-YYYY-MM-DD-<area>-<short-title>.md`
- 예시:
  - `rf-2026-03-03-service-integration-guidelines.md`
  - `rf-2026-03-15-qualityEval-domain-service-split.md`
  - `rf-2026-03-20-auth-flow-unification.md`

규칙 설명:

- **접두사**: `rf-` (Refactoring)
- **날짜**: `YYYY-MM-DD` (작성 또는 리팩토링 완료 기준일)
- **area**: 서비스명 또는 영역명 (예: `dart-for-auditor`, `qualityEval`, `timesheet`, `auth-flow`, `logging`)
- **short-title**: 띄어쓰기 없이 `kebab-case`로 된 짧은 설명

### 3. 문서 템플릿

각 리팩토링 문서는 아래 섹션 구조를 기본으로 합니다.

```md
## 제목 (예: dart-for-auditor API-first 리팩토링)

### 1. 배경 (Background)
- 왜 이 리팩토링이 필요했는지
- 관련 버그/요구사항/로드맵 항목 링크
- 관련 ADR 번호 (있으면) — 예: `docs/adr/001-nextjs.md`

### 2. 범위 (Scope)
- 포함되는 서비스/모듈/폴더
- 의도적으로 포함하지 않은 것(Out of scope)

### 3. 변경 내용 (Changes)
- Before → After 개념 요약
- 주요 구조 변경 (레이어링, 폴더 구조, 인터페이스 변경 등)
- 제거/대체된 모듈이나 패턴

### 4. 마이그레이션/적용 방법 (Migration / Usage)
- 기존 코드에서 새 구조로 옮기는 실질적인 방법
- 신규 코드가 따라야 할 가이드라인
- 깨지기 쉬운 포인트(주의사항)

### 5. 영향 범위 및 리스크 (Impact)
- 성능/운영/배포에 미치는 영향
- 롤백 전략(필요 시)

### 6. 관련 문서/PR (References)
- 관련 ADR 문서
- 관련 `docs/plans/*.md` (설계/실험 단계 계획)
- 관련 GitHub PR 링크
```

### 4. 언제 리팩토링 문서를 추가할까?

다음과 같은 작업을 수행했다면, 하나의 리팩토링 문서를 남기는 것을 원칙으로 합니다.

- 레이어링/폴더 구조 변경 (예: 컨트롤러 → 서비스 계층 분리)
- 공개 API 인터페이스 변경 (파라미터, 응답 스키마 등)
- 인증/권한 흐름 정리 또는 교체
- 성능·운영에 큰 영향을 주는 구조 변경

작은 버그 수정이나 단순 리네이밍 수준이라면, 별도의 리팩토링 문서 없이 커밋 메시지만으로 충분할 수 있습니다.

### 5. 향후 확장 아이디어

추후 다음과 같은 확장을 고려할 수 있습니다.

- `docs/refactoring/` 하위 문서들을 자동 인덱싱하는 스크립트 또는 요약 문서
- GitHub PR 템플릿에 “관련 리팩토링 문서 링크” 항목을 추가하여, 구조 변경 시 문서화를 강제하는 규칙

