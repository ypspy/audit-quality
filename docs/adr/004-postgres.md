# ADR-004: PostgreSQL 마이그레이션 결정

**날짜:** 2026-02-27
**상태:** 결정됨

---

## Context

현재 `local-inquiry-site`는 SQLite를 사용한다. SQLite는 로컬 개발과 단일 프로세스 환경에서는 적합하지만, 다음과 같은 제약이 있다:

- 동시 쓰기 제한 (WAL 모드에서도 단일 writer).
- Docker 컨테이너 재배포 시 데이터 파일 마운트 관리 필요.
- Keycloak이 PostgreSQL을 백엔드 DB로 사용하므로, 동일 PostgreSQL 인스턴스를 재사용하면 운영 단순화 가능.
- 장기적으로 timesheet·고객 정보 DB 통합 시 관계형 DB가 필요.

---

## Options Considered

### Option A: SQLite 유지

- 추가 설정 없음.
- 동시 접근 부하 증가 시 성능 저하 가능.
- Docker 볼륨 마운트 관리 필요.
- Keycloak DB와 분리 운영 필요.

### Option B: MySQL / MariaDB

- SQLAlchemy 지원, Flask와 호환.
- 별도 컨테이너 필요. Keycloak은 PostgreSQL을 권장하므로 두 DB를 운영해야 함.

### Option C: PostgreSQL 17 (채택)

- Keycloak 공식 권장 DB → 동일 인스턴스 재사용으로 운영 단순화.
- SQLAlchemy `DATABASE_URL`만 변경하면 local-inquiry-site 코드 수정 없음.
- 동시 읽기·쓰기 성능 우수.
- 향후 timesheet 고객 데이터 통합 시 확장 용이.

---

## Decision

**PostgreSQL 17을 채택한다.** local-inquiry-site의 SQLite를 PostgreSQL로 마이그레이션하고, Keycloak도 동일 PostgreSQL 인스턴스를 사용한다.

마이그레이션 절차:
1. PostgreSQL Docker 컨테이너 추가.
2. `local-inquiry-site/.env`의 `DATABASE_URL`을 PostgreSQL URI로 변경.
3. Flask-Migrate로 스키마 적용: `flask db upgrade`.
4. SQLite 데이터 → PostgreSQL 이전 스크립트 실행 및 검증.
5. 원본 SQLite 파일 백업 보관 (최소 30일).

---

## Consequences

**긍정적:**
- DB 인스턴스 통합으로 운영 복잡도 감소 (PostgreSQL 1개 관리).
- 동시 사용자 증가에도 안정적인 성능.
- 향후 고객 정보 단일화 시 JOIN 쿼리 활용 가능.

**부정적·주의사항:**
- 마이그레이션 중 데이터 유실 위험 → 원본 SQLite 백업 필수, 검증 스크립트 사전 작성.
- PostgreSQL 컨테이너 추가로 메모리 사용량 증가 (~256MB).
- 로컬 개발 시 PostgreSQL 컨테이너 실행 필요 (SQLite처럼 파일만으로 동작하지 않음).
