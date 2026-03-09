# audit-quality 개발 문서

감사·품질 통합지원 서비스의 기획부터 배포까지 전 과정을 정리한 문서 모음입니다.

---

## 어디서 시작할까?

| 상황 | 문서 |
|------|------|
| 처음 프로젝트를 세팅하는 경우 | [setup.md](./setup.md) |
| 개발 로드맵과 남은 Task를 확인하고 싶은 경우 | [roadmap.md](./roadmap.md) |
| 브랜치·커밋·PR 규칙을 확인하고 싶은 경우 | [workflow.md](./workflow.md) |
| 서버에 배포하는 경우 | [deploy.md](./deploy.md) |
| 기술 선택 이유가 궁금한 경우 | [adr/](./adr/) |

---

## 문서 목록

### 실행 계획
- **[roadmap.md](./roadmap.md)** — Phase 1/2/3 Task 목록, 완료 기준, 의존성

### 개발 가이드
- **[setup.md](./setup.md)** — 로컬 개발환경 세팅 (Node, Python, Docker, .env)
- **[workflow.md](./workflow.md)** — Git 전략, 커밋 컨벤션, PR 절차
- **[deploy.md](./deploy.md)** — Docker Compose, GitHub Actions, Traefik TLS, 롤백

### Architecture Decision Records
- **[adr/001-nextjs.md](./adr/001-nextjs.md)** — Next.js 15 통합 UI 셸 도입
- **[adr/002-keycloak.md](./adr/002-keycloak.md)** — Keycloak OIDC/SSO 선택
- **[adr/003-traefik.md](./adr/003-traefik.md)** — Traefik v3 API Gateway 선택
- **[adr/004-postgres.md](./adr/004-postgres.md)** — PostgreSQL 마이그레이션 결정
- **[adr/005-mkdocs-traefik-integration.md](./adr/005-mkdocs-traefik-integration.md)** — MkDocs → Next.js MDX 렌더링 전환

### 리팩토링 이력
- **[refactoring/README.md](./refactoring/README.md)** — 리팩토링 문서 목적·규칙·템플릿
- **[refactoring/cross-cutting/rf-2026-03-03-service-integration-guidelines.md](./refactoring/cross-cutting/rf-2026-03-03-service-integration-guidelines.md)** — 통합 웹 셸 + 개별 서비스 설계 일반론 (여러 서비스에 걸친 구조 정렬 가이드)

### 설계·실험 계획 (기록)
- **[plans/README.md](./plans/README.md)** — 일회성 설계·실험 계획 문서 안내
- **[plans/2026-03-02-mkdocs-layout-design.md](./plans/2026-03-02-mkdocs-layout-design.md)** — /policy, /updates 3-panel 레이아웃 설계 기록
- **[plans/2026-03-03-service-integration-agent-guide-design.md](./plans/2026-03-03-service-integration-agent-guide-design.md)** — 서비스 통합 가이드라인 §7~§10 Agent 참조 섹션 설계 기록

---

## 기획 문서

- **[project-planning.md](./project-planning.md)** — 서비스 전체 기획 (배경, 목적, 아키텍처, 로드맵)
- **[requirements.md](./requirements.md)** — 프로젝트 인벤토리 요약 (모듈별 기능·기술 스택)
- **[project-summary.md](./project-summary.md)** — 모듈별 역할 한눈에 보기

---

*최초 작성: 2026-02-27 / 최종 수정: 2026-03-03 (서비스 통합 가이드라인 §7~§10 Agent 참조 섹션 추가)*
