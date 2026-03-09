import os

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
GOTENBERG_URL = os.getenv("GOTENBERG_URL", "http://gotenberg:3000")
QUALITY_UPDATES_PATH = os.getenv("QUALITY_UPDATES_PATH", "/workspace/quality-updates")
