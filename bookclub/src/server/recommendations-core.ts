import type { PrismaClient, Book } from "@prisma/client";
import { EMBEDDING_DIM, getTextEmbedding, toPgvectorLiteral } from "~/server/embeddings";
import { env } from "~/env";

export function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Lightweight CSV parser for Goodreads export
export function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter(Boolean);
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

export async function getGroupReadTitleAuthorKeys(db: PrismaClient, groupId: string): Promise<Set<string>> {
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

export async function collectGroupPreferenceText(db: PrismaClient, groupId: string): Promise<string> {
  const group = await db.group.findUnique({ where: { id: groupId } });
  // Try to fetch reading taste tags; fall back gracefully if column not present
  let members: Array<{ user: { name: string | null; readingTasteTags?: Array<{ label: string; preference?: any }> } }> = [];
  try {
    members = await db.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { readingTasteTags: true, name: true } } },
    });
  } catch {
    // Fallback without tags
    const fallback = await db.groupMember.findMany({ where: { groupId }, include: { user: { select: { name: true } } } });
    members = fallback.map((m) => ({ user: { name: m.user.name, readingTasteTags: [] } }));
  }
  const likes: string[] = [];
  const dislikes: string[] = [];
  for (const m of members) {
    for (const tag of m.user.readingTasteTags ?? []) {
      const p = (tag as any).preference;
      const pref = typeof p === "string" ? p.toUpperCase() : "LIKE";
      if (pref === "DISLIKE") dislikes.push(tag.label);
      else likes.push(tag.label);
    }
  }
  const pref = `Likes: ${likes.join(", ")}\nAvoid: ${dislikes.join(", ")}`;
  return `${group?.description ?? ""}\n${pref}`.trim();
}

export async function vectorSearchCandidates(db: PrismaClient, groupId: string, topK: number) {
  const prefText = await collectGroupPreferenceText(db, groupId);
  const qEmb = await getTextEmbedding(prefText);
  const literal = toPgvectorLiteral(qEmb);

  try {
    const rows = await db.$queryRawUnsafe<Array<{
      id: string;
      title: string;
      authors: string;
      coverimageurl: string | null;
      description: string | null;
      distance: number;
    }>>(
      `SELECT id, title, authors, "coverImageUrl" as coverimageurl, description,
              (embedding <=> ${literal}::vector) as distance
       FROM "Book"
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> ${literal}::vector
       LIMIT $1`,
      topK,
    );
    return { prefText, rows };
  } catch {
    // Fallback when pgvector or column missing: return recent books with synthetic distance
    const fallback = await db.$queryRawUnsafe<Array<{
      id: string;
      title: string;
      authors: string;
      coverimageurl: string | null;
      description: string | null;
      createdat: Date;
    }>>(
      `SELECT id, title, authors, "coverImageUrl" as coverimageurl, description, "createdAt" as createdat
       FROM "Book"
       ORDER BY "createdAt" DESC
       LIMIT $1`,
      topK,
    );
    const rows = fallback.map((r, idx) => ({ ...r, distance: 1 + idx * 0.001 })) as any;
    return { prefText, rows };
  }
}

export async function rankAndSelectFive(db: PrismaClient, groupId: string) {
  const readKeys = await getGroupReadTitleAuthorKeys(db, groupId);
  const { prefText, rows } = await vectorSearchCandidates(db, groupId, 30);

  let members: Array<{ user: { readingTasteTags?: Array<{ label: string; preference?: any }> } }> = [];
  try {
    members = await db.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { readingTasteTags: true } } },
    });
  } catch {
    // Fallback without tags if column missing; select minimal safe fields
    const base = await db.groupMember.findMany({ where: { groupId }, include: { user: { select: { id: true } } } });
    members = base.map(() => ({ user: { readingTasteTags: [] } }));
  }
  const likeTerms = new Set<string>();
  const dislikeTerms = new Set<string>();
  for (const m of members) {
    for (const t of m.user.readingTasteTags ?? []) {
      const p = (t as any).preference;
      const pref = typeof p === "string" ? p.toUpperCase() : "LIKE";
      if (pref === "DISLIKE") dislikeTerms.add(normalize(t.label));
      else likeTerms.add(normalize(t.label));
    }
  }

  const unseen = rows.filter((b) => !readKeys.has(`${normalize(b.title)}::${normalize(b.authors)}`));
  const scored = unseen.map((b) => {
    const hay = normalize(`${b.title} ${b.authors} ${b.description ?? ""}`);
    let likeScore = 0;
    likeTerms.forEach((t) => { if (t && hay.includes(t)) likeScore += 1; });
    let dislikeScore = 0;
    dislikeTerms.forEach((t) => { if (t && hay.includes(t)) dislikeScore += 1; });
    const prefScore = likeScore - 0.5 * dislikeScore;
    const composite = -b.distance + 0.1 * prefScore;
    return { ...b, prefScore, composite };
  });
  scored.sort((a, b) => b.composite - a.composite);
  const top = scored.slice(0, 15);

  // Optional: let LLM pick final 5 for diversity
  let ids = top.slice(0, 5).map((b) => b.id);
  if (env.GROQ_API_KEY && top.length > 0) {
    const prompt = `Choose 5 diverse, discussion-worthy books aligned with likes and avoiding dislikes. Return ONLY a JSON array of 5 objects with id, title, author.\n\nGroup prefs:\n${prefText}\n\nCandidates:\n${JSON.stringify(top.map((c) => ({ id: c.id, title: c.title, author: c.authors, distance: c.distance, prefScore: c.prefScore })), null, 2)}`;
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY}` },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "system", content: "Return only JSON arrays." }, { role: "user", content: prompt }], temperature: 0.3, max_tokens: 800 }),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const content: string | undefined = data.choices?.[0]?.message?.content;
        if (content) {
          try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) ids = parsed.slice(0, 5).map((x: any) => x.id ?? x.bookId ?? "").filter(Boolean);
          } catch {
            const m = content.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
            if (m) {
              const arr = JSON.parse(m[1]!);
              ids = arr.slice(0, 5).map((x: any) => x.id ?? x.bookId ?? "").filter(Boolean);
            }
          }
        }
      }
    } catch {}
  }

  const books = await db.book.findMany({ where: { id: { in: ids } } });
  // Keep LLM order
  const map = new Map(books.map((b) => [b.id, b] as const));
  return ids.map((id) => map.get(id)).filter(Boolean) as Book[];
}
