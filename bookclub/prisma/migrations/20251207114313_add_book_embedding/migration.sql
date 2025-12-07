-- Enable pgvector extension (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to Book with 1536 dimensions (OpenAI text-embedding-3-small)
ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Create IVFFlat index for cosine distance on Book.embedding
-- Note: requires ANALYZE before index is used efficiently and a non-empty table.
CREATE INDEX IF NOT EXISTS "Book_embedding_ivfflat_cos_idx"
  ON "Book" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
