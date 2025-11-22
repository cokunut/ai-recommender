import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { env } from "~/env";

const GOVERNANCE = ["OWNER_ADMIN", "ALL_MEMBERS"] as const;

async function getOrCreateCurrentUserId(ctx: { session: any; db: any }) {
  if (ctx.session?.user?.id) return ctx.session.user.id as string;
  const DUMMY_ID = "guest";
  await ctx.db.user.upsert({
    where: { id: DUMMY_ID },
    create: {
      id: DUMMY_ID,
      name: "Guest",
      image: null,
    },
    update: {},
  });
  return DUMMY_ID;
}

export const clubsRouter = createTRPCRouter({
  list: publicProcedure.query(async ({ ctx }) => {
    const userId = await getOrCreateCurrentUserId(ctx);
    const memberships = await ctx.db.groupMember.findMany({
      where: { userId },
      include: { group: true },
      orderBy: { joinedAt: "desc" },
    });
    return memberships.map((m: any) => m.group);
  }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        governanceMode: z.enum(GOVERNANCE).default("OWNER_ADMIN"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);
      const group = await ctx.db.group.create({
        data: {
          name: input.name,
          description: input.description,
          governanceMode: input.governanceMode,
          createdByUserId: userId,
          members: {
            create: {
              userId,
              role: "OWNER",
            },
          },
        },
      });
      return group;
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const group = await ctx.db.group.findUnique({ where: { id: input.id } });
      return group;
    }),

  isMember: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);
      const membership = await ctx.db.groupMember.findUnique({
        where: { groupId_userId: { groupId: input.id, userId } },
      });
      return Boolean(membership);
    }),

  // List members of a club
  members: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.db.groupMember.findMany({
        where: { groupId: input.id },
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      });
      return members.map((m: any) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: {
          id: m.user.id,
          name: m.user.name,
          image: m.user.image,
          avatarUrl: m.user.avatarUrl,
        },
      }));
    }),

  join: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);

      // Ensure the group exists
      const group = await ctx.db.group.findUnique({ where: { id: input.id } });
      if (!group) return null;

      const membership = await ctx.db.groupMember.upsert({
        where: { groupId_userId: { groupId: input.id, userId } },
        update: {},
        create: { groupId: input.id, userId, role: "MEMBER" },
      });
      return membership;
    }),

  // Get current user's role in a club
  myRole: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);
      const membership = await ctx.db.groupMember.findUnique({
        where: { groupId_userId: { groupId: input.id, userId } },
      });
      return membership?.role ?? null;
    }),

  // Delete a club (only owner/admin can delete)
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);
      const membership = await ctx.db.groupMember.findUnique({
        where: { groupId_userId: { groupId: input.id, userId } },
      });
      if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owner or admin can delete the club" });
      }
      await ctx.db.group.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  // Leave a club (must transfer admin if user is owner/admin)
  leave: publicProcedure
    .input(
      z.object({
        id: z.string(),
        transferToUserId: z.string().optional(), // Required if user is OWNER or ADMIN
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);
      const membership = await ctx.db.groupMember.findUnique({
        where: { groupId_userId: { groupId: input.id, userId } },
      });
      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Not a member of this club" });
      }

      // If user is OWNER or ADMIN, they must transfer to another user
      if (membership.role === "OWNER" || membership.role === "ADMIN") {
        if (!input.transferToUserId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Must designate another user to be admin before leaving",
          });
        }
        // Verify the target user is a member
        const targetMembership = await ctx.db.groupMember.findUnique({
          where: { groupId_userId: { groupId: input.id, userId: input.transferToUserId } },
        });
        if (!targetMembership) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Target user is not a member" });
        }
        // Transfer the role
        await ctx.db.groupMember.update({
          where: { groupId_userId: { groupId: input.id, userId: input.transferToUserId } },
          data: { role: membership.role === "OWNER" ? "OWNER" : "ADMIN" },
        });
      }

      // Remove the user's membership
      await ctx.db.groupMember.delete({
        where: { groupId_userId: { groupId: input.id, userId } },
      });
      return { ok: true };
    }),

  // Create or return an active 24h poll with 3 books
  generateRecs: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);

      const group = await ctx.db.group.findUnique({ where: { id: input.id } });
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });

      // Ensure user is a member
      const membership = await ctx.db.groupMember.findUnique({
        where: { groupId_userId: { groupId: input.id, userId } },
      });
      if (!membership)
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });

      // If there is an active poll that hasn't ended, return it
      const now = new Date();
      const existing = await ctx.db.poll.findFirst({
        where: { groupId: input.id, status: "ACTIVE", endsAt: { gt: now } },
        orderBy: { createdAt: "desc" },
        include: {
          choices: { include: { book: true, votes: true } },
          votes: true,
        },
      });
      if (existing) return existing;

      // Use the same logic as /test-recommendations to generate 3 recs via Groq
      let books: Array<{ id: string; title: string; authors: string }> = [];
      try {
        if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY missing");

        const groupData = await ctx.db.group.findUnique({
          where: { id: input.id },
          select: { id: true, name: true, description: true },
        });
        const memberships = await ctx.db.groupMember.findMany({
          where: { groupId: input.id },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                goodreadsImports: {
                  orderBy: { createdAt: "desc" },
                  select: { jsonData: true },
                },
              },
            },
          },
        });

        const memberDetails = memberships
          .map((m, idx) => {
            const hasGR = m.user.goodreadsImports.length > 0;
            return `${idx + 1}. ${m.user.name ?? "Anonymous"}\n   - ${hasGR ? "Has Goodreads data" : "No Goodreads data"}`;
          })
          .join("\n\n");

        const prompt = `You are a book recommendation expert for book clubs. Based on the following information about a book club and its members, recommend exactly 3 books that would be perfect for this group's next reading round.\n\nBook Club Information:\n- Name: ${groupData?.name}\n- Description: ${groupData?.description ?? "No description provided"}\n\nMembers (${memberships.length} total):\n${memberDetails}\n\nPlease recommend exactly 3 books and return ONLY a valid JSON array with objects: {\n  "title": "Book Title",\n  "author": "Author Name"\n}`;

        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "Return valid JSON arrays only." },
              { role: "user", content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 1200,
          }),
        });
        if (!groqResponse.ok) throw new Error(await groqResponse.text());
        const groqData = (await groqResponse.json()) as any;
        const content: string | undefined = groqData.choices?.[0]?.message?.content;
        if (!content) throw new Error("No content from Groq");
        let recs: Array<{ title: string; author: string }> = [];
        try {
          const parsed = JSON.parse(content);
          recs = Array.isArray(parsed) ? parsed : parsed.books || parsed.recommendations || [];
        } catch {
          const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
          if (jsonMatch) {
            recs = JSON.parse(jsonMatch[1]!);
          } else {
            throw new Error("Failed to parse Groq JSON");
          }
        }
        if (!Array.isArray(recs) || recs.length < 3) throw new Error("Invalid recs");

        // Upsert or create books by title+author
        const created: Array<{ id: string; title: string; authors: string }> = [];
        for (const r of recs.slice(0, 3)) {
          const title = r.title?.trim();
          const author = r.author?.trim();
          if (!title || !author) continue;
          const existing = await ctx.db.book.findFirst({ where: { title, authors: author } });
          const book =
            existing ??
            (await ctx.db.book.create({ data: { title, authors: author } }));
          created.push({ id: book.id, title: book.title, authors: book.authors });
        }
        if (created.length === 3) {
          books = created;
        }
      } catch (err) {
        // fallback to fixed stubs if Groq not configured or fails
        const samples = [
          { title: "The Great Gatsby", authors: "F. Scott Fitzgerald", coverImageUrl: "https://covers.openlibrary.org/b/id/7222246-M.jpg" },
          { title: "Pride and Prejudice", authors: "Jane Austen", coverImageUrl: "https://covers.openlibrary.org/b/id/8091016-M.jpg" },
          { title: "1984", authors: "George Orwell", coverImageUrl: "https://covers.openlibrary.org/b/id/7222241-M.jpg" },
        ];
        const created: Array<{ id: string; title: string; authors: string }> = [];
        for (const s of samples) {
          const existing = await ctx.db.book.findFirst({ where: { title: s.title, authors: s.authors } });
          const book =
            existing ??
            (await ctx.db.book.create({ data: { title: s.title, authors: s.authors, coverImageUrl: s.coverImageUrl } }));
          created.push({ id: book.id, title: book.title, authors: book.authors });
        }
        books = created;
      }

      const startsAt = now;
      const endsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const poll = await ctx.db.poll.create({
        data: {
          groupId: input.id,
          createdByUserId: userId,
          selectionType: "AI_GENERATED",
          status: "ACTIVE",
          startsAt,
          endsAt,
          choices: {
            create: books.map((b) => ({ bookId: b.id, addedByUserId: userId })),
          },
        },
        include: { choices: { include: { book: true } } },
      });

      return poll;
    }),

  // Fetch active poll with aggregates; auto-close when done
  getActivePoll: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);

      const group = await ctx.db.group.findUnique({ where: { id: input.id } });
      if (!group) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });

      const memberCount = await ctx.db.groupMember.count({ where: { groupId: input.id } });

      const now = new Date();
      const poll = await ctx.db.poll.findFirst({
        where: { groupId: input.id, status: { in: ["ACTIVE", "CLOSED"] } },
        orderBy: { createdAt: "desc" },
        include: {
          choices: {
            include: {
              book: true,
              votes: true,
            },
          },
          votes: true,
        },
      });

      if (!poll) return null;

      const endedByTime = poll.endsAt ? poll.endsAt <= now : false;
      const totalVotes = poll.votes.length;
      const allVoted = totalVotes >= memberCount && memberCount > 0;

      // Determine winner
      const choiceTallies = poll.choices.map((c) => ({ id: c.id, book: c.book, votes: c.votes.length }));
      const sorted = [...choiceTallies].sort((a, b) => b.votes - a.votes);
      const winner = sorted[0];

      // If poll should end, close it and persist winningBookId
      if (poll.status === "ACTIVE" && (endedByTime || allVoted)) {
        await ctx.db.poll.update({
          where: { id: poll.id },
          data: {
            status: "CLOSED",
            winningBookId: winner?.book?.id ?? null,
          },
        });
        poll.status = "CLOSED";
      }

      const myVote = poll.votes.find((v: any) => v.userId === userId) || null;

      return {
        ...poll,
        memberCount,
        myVoteChoiceId: myVote?.choiceId ?? null,
        allVoted,
        endedByTime,
        winnerBookId: poll.status === "CLOSED" ? (winner?.book?.id ?? null) : null,
      } as const;
    }),

  // Cast or clear a vote using thumbs up/down
  vote: publicProcedure
    .input(
      z.object({ pollId: z.string(), choiceId: z.string(), action: z.enum(["up", "down"]) }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);
      const poll = await ctx.db.poll.findUnique({ where: { id: input.pollId } });
      if (!poll) throw new TRPCError({ code: "NOT_FOUND", message: "Poll not found" });
      if (poll.status !== "ACTIVE") throw new TRPCError({ code: "BAD_REQUEST", message: "Poll is not active" });

      if (input.action === "up") {
        const vote = await ctx.db.vote.upsert({
          where: { pollId_userId: { pollId: input.pollId, userId } },
          create: { pollId: input.pollId, userId, choiceId: input.choiceId },
          update: { choiceId: input.choiceId },
        });
        return vote;
      } else {
        // down: clear vote if exists
        try {
          const vote = await ctx.db.vote.delete({ where: { pollId_userId: { pollId: input.pollId, userId } } });
          return vote;
        } catch {
          return null;
        }
      }
    }),

  // Archive a poll (remove it) after winner is announced; optional score ignored for now
  archivePoll: publicProcedure
    .input(z.object({ pollId: z.string(), score: z.number().min(1).max(5).optional() }))
    .mutation(async ({ ctx, input }) => {
      // In the future we can persist score in a ReadingRound table
      try {
        await ctx.db.poll.delete({ where: { id: input.pollId } });
      } catch {
        // ignore if already gone
      }
      return { ok: true } as const;
    }),

  // Get history of finished reading rounds for a club
  history: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);
      const rounds = await ctx.db.readingRound.findMany({
        where: {
          groupId: input.id,
          status: "FINISHED",
          bookId: { not: null },
        },
        include: {
          book: true,
          ratings: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          reviews: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { finishedAt: "desc" },
      });

      return rounds.map((round) => {
        const ratings = round.ratings;
        const avgRating =
          ratings.length > 0
            ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
            : null;

        const myRating = ratings.find((r) => r.userId === userId);
        const myReview = round.reviews.find((r) => r.userId === userId);

        return {
          id: round.id,
          book: round.book
            ? {
                id: round.book.id,
                title: round.book.title,
                authors: round.book.authors,
                coverImageUrl: round.book.coverImageUrl,
              }
            : null,
          finishedAt: round.finishedAt,
          avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null, // Round to 1 decimal
          ratingCount: ratings.length,
          aiGroupReview: round.aiGroupReview,
          myRating: myRating?.rating ?? null,
          myReview: myReview?.reviewText ?? null,
        };
      });
    }),

  // Generate AI-synthesized group review from all member reviews
  generateGroupReview: publicProcedure
    .input(z.object({ readingRoundId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const round = await ctx.db.readingRound.findUnique({
        where: { id: input.readingRoundId },
        include: {
          book: true,
          reviews: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!round || !round.book) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reading round or book not found" });
      }

      if (round.reviews.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No reviews to synthesize" });
      }

      if (!env.GROQ_API_KEY) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GROQ_API_KEY not configured" });
      }

      // Build prompt with all reviews
      const reviewsText = round.reviews
        .map((r, idx) => `${idx + 1}. ${r.user.name ?? "Anonymous"}: "${r.reviewText}"`)
        .join("\n\n");

      const prompt = `You are synthesizing book club member reviews into a cohesive group review.

Book: "${round.book.title}" by ${round.book.authors}

Individual Member Reviews:
${reviewsText}

Please create a synthesized group review (2-4 paragraphs) that:
1. Captures the overall sentiment and key themes from the individual reviews
2. Highlights both positive and critical perspectives
3. Reflects the diversity of opinions in the group
4. Is written in a cohesive, natural style (not just a summary)

Return ONLY the review text, no markdown formatting, no quotes, just the review.`;

      try {
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "You are a helpful assistant that synthesizes book reviews." },
              { role: "user", content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 1000,
          }),
        });

        if (!groqResponse.ok) {
          throw new Error(`Groq API error: ${groqResponse.status}`);
        }

        const groqData = (await groqResponse.json()) as {
          choices: Array<{
            message: {
              content: string;
            };
          }>;
        };

        const synthesizedReview = groqData.choices[0]?.message?.content?.trim();
        if (!synthesizedReview) {
          throw new Error("No review generated");
        }

        // Update the reading round with the AI review
        await ctx.db.readingRound.update({
          where: { id: input.readingRoundId },
          data: { aiGroupReview: synthesizedReview },
        });

        return { review: synthesizedReview };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate review",
        });
      }
    }),
});
