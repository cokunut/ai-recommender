## Bookclub

### Recommendation Engine v2 (pgvector + LLM)

We now compute recommendations from the existing `Book` table using a vector index and a final LLM ranking step:

- Vector store: PostgreSQL `pgvector` (via a new `Book.embedding` column).
- Embeddings: OpenAI `text-embedding-3-small` (1536 dims). If no key is set, a safe deterministic fallback is used so local flows still work (not semantically meaningful).
- Algorithm:
  - Build a group preference query from the club description and member ReadingTaste tags.
  - Vector search over `Book.embedding` for nearest candidates.
  - Filter out any books already read by members (based on imported Goodreads CSVs).
  - Re-score by overlap with member preferences (simple tag text overlap) to diversify results.
  - Pass the top candidates to the LLM to choose the final 5 to show to the club.

#### Why pgvector?

`pgvector` is a well-supported extension for storing and searching embeddings directly in Postgres. It lets us keep everything in one database, query with `<=>` cosine distance, and add an IVFFlat index for speed. Prisma doesn’t yet have a native vector type, so we use `Unsupported("vector")` for the schema and raw SQL for search.

#### Schema/Migration

- Added `embedding Unsupported("vector")?` to `Book` in `prisma/schema.prisma`.
- New migration enables the extension, adds the column, and creates an IVFFlat index:
  - `prisma/migrations/*_add_book_embedding/migration.sql`:
    - `CREATE EXTENSION IF NOT EXISTS vector;`
    - `ALTER TABLE "Book" ADD COLUMN "embedding" vector(1536);`
    - `CREATE INDEX ... USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);`

Run migrations as normal with Prisma (ensure your Postgres user can enable extensions):

```
npx prisma migrate deploy
```

#### Environment

Add to `.env` (optional if you only want the deterministic fallback):

```
OPENAI_API_KEY=sk-...           # for embeddings (default)
GROQ_API_KEY=...                # used elsewhere; optional LLM selection step

# To use Groq for embeddings instead of OpenAI (ensure dimension matches DB):
# GROQ_EMBEDDING_MODEL=nomic-embed-text-v1
# EMBEDDING_DIM=768
```

`src/env.js` now recognizes `OPENAI_API_KEY`, optional `GROQ_EMBEDDING_MODEL`, and optional `EMBEDDING_DIM`.

If you switch the embedding model/provider, ensure the DB column dimension matches.
This repo currently migrates `Book.embedding` as `vector(1536)` (OpenAI default). If you set
`EMBEDDING_DIM` to something else (e.g., 768), you must adjust the migration/column to match,
rebuild the IVFFlat index, and backfill embeddings.

#### API Surface

- `GET tRPC recommendations.forGroup` — Input: `{ groupId: string, topK?: number }`, Output: `{ items: Book[] }`
  - Uses the algorithm above to return up to 5 books from the `Book` table.

In-app flows using this algorithm:
- `clubs.generateRecs` — creates a 24h ACTIVE poll with 5 choices from Book table.
- `readingRounds.createRoundWithRecommendations` — creates a DRAFT poll with 5 choices during round setup.

#### Embeddings Assumption

- We assume `Book.embedding` values already exist (populated by a separate process). The current flows do not create embeddings for user-added one-offs during round setup.

#### Notes

- Goodreads imports are stored as CSV text. We parse that CSV to detect titles on the `read` shelf and exclude them from recommendations.
- If `OPENAI_API_KEY` is not set, a deterministic pseudo-embedding is used to keep local/dev flows functional. For production-quality results, set the key to enable real embeddings.
- The final 5 selection step uses Groq (OpenAI-compatible chat endpoint) when `GROQ_API_KEY` is present; otherwise we fall back to the top 5 by score.
