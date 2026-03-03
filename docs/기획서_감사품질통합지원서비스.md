# 감사·품질 통합지원 서비스 기획서

**작성일:** 2026-02-23
**최종 수정:** 2026-02-27
**프로젝트:** audit-quality
**버전:** v1.4

---

## 목차

1. [개요](#1-개요)
2. [배경 및 목적](#2-배경-및-목적)
3. [현황 분석](#3-현황-분석)
4. [이해관계자 및 사용 시나리오](#4-이해관계자-및-사용-시나리오)
5. [서비스 비전 및 목표](#5-서비스-비전-및-목표)
6. [서비스 구성 및 핵심 기능](#6-서비스-구성-및-핵심-기능)
7. [기술 아키텍처](#7-기술-아키텍처)
8. [데이터 흐름](#8-데이터-흐름)
9. [기대효과](#9-기대효과)
10. [추진 로드맵](#10-추진-로드맵)
11. [보안·컴플라이언스](#11-보안컴플라이언스)
12. [리스크 및 대응 방안](#12-리스크-및-대응-방안)

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| **서비스명** | 감사·품질 통합지원 서비스 (Audit Quality Integrated Support Service) |
| **대상** | 회계법인 감사팀·품질관리팀·연구팀 |
| **핵심 가치** | 공시 수집부터 감사 품질 평가까지, 감사 업무 전 주기를 단일 플랫폼에서 지원 |
| **기술 기반** | Next.js 15, Node.js/Express 5, Python/Flask 3, Keycloak, Traefik, PostgreSQL/MongoDB, OpenTelemetry |

---

## 2. 배경 및 목적

### 2.1 문제 인식

현재 감사·품질 업무는 **다수의 독립된 시스템**으로 파편화되어 있어 다음과 같은 문제가 발생한다.

- **업무 단절**: 공시 수집(DART) → 계약 정보 파싱 → 업무 시간 기록 → 품질 평가가 각기 다른 시스템에 분산
- **데이터 중복**: 고객사 정보가 타임시트·고객 조회 시스템·품질 포털에 각각 별도로 관리됨
- **접근 불편**: 시스템마다 별도 로그인 및 URL이 존재하여 실무자 혼선
- **문서 분산**: 내규·절차(policy, quality-updates)가 별도 사이트로 존재하여 실무 흐름 중 참조 불편

### 2.2 목적

> **감사 업무 전 주기(공시 수집·모니터링 → 계약 파싱 → 업무 기록 → 품질 평가)를 단일 통합 플랫폼으로 연결하여, 실무 효율 향상과 감사 품질 제고를 동시에 달성한다.**

---

## 3. 현황 분석

### 3.1 기존 모듈 현황

#### 그룹 A. 품질관리·운영 포털 (웹 서비스)

| 모듈 | 기능 | 상태 |
|------|------|------|
| **qualityPortal** | 정책·양식·VSC·QC 포털 (Express + EJS + MongoDB, nodemailer 이메일 알림) | 운영 중 |
| **qualityEval** | 리스크·통제 항목 평가, 담당자·진행상태·보고유형·연도 필터, Passport 인증, Markdown 렌더링 | 운영 중 |
| **timesheet** | 업무 시간 기록·관리, 직원/고객 관리, 감사 가이드, CSRF·Rate Limiting 보안 (Node.js 20.9.0) | 운영 중 |
| **local-inquiry-site** | LAN 전용 고객 정보 조회 (Flask + SQLAlchemy + Fernet 암호화, **현재 SQLite**, PostgreSQL 전환 가능) | 운영 중 |
| **policy** | 품질관리 내규·절차 MkDocs Material 사이트 (품질관리규정·품질관리절차 등) | 운영 중 |
| **quality-updates** | 회계·감사 규제 업데이트 정적 문서 사이트 (MkDocs Material, **Render 배포**, GitHub Actions CI) | 운영 중 |

#### 그룹 B. DART·공시 수집·파싱

| 모듈 | 기능 | 상태 |
|------|------|------|
| **dart-for-auditor** | DART 감사보고서 **메타데이터 인덱싱**·API·뷰어 (공시 원문 재배포 금지, URL·메타만 인덱싱) | 운영 중 |
| **quality-updates-crawler** | FSS·FSC·KICPA·KASB 규제 업데이트 수집 → Markdown 자동 생성 (Python, BeautifulSoup) | 운영 중 |
| **contractParsing** | 감사보고서·계약체결보고 HTML 파싱, 외부감사 실시내용 추출 (Python 배치, DSD→HTML 변환 포함) | 운영 중 |

#### 그룹 C. 데이터 분석 (Python)

| 모듈 | 기능 | 상태 |
|------|------|------|
| **disclosureAnalysis** | 감사보고서 HTML에서 감사보고일 추출, 12월 결산 필터 (연구·실무 겸용) | 운영 중 |

### 3.2 현황 진단

**강점 (Strengths)**
- 도메인별 전문화된 모듈이 잘 구축되어 있음
- 공시 수집·파싱·규제 모니터링·품질 평가를 아우르는 전체 업무 지원
- 각 모듈이 독립 배포 가능한 구조 (Monorepo)

**약점 (Weaknesses)**
- 모듈 간 인증 체계 미통합 (각기 다른 로그인)
- 고객사 데이터가 복수 DB(MongoDB·SQLite)에 분산
- 하드코딩된 로컬 경로로 이식성 저하

**기회 (Opportunities)**
- DART Open API 고도화로 데이터 수집 자동화 확대 가능
- AI·LLM 활용한 감사 보고서 분석 고도화 시점
- 감사인 감리·품질 평가 규제 강화 → 품질관리 수요 증가

**위협 (Threats)**
- DART 데이터 정책 변경 시 수집 파이프라인 영향
- 금융감독원 등 규제기관 데이터 활용 제약
- 개인정보·영업비밀 보호 강화 요구

---

## 4. 이해관계자 및 사용 시나리오

### 4.1 이해관계자별 역할

| 이해관계자 | 주요 관심사 | 주요 사용 모듈 |
|-----------|------------|---------------|
| **감사팀원** | 계약 정보 확인, 타임시트 기록, 공시 조회 | timesheet, contractParsing, dart-for-auditor |
| **감사팀장** | 팀원 업무시간 현황, 고객 정보 관리 | timesheet, local-inquiry-site |
| **품질관리담당자** | 리스크·통제 평가, 내규 참조, 규제 동향 확인, 이벤트 알림 | qualityEval, qualityPortal, policy, quality-updates |
| **시스템 관리자** | 배치 실행 모니터링, 사용자 권한 관리, 크롤러 운영 | 전체 모듈 |

### 4.2 주요 사용 시나리오 (Use Case)

#### UC-01. 감사팀: 계약 체결 → 타임시트 등록

```
1. 감사계약체결보고 HTML 업로드 (contractParsing)
   → 계약 정보(의뢰인, 감사 기간, 보수) 자동 추출·저장
2. 추출된 고객 정보가 timesheet에 자동 반영
3. 감사팀원이 일별 업무 시간 기록 (timesheet)
4. 팀장이 주간 업무 현황 대시보드 확인
```

#### UC-02. 품질관리팀: 리스크 평가 → 내규 참조

```
1. 품질관리담당자가 qualityEval에 로그인 (SSO)
2. 연도·담당자 필터로 리스크·통제 항목 조회
3. 이슈 발생 시 qualityPortal에서 관련 양식·VSC 문서 확인
4. policy 통합 검색으로 해당 내규·절차 조항 즉시 참조
5. 처리 완료 시 이메일 알림 자동 발송 (nodemailer)
```

#### UC-03. 품질관리팀: 규제 동향 확인 → 내규 참조

```
1. quality-updates-crawler 정기 실행 → 신규 규제·보도자료 Markdown 자동 생성
2. quality-updates 사이트(/updates)에서 최신 규제 동향 조회
3. 관련 내규·절차 조항을 policy 사이트에서 즉시 참조
4. qualityEval에서 해당 리스크·통제 항목 업데이트
```

#### UC-04. 감사팀: 공시 모니터링 → 보고서 열람

```
1. 통합 포털 /dart 접속 → 감사보고서 검색 (dart-for-auditor)
2. 원문 링크로 DART 원본 문서 확인
3. 회사명 변경 이력·합병 정보 자동 추적
```

---

## 5. 서비스 비전 및 목표

### 5.1 비전

> **"하나의 플랫폼, 감사 전 주기 지원"**
> 공시 수집·분석부터 업무 계획·실시·품질 평가·연구까지, 감사인이 필요한 모든 정보와 기능을 단일 접점에서 제공한다.

### 5.2 목표

| 구분 | 목표 |
|------|------|
| **단기 (Phase 1)** | Traefik + Keycloak SSO + Docker Compose 기반 인프라 통합 |
| **중기 (Phase 2)** | Next.js 통합 UI 셸 + GitHub Actions CI/CD + 배치 자동화 |
| **장기 (Phase 3)** | 전 서비스 Next.js 이전 완료 + 감사보고일 대시보드 |

---

## 6. 서비스 구성 및 핵심 기능

### 6.1 서비스 구조 (통합 포털 기준)

```
감사·품질 통합지원 서비스
├── [A] 업무 관리
│   └── 타임시트 (timesheet)
├── [B] 고객·계약 관리
│   ├── 고객 정보 조회 (local-inquiry-site)
│   └── 감사 계약 정보 파싱 (contractParsing)
├── [C] 공시 모니터링
│   ├── DART 감사보고서 뷰어 (dart-for-auditor)
│   ├── 규제 업데이트 크롤러 (quality-updates-crawler)
│   └── 규제 동향 문서 사이트 (quality-updates)
├── [D] 품질 관리
│   ├── 품질관리 포털 (qualityPortal)
│   ├── 리스크·통제 평가 (qualityEval)
│   └── 내규·절차 문서 (policy)
└── [E] 데이터 분석
    └── 감사보고일 분석 (disclosureAnalysis)
```

### 6.2 핵심 기능 상세

#### A. 업무 관리

| 기능 | 설명 | 기반 모듈 |
|------|------|-----------|
| 타임시트 등록·조회 | 일별/주별 업무 시간 기록, 고객·직원 연동 | timesheet |
| 변경 이력 관리 | 타임시트 수정 내역 추적 | timesheet (changelog) |
| 감사 가이드 열람 | Markdown 기반 감사 절차 문서 | timesheet (auditguide) |

#### B. 고객·계약 관리

| 기능 | 설명 | 기반 모듈 |
|------|------|-----------|
| 고객 정보 조회·편집 | 담당자→고객 계층 구조, Split/탭 뷰 | local-inquiry-site |
| 민감정보 암호화 관리 | FEIN·SSN·은행계좌·패스워드 Fernet 암호화 | local-inquiry-site |
| 감사 계약 정보 파싱 | 감사계약체결보고 HTML 자동 추출·저장 | contractParsing |
| 외부감사 실시내용 분석 | 인력·시간 구성표 자동 파싱 | contractParsing |

#### C. 공시 모니터링

| 기능 | 설명 | 기반 모듈 |
|------|------|-----------|
| 감사보고서 검색·열람 | DART 메타데이터 인덱싱, 원문 링크 제공 (공시 재배포 금지) | dart-for-auditor |
| 회사명 변경 추적 | 합병·분할·사명 변경 이력 관리 | dart-for-auditor |
| 공시 수집 스케줄링 | 일별/주별/월별 배치 수집 (동시 실행 금지, 초당 1회 제한) | dart-for-auditor |
| 규제 업데이트 수집 | FSS·FSC·KICPA·KASB 보도자료·규정 수집 → Markdown 자동 생성 | quality-updates-crawler |
| 규제 동향 문서 사이트 | 분기별 규제 업데이트 정적 사이트 (Render 배포) | quality-updates |

#### D. 품질 관리

| 기능 | 설명 | 기반 모듈 |
|------|------|-----------|
| 정책·양식 포털 | 감사 양식·VSC·QC 문서 열람 및 관리 | qualityPortal |
| 리스크·통제 평가 | 항목 조회·편집, 담당자·연도·진행상태 필터 | qualityEval |
| 내규·절차 열람 | MkDocs 기반 품질관리절차 문서 통합 | policy |
| 이메일 알림 | 품질 포털 이벤트 알림 (nodemailer) | qualityPortal |

#### E. 데이터 분석

| 기능 | 설명 | 기반 모듈 |
|------|------|-----------|
| 감사보고일 현황 | 12월 결산 법인 감사보고일 추출 및 분포 분석 | disclosureAnalysis |

---

## 7. 기술 아키텍처

### 7.1 현행 아키텍처 (AS-IS)

각 서비스가 독립 포트에서 개별 인증으로 운영되는 파편화 구조.

```
[사용자]
    │
    ├─── qualityPortal      (port: 3000) ── MongoDB  ── Passport.js 세션
    ├─── qualityEval        (port: 3001) ── MongoDB  ── Passport.js 세션
    ├─── timesheet          (port: 3002) ── MongoDB  ── 자체 세션
    ├─── dart-for-auditor   (port: 3003) ── MongoDB  ── 자체 세션
    ├─── local-inquiry-site (port: 8000) ── SQLite   ── Flask-Login
    ├─── policy             (MkDocs static)
    └─── quality-updates    (Render 외부 배포)
```

### 7.2 목표 아키텍처 (TO-BE)

Next.js 통합 UI 셸 + Traefik API Gateway + Keycloak SSO를 중심으로 한 현대적 단일 플랫폼.

```
[사용자 (브라우저)]
        │ HTTPS
        ▼
[Traefik v3 — API Gateway & Reverse Proxy]
  ├── TLS 자동화 (내부 CA 또는 Let's Encrypt)
  ├── Rate Limiting / IP Allowlist (local-inquiry-site LAN 전용)
  ├── ForwardAuth 미들웨어 → Keycloak 토큰 검증
  │
  ├── /          → Next.js 15 (통합 UI 셸, port 3000)
  ├── /api/portal     → qualityPortal Express API
  ├── /api/eval       → qualityEval Express API
  ├── /api/timesheet  → timesheet Express API
  ├── /api/dart       → dart-for-auditor Express API
  ├── /api/client     → local-inquiry-site Flask API
  ├── /policy    → policy (MkDocs Static)
  └── /updates   → quality-updates (MkDocs Static)

[Next.js 15 — 통합 UI 셸]
  ├── App Router + React Server Components (SSR)
  ├── next-auth v5 (Keycloak OIDC 연동)
  └── /portal, /eval, /timesheet, /dart, /client, /policy, /updates 페이지

[Keycloak 24 — OIDC/OAuth2 SSO]
  ├── Realm: yss
  ├── Clients: next-app, express-services, flask-service
  └── Realm Roles: admin, auditor, qc-manager (RBAC)

[데이터 레이어]
  ├── MongoDB 7   ── qualityPortal, qualityEval, timesheet, dart-for-auditor
  └── PostgreSQL 17 ── local-inquiry-site, Keycloak 내부 DB, 감사 로그

[관찰가능성 스택 (Grafana OSS)]
  ├── OpenTelemetry Collector (traces + metrics + logs 수집)
  ├── Prometheus (메트릭 저장)
  ├── Loki (로그 집계)
  ├── Tempo (분산 추적)
  └── Grafana (단일 대시보드)

[배치 파이프라인]
  ├── dart-collector       (cron: 매일 08:00, 18:00)
  ├── regulation-crawler   (cron: 분기별 1일 01:00) → quality-updates 자동 빌드
  └── disclosure-analysis  (cron: 매월 1일 02:00)

[CI/CD]
  └── GitHub Actions → Docker Build → 레지스트리 → 자동 배포
```

### 7.3 인증 설계 (Keycloak OIDC)

기존 Passport.js 세션 / Flask-Login을 **Keycloak OIDC**로 통합.

#### 인증 흐름

```
[사용자]
  │ 1. 미인증 요청
  ▼
[Next.js — next-auth v5]
  │ 2. Keycloak Authorization Code + PKCE 리다이렉트
  ▼
[Keycloak]
  │ 3. 로그인 → ID Token + Access Token (JWT) 발급
  ▼
[Next.js]
  │ 4. Server Component에서 Access Token → 내부 API Bearer 호출
  ▼
[Traefik ForwardAuth 또는 각 API의 JWT 미들웨어]
  └── 5. Keycloak Public Key로 서명 검증
```

#### 기존 서비스 전환 방식

| 서비스 | 현재 인증 | 전환 방식 |
|--------|----------|-----------|
| qualityEval | Passport.js (세션) | JWT 검증 미들웨어 추가, Keycloak Public Key 사용 |
| timesheet | 자체 세션 | 동일 |
| qualityPortal | Passport.js | 동일 |
| local-inquiry-site | Flask-Login | `python-jose` JWT 검증으로 교체 |
| dart-for-auditor | 자체 세션 | JWT 검증 미들웨어 추가 |

#### 세션·토큰 정책

| 항목 | 정책 |
|------|------|
| 프로토콜 | OAuth 2.0 + OIDC (Authorization Code + PKCE) |
| Access Token 유효기간 | 15분 |
| Refresh Token 유효기간 | 7일 |
| 토큰 저장 | next-auth HttpOnly Cookie (클라이언트 JS에 토큰 미노출) |
| 강제 로그아웃 | Keycloak Admin API로 세션 즉시 무효화 |
| LAN 전용 서비스 | Traefik IP Allowlist로 local-inquiry-site 내부망 전용 제한 |
| 비밀번호 정책 | Keycloak 정책 설정 (bcrypt, 90일 주기 변경 권고) |

### 7.4 배치 파이프라인

#### 현재 실행 방식 (AS-IS)

| 배치 | 현재 방식 | 주기 |
|------|----------|------|
| DART 공시 수집 (dart-for-auditor) | 수동 npm 스크립트 실행 | 비정기 |
| 규제 업데이트 수집 (quality-updates-crawler) | 수동 Python 실행 | 분기별 |
| 감사보고일 추출 (disclosureAnalysis) | 수동 Python 실행 | 연 1회 |

#### 목표 실행 방식 (TO-BE)

```
[Docker Compose - batch 서비스]
    │
    ├── dart-collector        (cron: 매일 08:00, 18:00)
    │     └── DART 신규 공시 수집
    │
    ├── regulation-crawler    (cron: 분기별 1일 01:00)
    │     └── FSS·FSC·KICPA·KASB 수집 → Markdown 생성 → quality-updates 빌드
    │
    └── disclosure-analysis   (cron: 매월 1일 02:00)
          └── 감사보고일 추출 → 결과 파일 저장
```

| 항목 | 결정 사항 |
|------|----------|
| 스케줄러 | Docker Compose + cron |
| 실패 알림 | 배치 실패 시 이메일 발송 |
| 로그 보존 | OpenTelemetry → Loki 30일 보존 |
| 재시도 정책 | 최대 3회 재시도, 이후 관리자 수동 처리 |

### 7.5 기술 스택

| 계층 | 기술 | 비고 |
|------|------|------|
| **프론트엔드** | Next.js 15 (App Router, RSC) | 통합 UI 셸, EJS 점진 대체 |
| **인증** | Keycloak 24 + next-auth v5 | OIDC/OAuth2, RBAC, 세션 관리 |
| **API Gateway** | Traefik v3 | 자동 TLS, 라우팅, Rate Limiting |
| **백엔드 (JS)** | Node.js 20 / Express 5 | 기존 유지, API 서버 전용 전환 |
| **백엔드 (Python)** | Python 3.12 / Flask 3 | 기존 유지 |
| **DB (문서)** | MongoDB 7 (Mongoose) | 기존 유지 |
| **DB (관계형)** | PostgreSQL 17 | local-inquiry-site + Keycloak |
| **관찰가능성** | OpenTelemetry + Grafana Stack (Loki / Tempo / Prometheus) | 로그·트레이스·메트릭 통합 |
| **컨테이너** | Docker Compose v2 | 단일 서버 운영 |
| **CI/CD** | GitHub Actions | 빌드·테스트·배포 자동화 |
| **데이터 수집** | Axios, BeautifulSoup, Cheerio | 기존 유지 |
| **문서 사이트** | MkDocs Material | policy, quality-updates |

### 7.6 마이그레이션 경로

기존 서비스 중단 없이 단계별로 전환.

```
Phase 1 — 인프라 기반 구축 (단기)
  ├── Docker Compose 전체 서비스 통합
  ├── Traefik 도입 (Nginx 대체, TLS 자동화)
  ├── Keycloak SSO 구성 및 각 서비스 JWT 미들웨어 추가
  └── OpenTelemetry Collector + Grafana Stack 구축

Phase 2 — 프론트엔드 셸 전환 (중기)
  ├── Next.js 통합 UI 셸 신규 구축
  ├── Express/Flask → API 전용 분리 (EJS 점진적 제거)
  ├── GitHub Actions CI/CD 파이프라인 완성
  └── PostgreSQL 마이그레이션 (local-inquiry-site)

Phase 3 — 고도화 (장기)
  ├── 각 서비스 UI를 Next.js 페이지로 순차 이전 완료
  └── disclosureAnalysis 결과 대시보드 연계
```

---

## 8. 데이터 흐름

### 8.1 공시 수집 → 분석 → 포털 연계

```
DART
        │
        ▼ (dart-for-auditor)
   [공시 메타데이터 DB (MongoDB)]
        │
        ├─── dart-for-auditor API → 감사보고서 뷰어 (/dart)
        │
        ▼ (contractParsing)
   [계약 정보 (txt)]
        │
        ▼ (disclosureAnalysis)
   [감사보고일 추출 결과 (txt/CSV)]

FSS / FSC / KICPA / KASB
        │
        ▼ (quality-updates-crawler)
   [규제 업데이트 Markdown]
        │
        ▼ (MkDocs 빌드)
   [quality-updates 정적 사이트 (/updates)]
```

### 8.2 업무 흐름 → 품질 평가 연계

```
[계약 체결]
    │ contractParsing → 계약 정보 파싱 (외부감사실시내용·계약체결보고)
    ▼
[업무 실시]
    │ timesheet → 시간 기록
    ▼
[감사 완료]
    │ dart-for-auditor → 공시 확인
    ▼
[품질 평가]
    │ qualityEval → 리스크·통제 평가
    ▼
[내규 참조]
    └ qualityPortal, policy → 정책·절차 문서
```

---

## 9. 기대효과

### 9.1 정량적 기대효과

| 지표 | 현재 | 목표 | 측정 시점 |
|------|------|------|----------|
| 업무 접속 포인트 | 6개 이상 별도 URL | 1개 통합 포털 | Phase 1 완료 |
| 로그인 횟수 | 시스템별 별도 인증 | SSO 1회 로그인 | Phase 1 완료 |
| 시스템 전환 시간 | 평균 3분 이상 (로그인 포함) | 30초 이내 (SSO) | Phase 1 완료 후 30% 감소 목표 |
| 공시 알림 지연 시간 | 수동 확인 (수 시간~1일) | 신규 공시 발생 후 5분 이내 | Phase 2 완료 |
| 데이터 중복 입력률 | 고객 정보 복수 시스템 입력 | 단일 원천 0% 중복 | Phase 2 완료 |
| 배치 실행 성공률 | 수동 실행 (추적 불가) | 자동 배치 성공률 95% 이상 | Phase 2 완료 |

### 9.2 정성적 기대효과

- **실무 효율 향상**: 감사 업무 전 주기를 단일 플랫폼에서 처리, 시스템 전환 비용 감소
- **감사 품질 제고**: 규제 업데이트 자동 수집으로 최신 규제 환경을 품질 평가에 반영
- **데이터 일관성 확보**: 고객 정보 단일화로 오류·불일치 감소
- **규제 대응 강화**: 외부감사 실시내용·계약 정보 자동화로 감리 대응 역량 강화

---

## 10. 추진 로드맵

### Phase 1: 기반 통합 (단기 ~6개월)

| 과제 | 내용 | 우선순위 |
|------|------|---------|
| 1-1 통합 게이트웨이 구성 | Traefik v3 도입 + 공통 도메인 설정, TLS 자동화, Rate Limiting | **높음** |
| 1-2 SSO 인증 통합 | Keycloak 24 OIDC 구성, 각 서비스 JWT 미들웨어 추가, Traefik ForwardAuth 연동 | **높음** |
| 1-3 Docker Compose 환경 구성 | 전체 서비스 컨테이너화, 단일 실행 환경 | **높음** |
| 1-4 공통 UI/헤더 적용 | 통합 네비게이션·헤더 컴포넌트 각 서비스 적용 (SSO 이전 선행 적용으로 UX 개선 조기 체감) | **높음** |
| 1-5 MkDocs 자동 빌드 구성 | policy 문서 변경 시 자동 빌드 → /policy 경로 갱신 (CI 스크립트 또는 Docker volume) | 중간 |
| 1-6 공통 로그 수집 | Winston/Pino 로그 중앙화 | 중간 |

### Phase 2: 기능 고도화 (중기 ~12개월)

| 과제 | 내용 | 우선순위 |
|------|------|---------|
| 2-1 DART 실시간 모니터링 | 신규 공시 알림 자동화 (카카오/이메일), cron 배치 전환 | **높음** |
| 2-2 규제 업데이트 자동화 | quality-updates-crawler 정기 실행 → quality-updates 자동 빌드·배포 연동 | **높음** |
| 2-3 계약 정보 자동 연동 | contractParsing 결과 → 포털 DB 자동 저장 | **높음** |
| 2-4 고객 정보 DB 통합 | local-inquiry-site SQLite → PostgreSQL 마이그레이션, timesheet 고객 단일화 | 중간 |
| 2-5 내규 검색 통합 | policy 문서 검색 기능 품질포털 내 통합 | 낮음 |

### Phase 3: 분석 고도화 (장기 ~18개월)

| 과제 | 내용 | 우선순위 |
|------|------|---------|
| 3-1 감사보고일 대시보드 구축 | disclosureAnalysis 결과 시각화 (12월 결산 분포 등) | **높음** |
| 3-2 LLM 감사보고서 분석 | 감사보고서 자동 요약·이상 탐지 (AI 적용) | 중간 |

---

## 11. 보안·컴플라이언스

### 11.1 접근 제어 (RBAC)

| 역할 | 접근 가능 모듈 | 제한 사항 |
|------|--------------|----------|
| **감사팀원** | timesheet, dart-for-auditor, contractParsing (조회) | 타 팀원 타임시트 수정 불가 |
| **감사팀장** | 감사팀원 권한 + 팀원 타임시트 전체 조회·수정 | - |
| **품질관리담당자** | qualityPortal, qualityEval, policy, quality-updates | local-inquiry-site 민감 필드 마스킹 |
| **시스템 관리자** | 전체 모듈 + 사용자 관리 + 배치 모니터링 | - |

### 11.2 감사 로그 (Audit Log)

| 항목 | 정책 |
|------|------|
| 기록 대상 | 로그인/로그아웃, 민감 데이터 조회·수정·삭제, 배치 실행 결과 |
| 보존 기간 | 최소 5년 (외부감사법 서류 보존 기준 준용) |
| 저장 방식 | MongoDB audit_logs 컬렉션 (변경 불가 append-only 설계) |
| 접근 권한 | 시스템 관리자만 조회 가능 |

### 11.3 개인정보·기밀 보호

| 항목 | 조치 |
|------|------|
| 민감 데이터 암호화 | FEIN·SSN·은행계좌·패스워드 Fernet 암호화 유지 (local-inquiry-site) |
| LAN 전용 서비스 | Traefik IP Allowlist로 local-inquiry-site 내부망 전용 제한 |
| 개인정보보호법(PIPA) | 고객 민감 정보 열람 로그 기록, 열람 목적 사전 설정 |
| 데이터 보존 정책 | 퇴직 직원 계정 즉시 비활성화, 데이터 접근 차단 |
| 비밀번호 정책 | bcrypt(salt rounds ≥ 12), 90일 주기 변경 권고 |

### 11.4 감리 대응

| 항목 | 조치 |
|------|------|
| 외부감사 실시내용 | contractParsing 자동 추출 결과를 감리 자료로 활용 가능하도록 표준 형식 저장 |
| 업무 시간 증적 | timesheet 기록을 감리 대응 보고서 형식으로 Export 기능 제공 (Phase 2) |
| 품질 평가 이력 | qualityEval 평가 항목·결과·담당자·일자를 불변 이력으로 보존 |

---

## 12. 리스크 및 대응 방안

| 리스크 | 가능성 | 영향도 | 대응 방안 |
|--------|--------|--------|----------|
| DART API 정책 변경 | 중 | 높음 | API 변경 모니터링, 대안 스크래핑 방안 병행 유지 |
| 개인정보·기밀 보호 | 높음 | 높음 | Fernet 암호화 유지, LAN 전용 서비스 정책 준수, RBAC 적용 |
| Keycloak 도입 복잡성 | 중 | 중간 | Phase 1에서 Keycloak 선행 구성, 서비스별 JWT 미들웨어 점진 교체 |
| Next.js 마이그레이션 중 서비스 중단 | 낮음 | 높음 | EJS/Next.js 병존 기간 운영, 기존 Express 포트 유지 병행 |
| SQLite → PostgreSQL 마이그레이션 오류 | 중 | 높음 | 단계적 마이그레이션, 원본 DB 백업 의무화, 검증 스크립트 사전 작성 |
| 배치 파이프라인 실패 | 중 | 중간 | 자동 재시도(최대 3회) + 실패 알림, 로그 30일 보존 |

---

## 부록. 현재 모듈-서비스 매핑표

| 현재 모듈 | 통합 서비스 영역 | Phase |
|-----------|----------------|-------|
| qualityPortal | D. 품질 관리 | Phase 1 |
| qualityEval | D. 품질 관리 | Phase 1 |
| timesheet | A. 업무 관리 | Phase 1 |
| local-inquiry-site | B. 고객·계약 관리 | Phase 1 |
| dart-for-auditor | C. 공시 모니터링 | Phase 1 |
| policy | D. 품질 관리 (문서) | Phase 1 |
| quality-updates | C. 공시 모니터링 (규제 문서 사이트) | Phase 1 |
| quality-updates-crawler | C. 공시 모니터링 (규제 수집 자동화) | Phase 2 |
| contractParsing | B. 고객·계약 관리 | Phase 2 |
| disclosureAnalysis | E. 데이터 분석 | Phase 3 |

---

*기획서 작성: audit-quality 프로젝트 기반 | 최초 작성: 2026-02-23 | 최종 수정: 2026-02-27 (v1.4)*
