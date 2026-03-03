#!/usr/bin/env bash
# Phase 1-1 검증: docker compose up 후 모든 서비스 헬스체크 통과 확인
# 사용: ./scripts/verify-compose.sh (또는 bash scripts/verify-compose.sh)
# 요구: Docker Desktop 실행 중, 프로젝트 루트에서 실행

set -e
cd "$(dirname "$0")/.."

echo "=== 1. docker compose 설정 검사 ==="
docker compose config --quiet && echo "OK"

echo ""
echo "=== 2. 이미지 빌드 및 서비스 기동 ==="
docker compose up -d --build

echo ""
echo "=== 3. 헬스체크 대기 (최대 120초) ==="
for i in $(seq 1 24); do
  sleep 5
  unhealthy=$(docker compose ps --format json 2>/dev/null | grep -c '"Health":"unhealthy"' || true)
  if [ "${unhealthy:-0}" -eq 0 ]; then
    running=$(docker compose ps -q 2>/dev/null | wc -l)
    if [ "${running:-0}" -ge 6 ]; then
      echo "모든 컨테이너 기동됨."
      break
    fi
  fi
  echo "  대기 중... ${i}0초"
done

echo ""
echo "=== 4. 서비스 상태 ==="
docker compose ps

echo ""
echo "=== 5. 헬스체크 요약 ==="
docker compose ps -a --format "table {{.Name}}\t{{.Status}}" | head -20

echo ""
echo "검증 완료. 문제가 있으면: docker compose logs -f"
