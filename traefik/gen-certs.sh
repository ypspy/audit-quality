#!/usr/bin/env bash
# 로컬용 자체 서명 인증서 생성 (Phase 1-2)
# 실행: ./traefik/gen-certs.sh  또는  bash traefik/gen-certs.sh

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="${DIR}/certs"
mkdir -p "$CERTS_DIR"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "${CERTS_DIR}/key.pem" \
  -out "${CERTS_DIR}/cert.pem" \
  -subj "/CN=localhost/O=Audit Quality Local"

echo "Created ${CERTS_DIR}/cert.pem and ${CERTS_DIR}/key.pem"
