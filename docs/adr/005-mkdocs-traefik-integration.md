# ADR-005: MkDocs 정적 사이트를 Traefik /policy, /updates로 서빙

**날짜:** 2026-03-02
**상태:** 결정됨

---

## Context

- **policy**: 정책·절차 문서 (MkDocs, `policy/my-project`)
- **quality-updates**: 규제 업데이트 문서 (MkDocs, `quality-updates`)
- Phase 3-1에서 위 두 사이트를 Next.js와 동일 도메인 아래 `/policy`, `/updates` 경로로 제공해야 함.

---

## Decision

1. **Traefik 라우팅**
   - `/policy` → `policy-docs` 컨테이너 (stripPrefix `/policy` 후 nginx가 루트에서 서빙)
   - `/updates` → `updates-docs` 컨테이너 (stripPrefix `/updates` 후 동일)
   - 루트 라우터(`r-web-root`)에서 `/policy`, `/updates` 제외하여 문서 전용 라우터가 처리하도록 함.

2. **빌드·서빙**
   - 각 문서 프로젝트별 Dockerfile: Python으로 MkDocs 빌드 → nginx Alpine에서 정적 파일 서빙.
   - 서브경로에서 asset 경로가 맞도록 policy는 `site_url: http://localhost/policy/`, quality-updates는 빌드 시 `site_url: http://localhost/updates/`로 설정.

3. **파이프라인**
   - CI: PR 시 `policy-docs`, `updates-docs` 이미지 Docker 빌드로 MkDocs 빌드 검증.
   - Deploy: main push 시 두 이미지 빌드·푸시, `docker-compose.prod.yml`에서 GHCR 이미지로 배포.

4. **선택 사항 (완료)**
   - Next.js MDX 기반 문서로 점진적 이전 완료: `/policy`, `/updates`는 이제 Next.js 앱에서 `next-mdx-remote`로 마크다운을 렌더링하며, 콘텐츠는 `policy/my-project/docs`, `quality-updates/docs`를 빌드 시 `apps/web/src/content`에 복사하여 사용. Traefik은 해당 경로를 별도 컨테이너가 아닌 web(Next.js) 서비스로 라우팅.

---

## Consequences

- 문서는 인증 없이 공개 접근 가능 (필요 시 ForwardAuth 미들웨어 추가 가능).
- quality-updates는 Render 등 별도 호스팅과 동시에 audit-quality 내 `/updates`에서도 제공 가능.
- 문서 소스 변경 시 이미지 재빌드로 반영되며, regulation-crawler가 채우는 `quality-updates/docs/quality-updates` 내용도 빌드에 포함됨.
