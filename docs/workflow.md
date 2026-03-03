# 개발 워크플로우

Git 브랜치 전략, 커밋 컨벤션, PR 절차를 정리합니다.

---

## 목차

- [브랜치 전략](#브랜치-전략)
- [커밋 컨벤션 (Conventional Commits)](#커밋-컨벤션-conventional-commits)
- [PR 절차](#pr-절차)
- [작업 흐름 요약](#작업-흐름-요약)

---

## 브랜치 전략

```
main                    ← 프로덕션 배포 브랜치 (항상 배포 가능한 상태 유지)
  └── feat/<이름>       ← 신규 기능
  └── fix/<이름>        ← 버그 수정
  └── chore/<이름>      ← 빌드, 설정, 의존성 업데이트
  └── docs/<이름>       ← 문서 작업
  └── refactor/<이름>   ← 기능 변경 없는 코드 개선
```

### 브랜치 이름 예시

```
feat/nextjs-shell
feat/keycloak-sso
fix/qualityeval-filter-bug
chore/docker-compose-setup
docs/roadmap-phase1
```

### 규칙

- `main`에 직접 push 금지. 항상 PR을 통해 병합.
- 브랜치는 작업 단위로 짧게 유지 (1 Task = 1 브랜치 권장).
- 병합 완료 후 브랜치 삭제.

---

## 커밋 컨벤션 (Conventional Commits)

```
<type>(<scope>): <subject>

[optional body]
```

### Type 목록

| Type | 사용 시점 |
|------|----------|
| `feat` | 새 기능 추가 |
| `fix` | 버그 수정 |
| `chore` | 빌드, 설정, 의존성 (기능 변경 없음) |
| `docs` | 문서만 변경 |
| `refactor` | 기능 변경 없는 코드 개선 |
| `test` | 테스트 추가·수정 |
| `ci` | GitHub Actions 등 CI 설정 변경 |

### Scope 예시

`portal`, `eval`, `timesheet`, `dart`, `client`, `policy`, `updates`, `crawler`, `infra`, `auth`

### 커밋 메시지 예시

```
feat(auth): add Keycloak JWT middleware to qualityEval

fix(timesheet): resolve pagination offset bug on page 2+

chore(infra): add Docker Compose service for Traefik

docs(roadmap): mark Phase 1-1 tasks as complete
```

---

## PR 절차

### PR 생성 전 체크리스트

- [ ] 로컬에서 테스트 통과 (`npm test` / `pytest`)
- [ ] lint 오류 없음 (`npm run lint`)
- [ ] `.env.example` 업데이트 (새 환경 변수 추가 시)
- [ ] 관련 문서 업데이트 (setup.md, roadmap.md 등)

### PR 제목 형식

```
feat(scope): 한 줄 요약
```

### PR 본문 템플릿

```markdown
## 변경 사항
- 무엇을 왜 변경했는지 설명

## 테스트 방법
1. 실행 방법
2. 확인해야 할 동작

## 관련 Task
- roadmap.md Phase X-Y
```

### 코드리뷰 체크리스트

- [ ] 보안 취약점 없음 (SQL 인젝션, XSS, 하드코딩된 시크릿 등)
- [ ] 에러 처리가 적절한가
- [ ] 환경 변수로 설정 가능한가 (하드코딩 경로 없음)
- [ ] 기존 API 호환성 유지

---

## 작업 흐름 요약

```
1. roadmap.md에서 작업할 Task 선택
2. feat/fix/chore 브랜치 생성
3. 개발 → 커밋 (Conventional Commits)
4. PR 생성 → 코드리뷰
5. main 병합 → GitHub Actions 자동 배포
6. roadmap.md 해당 Task [x] 표시
```
