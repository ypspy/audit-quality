# audit-quality

감사·품질 관련 도구 및 서비스 모음입니다.

## 모듈 목록

| 모듈 | 설명 |
|------|------|
| [dart-for-auditor](./dart-for-auditor/) | DART 감사보고서 메타데이터 인덱서·뷰어 (Node.js) |
| [quality-updates](./quality-updates/) | 회계기준·감사기준 개정 동향 수집·정리 (Python, MkDocs) |
| [quality-updates-crawler](./quality-updates-crawler/) | 감사·품질 관련 기관 사이트 크롤러 (Python) |
| [qualityPortal](./qualityPortal/) | 감사·품질관리 포털 웹앱 (Node.js, Express) |
| [qualityEval](./qualityEval/) | 감사 품질 평가 웹앱 — 리스크·통제 항목 조회·편집 (Node.js) |
| [policy](./policy/) | 품질관리 내규·절차 문서 사이트 (MkDocs) |
| [local-inquiry-site](./local-inquiry-site/) | LAN 전용 고객 정보 조회 앱 (Python, Flask) |
| [timesheet](./timesheet/) | 직원 타임시트 관리 웹앱 (Node.js, Express) |
| [contractParsing](./contractParsing/) | 감사계약체결보고 HTML에서 계약 정보 추출 (Python) |
| [disclosureAnalysis](./disclosureAnalysis/) | 감사보고서 HTML에서 보고일 등 날짜 추출 (Python) |

## 문서

공통 기획·설계 문서는 [docs/](./docs/)를 참고하세요.

## 개발·운영 워크플로우 요약

코드 수정, Docker 빌드, Git 관리는 아래 흐름을 기본으로 합니다. 세부 규칙은 `docs/` 문서를 참고하세요.

### 1. 코드 수정 위치

- **통합 인프라·오케스트레이션**
  - 위치: `audit-quality` 루트 (`docker-compose.yml`, `traefik/`, `keycloak/`, `observability/`, `docs/` 등)
  - 용도: 전체 서비스 구성, 리버스 프록시, 인증(SSO), 모니터링, 공통 문서 관리

- **개별 서비스 코드**
  - `dart-for-auditor` 앱: `./dart-for-auditor/`
  - 포털: `./qualityPortal/` (`qualityportal` 서비스)
  - 품질 평가: `./qualityEval/` (`qualityeval` 서비스)
  - 타임시트: `./timesheet/` (`timesheet` 서비스)
  - 고객 조회: `./local-inquiry-site/` (`local-inquiry-site` 서비스)
  - Next.js UI 셸: `./apps/web/` (`web` 서비스)

### 2. Docker 실행 및 재빌드

- **전체 스택 최초 실행**

```bash
cd /c/Users/yoont/source/03_Development/audit-quality
docker compose up -d
```

- **특정 서비스 코드/의존성 변경 후 (권장)**
  - 변경된 서비스만 선택적으로 재빌드·재기동합니다.

```bash
# 예시: dart-for-auditor 코드 변경 후
docker compose up -d --build dart-for-auditor

# 예시: qualityEval 코드 변경 후
docker compose up -d --build qualityeval

# 예시: Next.js 웹 셸 (apps/web)
docker compose up -d --build web
```

- **배치 전용 컨테이너 실행 예시**

```bash
# DART 메타데이터 수집 배치
docker compose run --rm dart-collector npm run collect:daily

# 공시 분석 배치
docker compose run --rm disclosure-analysis python reportDate.py
```

> 원칙: `docker-compose*.yml` 또는 Docker 관련 설정을 수정한 뒤에는, **영향받는 서비스에 대해서만 우선 재빌드/재기동**하고, 필요 시 전체 스택을 재빌드합니다.

### 3. Git 리포지토리 구조 및 관리

이 프로젝트는 **루트 인프라 저장소**와 **일부 서브 프로젝트 저장소**가 분리되어 있습니다.

- **루트 인프라 리포지토리 (`audit-quality`)**
  - 위치: `~/source/03_Development/audit-quality`
  - 원격: `git@github.com:ypspy/audit-quality.git`
  - 포함 대상: `docker-compose.yml`, Traefik/Keycloak/Observability 설정, Next.js `apps/web`, 일부 서비스 코드, 문서(`docs/` 등)
  - 작업 예시:

    ```bash
    cd ~/source/03_Development/audit-quality

    # 브랜치 생성 (docs/workflow.md 참고)
    git switch -c feat/nextjs-shell

    # 변경 사항 커밋
    git commit -m "feat(web): add new dashboard page"

    # 원격 push
    git push -u origin feat/nextjs-shell
    ```

- **별도 서비스 리포지토리 (`dart-for-auditor`)**
  - 위치: `~/source/03_Development/audit-quality/dart-for-auditor`
  - 원격: `https://github.com/ypspy/dart-for-auditor.git`
  - 역할: DART 감사보고서 메타데이터 인덱서·뷰어의 애플리케이션 코드 전용 저장소
  - **주의:** 이 디렉터리 안에는 별도의 `.git`이 있으므로, 이 안에서의 `commit/push`는 `ypspy/dart-for-auditor` 리포지토리로 올라갑니다.
  - 작업 예시:

    ```bash
    cd ~/source/03_Development/audit-quality/dart-for-auditor

    git switch -c feat/new-filter
    git commit -m "feat(dart): add filing date filter"
    git push -u origin feat/new-filter
    ```

- **어떤 리포지토리에 커밋할지 결정하는 기준**
  - **인프라/공통 설정 변경** (예: `docker-compose.yml`, Traefik, Keycloak, Observability, 문서): → 루트 `audit-quality` 리포지토리에서 브랜치/커밋/PR
  - **`dart-for-auditor` 앱 내부 로직 변경**: → `dart-for-auditor` 리포지토리에서 브랜치/커밋/PR
  - 변경 후에는 항상 **루트에서 관련 Docker 서비스만 재빌드**하는 것을 기본으로 합니다.

### 4. 전체 개발 프로세스 (요약)

자세한 내용은 `docs/workflow.md`, `docs/roadmap.md`, `docs/setup.md`를 참고하고, 아래 흐름을 기본으로 합니다.

1. `docs/roadmap.md`에서 작업할 Task 선택
2. (해당 리포지토리에서) `feat/`, `fix/`, `chore/` 브랜치 생성 (`docs/workflow.md` 참조)
3. 코드 수정 (`dart-for-auditor` 또는 루트 `audit-quality` 하위 서비스 디렉터리)
4. 관련 Docker 서비스만 선택적으로 재빌드 (`docker compose up -d --build <service-name>`)
5. Conventional Commits 형식으로 커밋 후 PR 생성
6. 리뷰/머지 후, 실제 동작 확인 및 Docker 스택 상태 점검
7. 작업이 완료되면 `docs/roadmap.md`에서 해당 Task 체크박스를 `[x]`로 변경
