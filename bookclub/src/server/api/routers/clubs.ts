import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

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

  // Create or return an active 24h poll with 3 stubbed books
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

      // Ensure at least 3 books exist; if not, create stub books
      const bookCount = await ctx.db.book.count();
      if (bookCount < 3) {
        const missing = 3 - bookCount;
        const samples = [
          {
            title: "The Great Gatsby",
            authors: "F. Scott Fitzgerald",
            coverImageUrl: "https://covers.openlibrary.org/b/id/7222246-M.jpg",
            description: "A Jazz Age classic about wealth and dreams.",
          },
          {
            title: "Pride and Prejudice",
            authors: "Jane Austen",
            coverImageUrl: "https://covers.openlibrary.org/b/id/8091016-M.jpg",
            description: "A witty romance and social commentary.",
          },
          {
            title: "1984",
            authors: "George Orwell",
            coverImageUrl: "https://covers.openlibrary.org/b/id/7222241-M.jpg",
            description: "A dystopian tale of surveillance and control.",
          },
        ];
        for (let i = 0; i < missing; i++) {
          const s = samples[i]!;
          await ctx.db.book.create({
            data: {
              title: s.title,
              authors: s.authors,
              coverImageUrl: s.coverImageUrl,
              description: s.description,
            },
          });
        }
      }

      // Pick 3 books (latest 3 is fine for stub)
      const books = await ctx.db.book.findMany({
        orderBy: { createdAt: "desc" },
        take: 3,
      });

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
});
