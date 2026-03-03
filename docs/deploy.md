# 배포 절차

Docker Compose 기반 프로덕션 배포와 GitHub Actions CI/CD 파이프라인을 설명합니다.

---

## 목차

- [목표 배포 구조](#목표-배포-구조)
- [Docker Compose 배포](#docker-compose-배포)
- [GitHub Actions CI/CD](#github-actions-cicd)
- [Traefik TLS 설정](#traefik-tls-설정)
- [롤백 절차](#롤백-절차)
- [배치 파이프라인 수동 실행](#배치-파이프라인-수동-실행)
- [모니터링](#모니터링)

---

## 목표 배포 구조

```
[GitHub main 브랜치 push]
        ↓
[GitHub Actions]
  ├── lint + test
  ├── Docker 이미지 빌드
  ├── 이미지 레지스트리 Push (GitHub Container Registry)
  └── 서버에 SSH 접속 → docker compose pull && up -d
        ↓
[프로덕션 서버]
  Traefik ← HTTPS 진입점
    ├── Next.js (통합 UI)
    ├── Express API 서비스들
    ├── Flask API
    ├── Keycloak
    └── Grafana
```

---

## Docker Compose 배포

### 로컬 개발 (이미지 빌드)

```bash
docker compose up -d --build
```

### 프로덕션 실행 (GHCR 이미지 사용)

CI에서 push한 이미지를 사용할 때는 `docker-compose.prod.yml` 오버라이드를 사용합니다.

```bash
# 환경 변수: GitHub 사용자/조직명으로 교체
export GHCR_IMAGE_PREFIX=ghcr.io/YOUR_ORG_OR_USER
export IMAGE_TAG=latest

# 이미지 최신화 후 재시작
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 특정 서비스만 재시작
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps qualityportal

# 전체 상태 확인
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# 로그 확인 (실시간)
docker compose logs -f <서비스명>
```

### 서비스별 헬스체크

| 서비스 | 헬스체크 URL |
|--------|-------------|
| timesheet | `GET /health` |
| dart-for-auditor | `GET /api/health` |
| qualityPortal | `GET /` |
| qualityEval | `GET /` |
| local-inquiry-site | `GET /` |
| Traefik | Traefik Dashboard (`/dashboard`) |
| Keycloak | `GET /health/ready` |
| Grafana | `GET /api/health` |

---

## GitHub Actions CI/CD

### CI (Pull Request)

`.github/workflows/ci.yml` — PR 생성·업데이트 시 자동 실행.

```yaml
on:
  pull_request:
    branches: [main]

jobs:
  test:
    # 각 서비스별 lint + test
```

**포함 내용:**
- Node.js 서비스: `npm run lint` + `npm test`
- Python 서비스: `flake8` + `pytest`
- MkDocs: `mkdocs build --strict`

### CD (Deploy)

`.github/workflows/deploy.yml` — `main` 브랜치 push 시 자동 실행.

```yaml
on:
  push:
    branches: [main]

jobs:
  build-push:
    # Docker 이미지 빌드 → GitHub Container Registry push

  deploy:
    needs: build-push
    # SSH → docker compose pull && up -d
```

### GitHub Container Registry (GHCR) 설정

- **기본:** main push 시 `GITHUB_TOKEN`으로 자동 로그인하여 이미지 push (별도 토큰 불필요).
- **이미지 경로:** `ghcr.io/<repository_owner>/audit-quality-<서비스명>:latest` (예: `audit-quality-portal`, `audit-quality-dart`).
- **패키지 공개:** Repository → Settings → Packages → 해당 패키지 → Change visibility (비공개 시 배포 서버에서 `REGISTRY_TOKEN` 필요).

### GitHub Actions Secrets / Variables 설정

| 종류 | 이름 | 설명 |
|------|------|------|
| Secret | `SSH_HOST` | 배포 서버 IP / 도메인 |
| Secret | `SSH_USER` | SSH 사용자명 |
| Secret | `SSH_PRIVATE_KEY` | SSH 개인키 |
| Secret | `REGISTRY_TOKEN` | GHCR 읽기용 PAT (비공개 패키지일 때 배포 서버 로그인용) |
| Variable | `DEPLOY_ENABLED` | `true` 시 SSH 배포 단계 실행 |
| Variable | `DEPLOY_PATH` | (선택) 서버 내 프로젝트 경로, 미설정 시 `$HOME/audit-quality` |

---

## Traefik 라우팅 구조

### 파일 프로바이더 (`traefik/dynamic/`)

서비스 라우팅은 Docker 라벨 대신 파일 프로바이더로 명시적으로 정의되어 있습니다.

| 파일 | 역할 |
|------|------|
| `middlewares.yml` | 공통 미들웨어 (ForwardAuth, RateLimit, IPAllowlist) + Next.js 셸 라우터 |
| `services.yml` | 각 백엔드 서비스 라우터 및 서비스 정의 (Keycloak, portal, eval, timesheet, dart, client) |

> **참고:** Windows Docker Desktop 환경에서 Traefik Docker provider가 소켓 오류(`Error response from daemon`)를 발생시키는 경우가 있습니다. 이 경우에도 파일 프로바이더 라우팅은 정상 동작합니다. 설정 변경 후에는 `docker compose restart traefik`을 실행하세요 (파일 감시 모드 `watch: true`이지만 컨테이너 재시작이 더 확실함).

### Keycloak 환경 변수 (`docker-compose.yml`)

| 변수 | 값 | 설명 |
|------|----|------|
| `KC_HOSTNAME` | `http://localhost/auth` | 브라우저-facing URL. 디스커버리 문서의 issuer/endpoint 기준 |
| `KC_HTTP_RELATIVE_PATH` | `/auth` | Keycloak HTTP 경로 prefix |
| `KC_PROXY` | `edge` | Traefik 앞단 프록시 처리 |

### Next.js Auth.js 환경 변수 (`docker-compose.yml`)

| 변수 | 값 | 설명 |
|------|----|------|
| `AUTH_KEYCLOAK_ISSUER` | `http://localhost/auth/realms/yss` | 브라우저-facing issuer (디스커버리 문서 issuer와 일치해야 함) |
| `AUTH_KEYCLOAK_INTERNAL_URL` | `http://keycloak:8080/auth/realms/yss` | 컨테이너 내부 OIDC fetch 목적지 (`customFetch`로 issuer URL을 이 URL로 교체) |
| `AUTH_URL` | `http://localhost` | Auth.js 콜백 base URL |

---

## Traefik TLS 설정

### 로컬 개발 (자체 서명 인증서)

```yaml
# traefik.yml
tls:
  certificates:
    - certFile: /certs/local.crt
      keyFile: /certs/local.key
```

### 프로덕션 (Let's Encrypt)

```yaml
# traefik.yml
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@example.com
      storage: /acme/acme.json
      httpChallenge:
        entryPoint: web
```

---

## 롤백 절차

### 이전 이미지로 롤백

```bash
# 현재 실행 중인 이미지 태그 확인
docker compose images

# 특정 이미지 태그로 롤백
docker compose down qualityportal
docker compose run -d --no-deps \
  -e IMAGE_TAG=<이전 태그> qualityportal

# 또는 docker-compose.yml에서 image 태그 직접 수정 후
docker compose up -d --no-deps qualityportal
```

### 데이터베이스 롤백

```bash
# MongoDB: mongodump로 백업된 데이터 복원
mongorestore --uri="$MONGODB_URI" ./backup/

# PostgreSQL: pg_dump 백업 복원
psql $DATABASE_URL < ./backup/db.sql
```

---

## 배치 파이프라인 수동 실행

자동 스케줄이 실패했거나 즉시 실행이 필요한 경우:

```bash
# DART 공시 수집 (dart-for-auditor)
# - 매일 08:00, 18:00 실행 용도로 설계된 배치 컨테이너
docker compose run --rm dart-collector npm run collect:daily

# 규제 업데이트 크롤러 (quality-updates-crawler)
# - 분기 말 기준 기간을 인자로 지정
docker compose run --rm regulation-crawler \
  python unified_crawler.py --start 2025-10-01 --end 2025-12-31

# 감사보고일 추출 (disclosureAnalysis)
# - 기본: /data 입력, /outputs 출력 (docker-compose.yml 볼륨 참조)
docker compose run --rm disclosure-analysis python reportDate.py
```

### 배치 파이프라인 자동 실행 (cron 예시)

서버 OS 레벨에서 cron을 사용해 위 컨테이너를 스케줄링할 수 있습니다.

```bash
# 예시: crontab -e

# 1) DART 메타데이터 일일 수집 (매일 08:00, 18:00)
0 8,18 * * * cd $HOME/audit-quality && docker compose run --rm dart-collector npm run collect:daily >> $HOME/logs/dart-collector.log 2>&1

# 2) 규제 업데이트 크롤러 (분기별: 1/4/7/10월 1일 03:00)
0 3 1 1,4,7,10 * cd $HOME/audit-quality && \
  docker compose run --rm regulation-crawler \
  python unified_crawler.py --start $(date -d '3 months ago' +\%Y-\%m-01) --end $(date -d 'yesterday' +\%Y-\%m-\%d) \
  >> $HOME/logs/regulation-crawler.log 2>&1

# 3) 감사보고일 추출 (매월 1일 02:00)
0 2 1 * * cd $HOME/audit-quality && docker compose run --rm disclosure-analysis python reportDate.py >> $HOME/logs/disclosure-analysis.log 2>&1
```

> 위 cron 예시는 리눅스 환경 기준이며, 실제 경로(`$HOME/audit-quality`, 로그 디렉터리 등)는 배포 서버 환경에 맞게 조정해야 합니다.

---

## 모니터링

배포 후 Grafana 대시보드에서 확인:

- **서비스 헬스**: 모든 컨테이너 UP 상태
- **에러율**: HTTP 5xx 응답 비율
- **응답 시간**: p50 / p95 / p99
- **배치 실행 결과**: 마지막 실행 시각 및 성공 여부
