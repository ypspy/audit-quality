# 로컬 개발환경 세팅

---

## 목차

- [사전 요구사항](#사전-요구사항)
- [저장소 클론](#저장소-클론)
- [환경 변수 설정](#환경-변수-설정)
- [전체 스택 실행 (Docker Compose)](#전체-스택-실행-docker-compose)
- [서비스별 개별 실행 (개발 모드)](#서비스별-개별-실행-개발-모드)
- [데이터베이스](#데이터베이스)
- [자주 발생하는 문제](#자주-발생하는-문제)

---

## 사전 요구사항

| 도구 | 버전 | 설치 방법 |
|------|------|-----------|
| Node.js | 20.9.0 | [fnm](https://github.com/Schniz/fnm) 권장 |
| Python | 3.12 이상 | [pyenv](https://github.com/pyenv/pyenv) 또는 직접 설치 |
| Docker Desktop | 최신 | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Docker Compose | v2 (Docker Desktop 포함) | — |
| Git | 2.x | — |

### Node.js 버전 관리 (fnm)

```bash
# fnm 설치 (Windows)
winget install Schniz.fnm

# ~/.bashrc에 추가
eval "$(fnm env --use-on-cd --shell bash)"

# 프로젝트 진입 시 자동 적용 (.nvmrc 파일 기준)
fnm install  # 최초 1회
fnm use
```

### Python 가상환경

각 Python 서비스(`local-inquiry-site`, `quality-updates-crawler`, `disclosureAnalysis`, `contractParsing`)는 독립 가상환경을 사용합니다.

```bash
cd <서비스 폴더>
python -m venv .venv

# Windows (Git Bash)
source .venv/Scripts/activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

---

## 저장소 클론

```bash
git clone <repository-url>
cd audit-quality
```

---

## 환경 변수 설정

각 서비스 폴더에 `.env.example`이 있습니다. 복사 후 값을 채워주세요.

```bash
# .env.example이 있는 서비스
cp dart-for-auditor/.env.example dart-for-auditor/.env
cp local-inquiry-site/.env.example local-inquiry-site/.env

# 루트 .env (Docker Compose 전체): cp .env.example .env
# Next.js 통합 UI: cp apps/web/.env.example apps/web/.env.local
# .env.example이 없는 서비스 — 아래 공통 환경 변수 목록을 참고해 직접 작성
# qualityPortal/.env
# qualityEval/.env
# timesheet/.env
```

### 공통 환경 변수 목록

| 변수 | 서비스 | 설명 |
|------|--------|------|
| `MONGODB_URI` | qualityPortal, qualityEval, timesheet, dart-for-auditor | MongoDB 연결 URI |
| `SESSION_SECRET` | timesheet | 세션 암호화 키 |
| `SECRET` | qualityEval | 세션 시크릿 |
| `ENCRYPTION_KEY` | local-inquiry-site | Fernet 암호화 키 |
| `SECRET_KEY` | local-inquiry-site | Flask 세션 키 |
| `DATABASE_URL` | local-inquiry-site | DB 연결 URI (기본: SQLite) |

### ENCRYPTION_KEY 생성 (local-inquiry-site)

```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

---

## 전체 스택 실행 (Docker Compose)

> Phase 1-1·1-2 완료. 루트의 `docker-compose.yml`과 `.env.example`을 사용합니다.

```bash
# 루트에서 .env 준비 (최초 1회)
cp .env.example .env
# .env에서 QUALITYEVAL_SECRET, TIMESHEET_*, LOCAL_INQUIRY_* 등 필요 시 수정

# 전체 스택 빌드 및 실행
docker compose up -d

# 헬스체크 확인 (모든 서비스 healthy 목표)
docker compose ps

# 로그 확인
docker compose logs -f

# 중지
docker compose down
```

### Traefik을 통한 접속 (Phase 1-2)

Traefik이 80/443을 사용합니다. 아래 경로로 접속하면 각 백엔드로 프록시됩니다 (HTTPS는 자체 서명 인증서 사용 시 브라우저에서 경고 가능).

| 경로 | 백엔드 | 비고 |
|------|--------|------|
| `http://localhost/` | Next.js 통합 UI (web) | Keycloak 로그인 후 각 서비스 링크 제공 |
| `http://localhost/auth` | Keycloak SSO | 관리 콘솔: `/auth/admin` |
| `http://localhost/api/portal` | qualityPortal | ForwardAuth 적용 |
| `http://localhost/api/eval` | qualityEval | ForwardAuth 적용 |
| `http://localhost/api/timesheet` | timesheet | ForwardAuth 적용 |
| `http://localhost/api/dart` | dart-for-auditor API | ForwardAuth 적용 |
| `http://localhost/api/client` | local-inquiry-site | ForwardAuth + LAN IP 허용만 |
| `http://localhost:8080` | Traefik 대시보드 | |

### Keycloak 초기 유저 생성 (최초 1회)

`docker compose up -d` 후 최초 1회 `yss` realm 유저를 생성해야 앱 로그인이 가능합니다.
Keycloak `admin` 계정은 `master` realm 전용이므로 `yss` realm에서는 직접 사용 불가.

1. `http://localhost/auth/admin` 접속
2. `admin` / `.env`의 `KEYCLOAK_ADMIN_PASSWORD` (기본: `admin`) 로 로그인
3. 좌측 상단 realm 드롭다운 → **yss** 선택
4. 좌측 메뉴 **Users** → **Add user** → Username 입력 → **Create**
5. **Credentials** 탭 → **Set password** → Temporary **체크 해제** → **Save password**

로컬 HTTPS: `https://localhost/api/portal` 등. 기본은 Traefik 내장 자체 서명 인증서(브라우저 경고 가능). 자체 서명 파일을 쓰려면 `traefik/gen-certs.sh` 실행 후 `traefik/dynamic/`에 TLS 인증서 설정 추가.

| 서비스 | 호스트 포트 | 용도 |
|--------|-------------|------|
| Traefik | 80, 443, 8080 | 리버스 프록시·대시보드 |
| web (Next.js) | 3020 | 통합 UI 셸 (Traefik으로는 `/` 제공) |
| qualityPortal | 3001 | 감사·품질 포털 |
| qualityEval | 3002 | 품질 평가 |
| timesheet | 3003 | 타임시트 |
| dart-for-auditor API | 4000 | DART API (뷰어 UI는 Next.js /dart로 이전) |
| local-inquiry-site | 8000 | 고객 조회 |
| MongoDB | 27017 | 공통 DB |

---

## 서비스별 개별 실행 (개발 모드)

### Node.js 서비스 (qualityPortal, qualityEval, timesheet, dart-for-auditor)

```bash
cd <서비스 폴더>
npm install
npm run dev   # 또는 npm start
```

| 서비스 | 기본 포트 |
|--------|----------|
| qualityPortal | 3000 |
| qualityEval | 3000 (`.env`에서 PORT 설정) |
| timesheet | 3000 (`.env`에서 PORT 설정) |
| dart-for-auditor API | 4000 |

### Flask 서비스 (local-inquiry-site)

```bash
cd local-inquiry-site
source .venv/Scripts/activate  # Windows
pip install -r requirements.txt
python app.py
# → http://localhost:8000
```

### Python 배치 스크립트

```bash
# quality-updates-crawler
cd quality-updates-crawler
source .venv/Scripts/activate
py unified_crawler.py --start 2025-01-01 --end 2025-03-31

# disclosureAnalysis
cd disclosureAnalysis
python reportDate.py

# contractParsing
cd contractParsing
python AL_HTML_Time.py     # 외부감사 실시내용 추출
python HTML_to_Table.py    # 감사계약체결보고 추출
```

### MkDocs 문서 사이트

```bash
# policy
cd policy/my-project
pip install mkdocs mkdocs-material
mkdocs serve  # → http://127.0.0.1:8000

# quality-updates
cd quality-updates
python -m venv .venv && source .venv/Scripts/activate
pip install -r requirements.txt
mkdocs serve  # → http://127.0.0.1:8000
```

---

## 데이터베이스

### MongoDB

로컬 개발에는 MongoDB Atlas 무료 클러스터 또는 Docker 컨테이너를 사용합니다.

```bash
# Docker로 MongoDB 실행
docker run -d --name mongo -p 27017:27017 mongo:7
```

각 서비스의 `MONGODB_URI`를 `mongodb://localhost:27017/<db명>`으로 설정합니다.

### SQLite (local-inquiry-site)

최초 실행 시 `instance/database.db`가 자동 생성됩니다. 스키마 변경 시:

```bash
cd local-inquiry-site
set FLASK_APP=app.py
flask db migrate -m "변경 설명"
flask db upgrade
```

---

## 자주 발생하는 문제

| 문제 | 원인 | 해결 |
|------|------|------|
| Keycloak 로그인 후 `user_not_found` | `yss` realm에 유저 없음 | [Keycloak 초기 유저 생성](#keycloak-초기-유저-생성-최초-1회) 절차 수행 |
| `/auth` 경로 404 | Traefik Docker provider 오류 (Windows Docker Desktop 소켓 문제) | `traefik/dynamic/services.yml` 파일 프로바이더 확인. 변경 시 `docker compose restart traefik` 실행 |
| Next.js 접속 시 `ERR_TOO_MANY_REDIRECTS` | `http://` ↔ `https://` 혼용 | `.env`에 `WEB_AUTH_URL=http://localhost`, `KEYCLOAK_ISSUER=http://localhost/auth/realms/yss` 통일 후 `docker compose up -d --force-recreate web`. 접속도 반드시 **http://localhost** |
| Auth.js `error=Configuration` | web 컨테이너에서 Keycloak 내부 URL 접근 실패 | `AUTH_KEYCLOAK_INTERNAL_URL`이 `http://keycloak:8080/auth/realms/yss`로 설정되었는지 확인 |
| `mkdocs: command not found` | 가상환경 미활성화 | `source .venv/Scripts/activate` 후 재실행 |
| `ENCRYPTION_KEY` 오류 | 환경 변수 미설정 | `.env` 파일에 `ENCRYPTION_KEY` 값 추가 |
| MongoDB 연결 실패 | URI 오류 또는 DB 미실행 | Docker MongoDB 컨테이너 상태 확인 |
| dart-for-auditor 동시 수집 실행 | IP 차단 위험 | 수집기 순차 실행 (daily → weekly → monthly) |

---

## 품질 평가 (`/eval`) 테스트 (Docker 환경)

### 1. 전체 스택 기동

```bash
# 루트에서
cp .env.example .env   # 최초 1회
docker compose up -d

# 헬스체크 확인
docker compose ps
```

### 2. 접속 URL

| 환경 | URL | 비고 |
|------|-----|------|
| 통합 UI (홈) | `http://localhost/` | Keycloak 로그인 필요 |
| 품질 평가 페이지 | `http://localhost/eval` | 로그인 후 네비게이션에서 "품질 평가" 클릭 |
| qualityEval API 직접 | `http://localhost/api/eval/risk-controls` | Traefik → qualityeval, ForwardAuth 적용 |

> **주의:** `.env`에 `WEB_AUTH_URL=http://localhost`, `KEYCLOAK_ISSUER=http://localhost/auth/realms/yss`로 통일하고, 접속 시 **http** 사용. `https` 사용 시 리다이렉트 루프 가능.

### 3. 테스트 절차

1. **로그인**  
   - `http://localhost/` 접속 → 미인증 시 Keycloak 로그인 페이지로 리다이렉트  
   - Keycloak `yss` realm 유저로 로그인 (없으면 [Keycloak 초기 유저 생성](#keycloak-초기-유저-생성-최초-1회) 수행)

2. **품질 평가 페이지**  
   - 상단 네비게이션 **품질 평가** 클릭 → `http://localhost/eval` 이동  
   - 리스크·통제 테이블이 표시되는지 확인

3. **필터**  
   - 담당자 / 상태 / 연도 드롭다운 변경 → 테이블 행이 필터링되는지 확인

4. **편집**  
   - 상태 드롭다운 변경 → 저장 후 반영되는지 확인  
   - 검토 의견 textarea 입력 후 포커스 아웃 → 저장 후 새로고침 시 유지되는지 확인

### 4. API 직접 호출 (curl)

로그인 세션 쿠키가 필요하므로, 브라우저에서 로그인한 뒤 개발자 도구 → Network 탭에서 요청을 복사하거나, 아래처럼 토큰을 전달합니다.

```bash
# 목록 조회 (Traefik 경유, ForwardAuth로 인증 필요)
curl -i "http://localhost/api/eval/risk-controls"

# qualityEval 컨테이너 직접 (인증 없이, 개발/디버깅용)
curl -i "http://localhost:3002/risk-controls"
```

### 5. 데이터 준비

MongoDB `qualityeval` DB에 `riskcontrols` 컬렉션 데이터가 없으면 테이블이 비어 있습니다.  
기존 qualityEval EJS 환경에서 사용하던 MongoDB를 그대로 쓰거나, 샘플 데이터를 삽입한 뒤 테스트하세요.
