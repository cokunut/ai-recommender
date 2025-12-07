import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env";
import type { PrismaClient } from "@prisma/client";
import { EMBEDDING_DIM, getTextEmbedding, toPgvectorLiteral } from "~/server/embeddings";

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Minimal CSV parser for Goodreads export (handles quotes and commas)
function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]!).map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]!);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = cols[idx] ?? ""));
    rows.push(row);
  }
  return rows;
}

async function getGroupReadTitleAuthorKeys(db: PrismaClient, groupId: string): Promise<Set<string>> {
  const members = await db.groupMember.findMany({
    where: { groupId },
    include: {
      user: {
        select: { goodreadsImports: { orderBy: { createdAt: "desc" }, select: { jsonData: true } } },
      },
    },
  });
  const keys = new Set<string>();
  for (const m of members) {
    const csvText = (m.user.goodreadsImports[0]?.jsonData as any)?.csvText as string | undefined;
    if (!csvText) continue;
    const rows = parseCsv(csvText);
    for (const r of rows) {
      const shelf = r["Exclusive Shelf"] ?? r["exclusive_shelf"] ?? r["shelf"] ?? "";
      if (normalize(shelf) !== "read") continue;
      const title = r["Title"] ?? r["title"] ?? "";
      const author = r["Author"] ?? r["author"] ?? r["Primary Author"] ?? "";
      if (!title || !author) continue;
      keys.add(`${normalize(title)}::${normalize(author)}`);
    }
  }
  return keys;
}

async function collectGroupPreferenceText(db: PrismaClient, groupId: string): Promise<string> {
  const group = await db.group.findUnique({ where: { id: groupId } });
  const members = await db.groupMember.findMany({
    where: { groupId },
    include: { user: { select: { readingTasteTags: true, name: true } } },
  });
  const likes: string[] = [];
  const dislikes: string[] = [];
  for (const m of members) {
    for (const tag of m.user.readingTasteTags) {
      if (tag.preference === "LIKE") likes.push(tag.label);
      else dislikes.push(tag.label);
    }
  }
  const pref = `Group: ${group?.name ?? "book club"}. ${group?.description ?? ""}\nLikes: ${likes.join(", ")}\nAvoid: ${dislikes.join(", ")}`;
  return pref.trim();
}

export const recommendationsRouter = createTRPCRouter({
  forGroup: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        topK: z.number().int().min(5).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      // 1) Build preference text and embed
      const prefText = await collectGroupPreferenceText(ctx.db, input.groupId);
      const queryEmb = await getTextEmbedding(prefText);
      const literal = toPgvectorLiteral(queryEmb);

      // 2) Filter out books read by any member (Goodreads)
      const readKeys = await getGroupReadTitleAuthorKeys(ctx.db, input.groupId);

      // 3) Vector search over Book table
      let candidates: Array<{ id: string; title: string; authors: string; coverimageurl: string | null; description: string | null; distance: number }> = [];
      try {
        candidates = await ctx.db.$queryRawUnsafe(
          `SELECT id, title, authors, "coverImageUrl" as coverimageurl, description,
                  (embedding <=> ${literal}::vector) as distance
           FROM "Book"
           WHERE embedding IS NOT NULL
           ORDER BY embedding <=> ${literal}::vector
           LIMIT $1`,
          input.topK,
        );
      } catch {
        const fb = await ctx.db.$queryRawUnsafe<Array<{ id: string; title: string; authors: string; coverimageurl: string | null; description: string | null; createdat: Date }>>(
          `SELECT id, title, authors, "coverImageUrl" as coverimageurl, description, "createdAt" as createdat
           FROM "Book"
           ORDER BY "createdAt" DESC
           LIMIT $1`,
          input.topK,
        );
        candidates = fb.map((r, idx) => ({ ...r, distance: 1 + idx * 0.001 })) as any;
      }

      // 4) Remove read books
      const unseen = candidates.filter(
        (b) => !readKeys.has(`${normalize(b.title)}::${normalize(b.authors)}`),
      );

      // 5) Score by overlap with members’ preferences
      const members = await ctx.db.groupMember.findMany({
        where: { groupId: input.groupId },
        include: { user: { select: { readingTasteTags: true } } },
      });
      const likeTerms = new Set<string>();
      const dislikeTerms = new Set<string>();
      for (const m of members) {
        for (const t of m.user.readingTasteTags) {
          if (t.preference === "LIKE") likeTerms.add(normalize(t.label));
          else dislikeTerms.add(normalize(t.label));
        }
      }
      const scored = unseen.map((b) => {
        const hay = normalize(`${b.title} ${b.authors} ${b.description ?? ""}`);
        let likeScore = 0;
        likeTerms.forEach((t) => {
          if (t && hay.includes(t)) likeScore += 1;
        });
        let dislikeScore = 0;
        dislikeTerms.forEach((t) => {
          if (t && hay.includes(t)) dislikeScore += 1;
        });
        const prefScore = likeScore - 0.5 * dislikeScore;
        // Combine vector distance (lower is better) with prefScore (higher is better)
        const composite = -b.distance + 0.1 * prefScore;
        return { ...b, prefScore, composite };
      });
      scored.sort((a, b) => b.composite - a.composite);

      // 6) Pass top results to LLM to pick best 5
      const top = scored.slice(0, 15);
      let finalFive = top.slice(0, 5).map((b) => ({ id: b.id, title: b.title, authors: b.authors }));

      if (env.GROQ_API_KEY && top.length > 0) {
        const prompt = `You are helping a book club choose 5 books to surface to members. Choose a diverse, discussion-worthy set that aligns with group likes and avoids dislikes. Return ONLY a JSON array of 5 objects with id, title, author.

Group preference text:
${prefText}

Candidates (with vector relevance and preference score):
${JSON.stringify(top.map((c) => ({ id: c.id, title: c.title, author: c.authors, distance: c.distance, prefScore: c.prefScore })), null, 2)}
`;
        try {
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [
                { role: "system", content: "Return only JSON arrays, no extra text." },
                { role: "user", content: prompt },
              ],
              temperature: 0.3,
              max_tokens: 800,
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as any;
            const content: string | undefined = data.choices?.[0]?.message?.content;
            if (content) {
              try {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  finalFive = parsed.slice(0, 5).map((x: any) => ({
                    id: x.id ?? x.bookId ?? "",
                    title: x.title,
                    authors: x.author ?? x.authors,
                  }));
                }
              } catch {
                const m = content.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
                if (m) {
                  const arr = JSON.parse(m[1]!);
                  finalFive = arr.slice(0, 5).map((x: any) => ({ id: x.id ?? x.bookId ?? "", title: x.title, authors: x.author ?? x.authors }));
                }
              }
            }
          }
        } catch (err) {
          console.warn("Groq selection step failed; using top-5 fallback", err);
        }
      }

      // Hydrate full book records for finalFive
      const ids = finalFive.map((f) => f.id).filter(Boolean);
      const books = ids.length
        ? await ctx.db.book.findMany({ where: { id: { in: ids } } })
        : [];

      // In case LLM changed order, keep as returned
      const map = new Map(books.map((b) => [b.id, b]));
      const ordered = finalFive
        .map((f) => map.get(f.id))
        .filter(Boolean);

      return { items: ordered };
    }),
});
