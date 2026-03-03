# 정책과 절차 (Policy)

선진회계법인의 품질관리 관련 **내규** 및 **품질관리절차** 문서를 관리하는 저장소입니다.

## 개요

- **내규**: 품질관리규정, 품질관리규정(부록), 업무수임과 유지에 관한 Policy 등
- **품질관리절차**: 계약·업무품질관리검토·발행·업무수행 등 절차 문서

문서는 MkDocs로 빌드하여 **정책과 절차** 사이트로 제공됩니다.

## 프로젝트 구조

```
policy/
├── my-project/           # MkDocs 문서 사이트
│   ├── docs/
│   │   ├── index.md      # 메인 페이지
│   │   ├── policy/       # 내규 (90, 91, 93 등)
│   │   └── qcProcedures/ # 품질관리절차
│   ├── mkdocs.yml        # MkDocs 설정
│   └── overrides/        # Material 테마 오버라이드
├── package.json          # Node.js 의존성 (express, mongoose 등)
└── README.md
```

## 문서 사이트 실행 (MkDocs)

문서를 로컬에서 미리보기하려면 MkDocs와 Material 테마가 필요합니다.

```bash
# Python 가상환경 권장
pip install mkdocs mkdocs-material

# 문서 사이트 실행 (my-project 기준)
cd my-project
mkdocs serve
```

브라우저에서 `http://127.0.0.1:8000` 으로 접속합니다.

### 정적 사이트 빌드

```bash
cd my-project
mkdocs build
```

생성된 사이트는 `my-project/site/` 에 있습니다.

## 기술 스택

| 구분 | 내용 |
|------|------|
| 문서 | MkDocs, Material theme |
| 백엔드 | Node.js, Express, Mongoose |

## 관련 링크

- 관련 서식: [Quality Portal - Forms and Templates](https://example.com/portal/forms)

## 라이선스

ISC
