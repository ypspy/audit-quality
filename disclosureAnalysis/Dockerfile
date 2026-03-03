# disclosureAnalysis — 감사보고일 추출 배치 작업
FROM python:3.11-slim

WORKDIR /app

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 복사
COPY reportDate.py .
COPY README.md .

# 입력/출력 디렉터리 (호스트 볼륨과 매핑)
VOLUME ["/data", "/outputs"]

# 기본 명령: 환경변수로 지정된 경로를 사용해 감사보고일 추출 실행
CMD ["python", "-u", "reportDate.py"]

