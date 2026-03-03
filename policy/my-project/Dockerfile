# Phase 3-1: 정책 문서 MkDocs 빌드 → nginx 정적 서빙 (/policy)
FROM python:3.11-slim AS builder
WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdocs build --strict

FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/* && mkdir -p /usr/share/nginx/html
COPY --from=builder /build/site /usr/share/nginx/html
# Traefik stripPrefix /policy 후 요청이 / 로 오므로 루트에서 서빙
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
