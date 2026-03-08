-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- regulations 스키마
CREATE SCHEMA IF NOT EXISTS regulations;

-- 문서 청크 테이블
CREATE TABLE IF NOT EXISTS regulations.chunks (
  id          BIGSERIAL PRIMARY KEY,
  slug        TEXT NOT NULL,
  heading     TEXT,
  content     TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  -- voyage-3: 1024 dims / text-embedding-3-small: 1536 dims
  embedding   vector(1024),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 유사도 검색용 인덱스 (IVFFlat, 문서 수 적어 정확도 우선)
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON regulations.chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- slug 조회용 인덱스
CREATE INDEX IF NOT EXISTS chunks_slug_idx ON regulations.chunks (slug);
