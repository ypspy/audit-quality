# 설계·실험 계획 (plans)

일회성 실행 계획이나 설계 단계에서 작성한 문서를 모아두는 폴더입니다.  
구현이 완료된 뒤 **설계 의도·아키텍처를 기록**해 둔 문서만 유지하며, 태스크 단위 실행 계획(runbook)은 완료 후 제거합니다.

## 현재 문서

| 문서 | 설명 |
|------|------|
| [2026-03-02-mkdocs-layout-design.md](./2026-03-02-mkdocs-layout-design.md) | `/policy`, `/updates` MkDocs Material 스타일 3-panel 레이아웃 설계 (데이터 흐름, 파일 구성) |
| [2026-03-03-service-integration-agent-guide-design.md](./2026-03-03-service-integration-agent-guide-design.md) | `rf-2026-03-03-service-integration-guidelines.md` §7~§10 Agent 참조 섹션 설계 (API 규약, BFF 기준, 로컬 인증, 체크리스트) |
| [2026-03-05-dart-link-ingestion-refactor.md](./2026-03-05-dart-link-ingestion-refactor.md) | `dart-for-auditor` 링크 입수 리팩토링 — toc-collector 확장, dart_documents·dart_toc_nodes 모델 생성, report_docs DB-first 전환 (8 Tasks) |
| [2026-03-06-dart-tree-api.md](./2026-03-06-dart-tree-api.md) | `dart-for-auditor` DB 초기화 + 3-level 계층 트리 API — tocCollection 활성화, disclosureTreeController 신규, GET /api/v1/dart/tree |
| [2026-03-07-quality-updates-frontend-design.md](./2026-03-07-quality-updates-frontend-design.md) | 규제 업데이트 서비스 프론트엔드 개선 설계 — P1 카드 인덱스·검색·인용 복사, P2 MCP 서버, P3 RAG 채팅 UI |
