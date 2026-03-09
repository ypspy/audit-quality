import os

# 테스트 환경에서 ANTHROPIC_API_KEY 미설정 시 collection 실패 방지
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-placeholder")
