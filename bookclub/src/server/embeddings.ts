import { env } from "~/env";
import type { PrismaClient } from "@prisma/client";

// Dimension used for the pgvector column / OpenAI text-embedding-3-small
const DEFAULT_DIM = 1536;
export const EMBEDDING_DIM = (() => {
  const v = (process as any)?.env?.EMBEDDING_DIM ?? (env as any)?.EMBEDDING_DIM;
  const n = typeof v === "string" ? parseInt(v, 10) : undefined;
  return Number.isFinite(n) && n! > 0 ? (n as number) : DEFAULT_DIM;
})();

/**
 * Get a normalized text embedding using OpenAI embeddings API if available.
 * Falls back to a deterministic hashing-based pseudo-embedding to avoid crashes
 * in local/dev without an API key. The fallback is NOT semantically meaningful
 * but keeps flows working.
 */
export async function getTextEmbedding(text: string): Promise<number[]> {
  const input = text.trim();
  if (!input) return new Array(EMBEDDING_DIM).fill(0);

  // Prefer GROQ embeddings if configured with a model
  const groqKey = (process as any)?.env?.GROQ_API_KEY ?? (env as any)?.GROQ_API_KEY;
  const groqEmbedModel = (process as any)?.env?.GROQ_EMBEDDING_MODEL ?? (env as any)?.GROQ_EMBEDDING_MODEL;
  if (typeof groqKey === "string" && groqKey.length > 0 && typeof groqEmbedModel === "string" && groqEmbedModel.length > 0) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({ model: groqEmbedModel, input }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
      const emb = data?.data?.[0]?.embedding;
      if (Array.isArray(emb) && emb.length > 0) return emb;
    } catch (err) {
      console.warn("Groq embedding failed; falling back:", err);
    }
  }

  // Fallback to OpenAI embeddings if configured
  const openaiKey = (process as any)?.env?.OPENAI_API_KEY ?? (env as any)?.OPENAI_API_KEY;
  if (typeof openaiKey === "string" && openaiKey.length > 0) {
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input,
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = (await res.json()) as {
        data: Array<{ embedding: number[] }>;
      };
      const emb = data?.data?.[0]?.embedding;
      if (Array.isArray(emb) && emb.length > 0) return emb;
    } catch (err) {
      // Fall through to pseudo embedding
      console.warn("OpenAI embedding failed; using fallback:", err);
    }
  }

  // Fallback: deterministic pseudo-embedding (not semantic!)
  const out = new Array(EMBEDDING_DIM).fill(0);
  let h1 = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 += (h1 << 1) + (h1 << 4) + (h1 << 7) + (h1 << 8) + (h1 << 24);
  }
  // Spread hash into vector
  let seed = Math.abs(h1 >>> 0);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out[i] = ((seed % 1000) - 500) / 500; // [-1, 1]
  }
  return out;
}

/** Serialize a vector to pgvector literal string, e.g. '[0.1, -0.2, ...]' */
export function toPgvectorLiteral(vec: number[]): string {
  // Ensure only numbers and commas included
  return `[${vec.map((v) => (Number.isFinite(v) ? v : 0)).join(",")} ]`.replace(" ]", "]");
}

/** Ensure a Book has an embedding; compute from description or title+authors. */
export async function ensureBookEmbedding(db: PrismaClient, bookId: string) {
  const book = await db.book.findUnique({ where: { id: bookId } });
  if (!book) return;
  // If already embedded (non-null), skip
  // Prisma Unsupported("vector") cannot be selected easily; rely on raw check
  const row = (await db.$queryRawUnsafe<any[]>(
    `SELECT embedding IS NOT NULL AS has FROM "Book" WHERE id = $1 LIMIT 1`,
    bookId,
  ))?.[0];
  if (row?.has === true) return;

  const basis = [book.title, book.authors, book.description ?? ""].filter(Boolean).join(". ");
  const emb = await getTextEmbedding(basis);
  const literal = toPgvectorLiteral(emb);
  await db.$executeRawUnsafe(
    `UPDATE "Book" SET embedding = ${literal}::vector WHERE id = $1`,
    bookId,
  );
}
