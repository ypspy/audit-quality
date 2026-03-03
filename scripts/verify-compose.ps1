# Phase 1-1 검증: docker compose up 후 모든 서비스 헬스체크 통과 확인
# 사용: .\scripts\verify-compose.ps1 (PowerShell, 프로젝트 루트에서 실행)
# 요구: Docker Desktop 실행 중

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "=== 1. docker compose 설정 검사 ===" -ForegroundColor Cyan
docker compose config --quiet
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "OK" -ForegroundColor Green

Write-Host "`n=== 2. 이미지 빌드 및 서비스 기동 ===" -ForegroundColor Cyan
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n=== 3. 헬스체크 대기 (최대 120초) ===" -ForegroundColor Cyan
$max = 24
for ($i = 1; $i -le $max; $i++) {
    Start-Sleep -Seconds 5
    $ps = docker compose ps -a 2>$null
    if ($ps -match "healthy|Up") {
        $running = (docker compose ps -q 2>$null | Measure-Object -Line).Lines
        if ($running -ge 6) {
            Write-Host "모든 컨테이너 기동됨." -ForegroundColor Green
            break
        }
    }
    Write-Host "  대기 중... $($i*5)초"
}

Write-Host "`n=== 4. 서비스 상태 ===" -ForegroundColor Cyan
docker compose ps

Write-Host "`n=== 5. 헬스체크 요약 ===" -ForegroundColor Cyan
docker compose ps -a

Write-Host "`n검증 완료. 문제가 있으면: docker compose logs -f" -ForegroundColor Green
