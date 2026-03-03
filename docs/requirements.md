# [기획서] 회계감사 Lifecycle 지원 및 데이터 통합 프로젝트

## 1. 개요

본 프로젝트는 일반적인 감사업무 관리 프로그램이 제공하지 않는 외부 공시 데이터, 규제 정보, 내부 정책 등을 통합하여, 감사 Engagement Team과 품질관리(Quality Control) 부서에 고도화된 정보 조회 및 지식 업데이트 서비스를 제공하는 것을 목적으로 합니다.

## 2. 회계감사 Engagement Lifecycle

프로젝트의 각 기능은 아래 8단계의 감사 프로세스 중 적합한 단계에 정보를 지원합니다.

1. **수임 및 유지 결정**: 고객 리스크 평가 및 독립성 확인
2. **계약 체결**: 감사계약서 확정
3. **전략 및 계획 수립**: 중요성 결정, 위험 평가, 팀 구성
4. **사업 이해 및 통제 평가**: 비즈니스 분석 및 내부통제 테스트(TOC)
5. **입증감사 실시**: 실사, 조회, 상세 실증 테스트
6. **결론 도출 및 심리**: 미수정 오류 집계 및 품질관리 검토
7. **보고서 발행**: 감사 의견 표명 및 보고서 전달
8. **문서 보관**: 감사조서 최종 보관(Archiving)

## 3. 상세 기능 정의 (Project Inventory)

### 3.1 외부 정보 연계 서비스

외부 기관의 데이터를 자동 수집하여 규제 환경 변화 및 공시 현황을 파악합니다.

| 프로젝트명 | 주요 기능 | 정보 원천 (Source) | 수집 방법 |
|-----------|----------|-------------------|----------|
| quality-updates-crawler | FSS·FSC·KICPA·KASB 규제 업데이트 수집 → Markdown 자동 생성 | 외부 (FSS, FSC, KICPA, KASB) | 크롤링 (Python, BeautifulSoup) |
| quality-updates | 제도 및 규제 환경 업데이트 정적 문서 사이트 제공 | quality-updates-crawler 출력 | MkDocs 빌드 (Render 배포, GitHub Actions CI) |
| dart-for-auditor | 외부감사 관련 공시 메타데이터 인덱싱 및 조회 | 외부 (DART) | DART API·크롤링 (메타데이터만, 원문 재배포 금지) |

### 3.2 데이터 분석 및 파싱 (Data Analysis)

수집된 비정형/정형 데이터를 분석하여 업무에 필요한 핵심 지표를 추출합니다.

| 프로젝트명 | 주요 기능 | 정보 원천 (Source) | 수집 방법 |
|-----------|----------|-------------------|----------|
| disclosureAnalysis | 감사보고서 HTML에서 감사보고일 추출 및 분석 (연구용) | 외부 (DART) | Python 배치 스크립트 (BeautifulSoup, 12월 결산 필터) |
| contractParsing | 감사계약체결보고 및 외부감사실시내용 정보 파싱 | 외부 (DART) HTML | Python 배치 스크립트 (DSD→HTML 변환, BeautifulSoup) |

### 3.3 내부 업무 지원 및 인프라

업무팀의 실무 데이터를 수집하고 내부 정책을 관리합니다.

| 프로젝트명 | 주요 기능 | 정보 원천 (Source) | 수집 방법 |
|-----------|----------|-------------------|----------|
| qualityPortal | 전사 품질관리 포탈 서비스 제공 (/policy, /forms, /vsc, /qc) | 내부 시스템 | 시스템 연동 (Node.js/Express + MongoDB) |
| policy | 품질관리 내규·절차 문서 관리 및 공유 | 내부 의사결정 기관 | 정책 문서 입력 (MkDocs Material) |
| local-inquiry-site | 고객사 등록 및 정보 조회 서비스 (LAN 전용) | 업무팀 Client 정보 | 사용자 입력 (Flask + SQLite, Fernet 암호화) |
| timesheet | 감사인별 업무 투입 시간 관리 | 업무팀 인력 | 사용자 입력 (Node.js/Express + MongoDB) |
| qualityEval | 리스크·통제 항목 평가 및 문서화 지원 | 감사/검토 업무 데이터 | 사용자 입력 (Node.js/Express + MongoDB) |

## 4. 비고 및 참고사항

- 모든 개별 공시정보는 크롤링된 주소 정보를 통해 접근 가능하도록 설계되어야 합니다.
- `dart-for-auditor`는 **메타데이터 인덱싱 전용** 서비스로, 공시 원문 파싱·수정·재배포는 금지됩니다.
- `quality-updates`는 `quality-updates-crawler`가 생성한 Markdown 파일을 MkDocs로 빌드하여 정적 사이트로 제공합니다.
- 기존의 일반적인 입고/계약 관리 프로그램과의 차별성을 위해 **실시간성(Crawling)** 과 **분석성(Parsing)** 에 초점을 맞춥니다.
