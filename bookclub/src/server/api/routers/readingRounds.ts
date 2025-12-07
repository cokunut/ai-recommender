import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env";
import { TRPCError } from "@trpc/server";
import { rankAndSelectFive } from "~/server/recommendations-core";

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

// Helper function to fetch cover image from Open Library
async function fetchCoverImageUrl(title: string, author: string): Promise<string | null> {
  try {
    const searchParams = new URLSearchParams({
      title: title,
      author: author,
    });
    const searchUrl = `https://openlibrary.org/search.json?${searchParams.toString()}`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Bookclub App",
      },
    });

    if (searchResponse.ok) {
      const searchData = (await searchResponse.json()) as {
        numFound: number;
        docs: Array<{ cover_i?: number }>;
      };
      if (searchData.numFound > 0 && searchData.docs[0]?.cover_i) {
        return `https://covers.openlibrary.org/b/id/${searchData.docs[0].cover_i}-M.jpg`;
      }
    }
  } catch (error) {
    // Silently fail - we'll just use emoji placeholder
    console.error("Error fetching cover:", error);
  }
  return null;
}

export const readingRoundsRouter = createTRPCRouter({
  /**
   * Generate context JSON for LLM to pick 3 bookclub books for a reading round.
   * Includes:
   * - All members' Goodreads data (if exists)
   * - All members' bios (if stored in database - currently missing, see note)
   * - Group/club description
   */
  generateContextForRound: publicProcedure
    .input(
      z.object({
        readingRoundId: z.string().optional(),
        groupId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Get the group with description
      const group = await ctx.db.group.findUnique({
        where: { id: input.groupId },
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      if (!group) {
        throw new Error("Group not found");
      }

      // Get all members of the group
      const memberships = await ctx.db.groupMember.findMany({
        where: { groupId: input.groupId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              // Note: bio is not currently stored in database (only in localStorage)
              // We would need to add a bio field to User model to include it here
              goodreadsImports: {
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  jsonData: true,
                  status: true,
                  createdAt: true,
                  importedCount: true,
                },
              },
            },
          },
        },
      });

      // Build context for each member
      const members = memberships.map((membership) => {
        const user = membership.user;
        const goodreadsData = user.goodreadsImports.map((import_) => ({
          id: import_.id,
          status: import_.status,
          createdAt: import_.createdAt,
          importedCount: import_.importedCount,
          // Include full jsonData which contains the Goodreads CSV data
          data: import_.jsonData,
        }));

        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          // NOTE: bio is missing - currently stored in localStorage only
          // To include bio, we need to:
          // 1. Add a bio field to the User model in schema.prisma
          // 2. Update the profile form to save to database instead of localStorage
          // 3. Update this query to include the bio field
          bio: null,
          goodreadsImports: goodreadsData,
        };
      });

      // Get reading round info if provided
      let readingRound = null;
      if (input.readingRoundId) {
        readingRound = await ctx.db.readingRound.findUnique({
          where: { id: input.readingRoundId },
          select: {
            id: true,
            status: true,
            createdAt: true,
            startedAt: true,
            finishedAt: true,
          },
        });
      }

      // Build the context JSON
      const context = {
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
        },
        readingRound: readingRound
          ? {
              id: readingRound.id,
              status: readingRound.status,
              createdAt: readingRound.createdAt,
              startedAt: readingRound.startedAt,
              finishedAt: readingRound.finishedAt,
            }
          : null,
        members: members,
        // Metadata about what's included
        metadata: {
          totalMembers: members.length,
          membersWithGoodreads: members.filter(
            (m) => m.goodreadsImports.length > 0,
          ).length,
          membersWithBio: members.filter((m) => m.bio !== null).length,
          note: "User bios are currently stored in localStorage and not accessible server-side. Add a bio field to the User model to include them here.",
        },
      };

      return context;
    }),

  /**
   * Generate 3 book recommendations for a reading round using Groq AI.
   * Uses the context from generateContextForRound and calls Groq to get book suggestions.
   */
  generateBookRecommendations: publicProcedure
    .input(
      z.object({
        readingRoundId: z.string().optional(),
        groupId: z.string(),
        model: z
          .string()
          .default("llama-3.3-70b-versatile")
          .describe("Groq model name (e.g., llama-3.3-70b-versatile, llama-3.1-8b-instant)"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // First, get the context by calling the same logic
      const group = await ctx.db.group.findUnique({
        where: { id: input.groupId },
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      if (!group) {
        throw new Error("Group not found");
      }

      const memberships = await ctx.db.groupMember.findMany({
        where: { groupId: input.groupId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              goodreadsImports: {
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  jsonData: true,
                  status: true,
                  createdAt: true,
                  importedCount: true,
                },
              },
            },
          },
        },
      });

      const members = memberships.map((membership) => {
        const user = membership.user;
        const goodreadsData = user.goodreadsImports.map((import_) => ({
          id: import_.id,
          status: import_.status,
          createdAt: import_.createdAt,
          importedCount: import_.importedCount,
          data: import_.jsonData,
        }));

        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          bio: null,
          goodreadsImports: goodreadsData,
        };
      });

      const context = {
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
        },
        members,
      };

      // Check if Groq API key is configured
      if (!env.GROQ_API_KEY) {
        throw new Error(
          "GROQ_API_KEY is not configured. Please set it in your environment variables.",
        );
      }

      // Build detailed member info for the prompt
      const memberDetails = context.members
        .map((member: { name: string | null; goodreadsImports: Array<{ data: unknown }> }, idx: number) => {
          let info = `${idx + 1}. ${member.name || "Anonymous"}`;
          if (member.goodreadsImports.length > 0) {
            const latestImport = member.goodreadsImports[0];
            if (latestImport?.data) {
              info += `\n   - Has Goodreads reading history (${member.goodreadsImports.length} import(s))`;
              // Include a sample of the Goodreads data structure if it's available
              const dataStr = JSON.stringify(latestImport.data).substring(0, 200);
              info += `\n   - Data preview: ${dataStr}...`;
            }
          } else {
            info += "\n   - No Goodreads data available";
          }
          return info;
        })
        .join("\n\n");

      // Build the prompt for Groq
      const prompt = `You are a book recommendation expert for book clubs. Based on the following information about a book club and its members, recommend exactly 3 books that would be perfect for this group's next reading round.

Book Club Information:
- Name: ${context.group.name}
- Description: ${context.group.description || "No description provided"}

Members (${context.members.length} total):
${memberDetails}

Please recommend exactly 3 books that:
1. Would appeal to the group's interests based on their Goodreads data and preferences
2. Are diverse in genre, style, or perspective
3. Would generate good discussion
4. Are appropriate for a book club setting

For each book, provide:
- Title (exact title)
- Author (full name)
- A brief 2-3 sentence explanation of why this book fits the group

IMPORTANT: Return ONLY a valid JSON array with this exact structure (no markdown, no code blocks, just the JSON):
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "reasoning": "Why this book fits the group..."
  },
  {
    "title": "Book Title",
    "author": "Author Name",
    "reasoning": "Why this book fits the group..."
  },
  {
    "title": "Book Title",
    "author": "Author Name",
    "reasoning": "Why this book fits the group..."
  }
]`;

      // Call Groq API
      const groqResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: input.model,
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful assistant that provides book recommendations in JSON format. Always return valid JSON arrays.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        },
      );

      if (!groqResponse.ok) {
        const errorText = await groqResponse.text();
        throw new Error(
          `Groq API error: ${groqResponse.status} ${groqResponse.statusText}. ${errorText}`,
        );
      }

      const groqData = (await groqResponse.json()) as {
        choices: Array<{
          message: {
            content: string;
          };
        }>;
      };

      const content = groqData.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from Groq API");
      }

      // Parse the JSON response
      let recommendations;
      try {
        const parsed = JSON.parse(content);
        // Handle both { books: [...] } and direct array responses
        recommendations = Array.isArray(parsed) ? parsed : parsed.books || parsed.recommendations || [];
      } catch (error) {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
        if (jsonMatch) {
          recommendations = JSON.parse(jsonMatch[1]!);
        } else {
          throw new Error(
            `Failed to parse Groq response as JSON: ${content.substring(0, 200)}`,
          );
        }
      }

      // Validate we got 3 books
      if (!Array.isArray(recommendations) || recommendations.length !== 3) {
        throw new Error(
          `Expected 3 book recommendations, got ${recommendations.length}`,
        );
      }

      // Validate each recommendation has required fields
      const bookSchema = z.object({
        title: z.string(),
        author: z.string(),
        reasoning: z.string().optional(),
      });

      const validatedRecommendations = recommendations.map((book, idx) => {
        try {
          return bookSchema.parse(book);
        } catch (error) {
          throw new Error(
            `Invalid book recommendation at index ${idx}: ${JSON.stringify(book)}`,
          );
        }
      });

      return {
        recommendations: validatedRecommendations,
        context: {
          groupId: context.group.id,
          groupName: context.group.name,
          memberCount: context.members.length,
          model: input.model,
        },
      };
    }),

  // Get current reading round for a club
  getCurrentRound: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);

      // Get the most recent non-finished reading round
      const round = await ctx.db.readingRound.findFirst({
        where: {
          groupId: input.groupId,
          status: { not: "FINISHED" },
        },
        include: {
          poll: {
            include: {
              choices: {
                include: {
                  book: true,
                  votes: true,
                  addedBy: {
                    select: {
                      id: true,
                    },
                  },
                },
              },
              votes: true,
            },
          },
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
        orderBy: { createdAt: "desc" },
      });

      if (!round) return null;

      const memberCount = await ctx.db.groupMember.count({
        where: { groupId: input.groupId },
      });

      const myRating = round.ratings.find((r) => r.userId === userId);
      const myReview = round.reviews.find((r) => r.userId === userId);

      // Calculate average rating
      const avgRating =
        round.ratings.length > 0
          ? round.ratings.reduce((sum, r) => sum + r.rating, 0) / round.ratings.length
          : null;

      // If there's a poll, get voting info and auto-close if needed
      let pollData = null;
      if (round.poll) {
        const now = new Date();
        const endedByTime = round.poll.endsAt ? round.poll.endsAt <= now : false;
        const totalVotes = round.poll.votes.length;
        const allVoted = totalVotes >= memberCount && memberCount > 0;

        // Determine winner
        const choiceTallies = round.poll.choices.map((c) => ({
          id: c.id,
          book: c.book,
          votes: c.votes.length,
        }));
        const sorted = [...choiceTallies].sort((a, b) => b.votes - a.votes);
        const winner = sorted[0];

        // Auto-close poll if voting has ended
        if (round.poll.status === "ACTIVE" && (endedByTime || allVoted)) {
          await ctx.db.poll.update({
            where: { id: round.poll.id },
            data: {
              status: "CLOSED",
              winningBookId: winner?.book?.id ?? null,
            },
          });
          round.poll.status = "CLOSED";
          round.poll.winningBookId = winner?.book?.id ?? null;
        }

        const myVote = round.poll.votes.find((v) => v.userId === userId) || null;

        pollData = {
          ...round.poll,
          memberCount,
          myVoteChoiceId: myVote?.choiceId ?? null,
          allVoted,
          endedByTime,
          winnerBookId:
            round.poll.status === "CLOSED" ? (winner?.book?.id ?? null) : null,
        };
      }

      return {
        ...round,
        poll: pollData,
        memberCount,
        myRating: myRating?.rating ?? null,
        myReview: myReview?.reviewText ?? null,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        ratingCount: round.ratings.length,
        reviewCount: round.reviews.length,
      };
    }),

  // Create a new reading round and generate recommendations
  createRoundWithRecommendations: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        aiDirection: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);

      // Check if user is admin/owner
      const membership = await ctx.db.groupMember.findUnique({
        where: { groupId_userId: { groupId: input.groupId, userId } },
      });

      if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can create reading rounds",
        });
      }

      // Check if there's already an active round
      const existing = await ctx.db.readingRound.findFirst({
        where: {
          groupId: input.groupId,
          status: { not: "FINISHED" },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "There is already an active reading round",
        });
      }

      // New algorithm: vector search candidates from Book, filter via Goodreads, score by tags, LLM-pick 5
      {
        const picked = await rankAndSelectFive(ctx.db, input.groupId);
        if (picked.length === 0) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No recommendations available" });
        }

        const now = new Date();
        const endsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const poll = await ctx.db.poll.create({
          data: {
            groupId: input.groupId,
            createdByUserId: userId,
            selectionType: "AI_GENERATED",
            status: "DRAFT",
            startsAt: now,
            endsAt,
            choices: { create: picked.slice(0, 5).map((b) => ({ bookId: b.id, addedByUserId: userId })) },
          },
          include: { choices: { include: { book: true } } },
        });

        const readingRound = await ctx.db.readingRound.create({
          data: {
            groupId: input.groupId,
            pollId: poll.id,
            status: "SETUP",
          },
          include: {
            poll: {
              include: {
                choices: { include: { book: true, votes: true } },
                votes: true,
              },
            },
          },
        });

        return readingRound;
      }

      // (legacy generation removed)
    }),

  // Add a user-generated recommendation
  addUserRecommendation: publicProcedure
    .input(
      z.object({
        readingRoundId: z.string(),
        title: z.string().min(1),
        author: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);

      const round = await ctx.db.readingRound.findUnique({
        where: { id: input.readingRoundId },
        include: { poll: true },
      });

      if (!round || !round.poll) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reading round or poll not found",
        });
      }

      if (round.status !== "SETUP") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only add recommendations during setup",
        });
      }

      // Try to fetch cover from Open Library
      const coverImageUrl = await fetchCoverImageUrl(input.title, input.author);

      // Upsert or create book
      const existing = await ctx.db.book.findFirst({
        where: { title: input.title, authors: input.author },
      });
      const book =
        existing
          ? await ctx.db.book.update({
              where: { id: existing.id },
              data: { coverImageUrl: coverImageUrl ?? existing.coverImageUrl },
            })
          : await ctx.db.book.create({
              data: { title: input.title, authors: input.author, coverImageUrl },
            });

      // Add to poll choices
      await ctx.db.pollChoice.create({
        data: {
          pollId: round.poll.id,
          bookId: book.id,
          addedByUserId: userId,
        },
      });

      return { ok: true };
    }),

  // Delete a recommendation
  deleteRecommendation: publicProcedure
    .input(
      z.object({
        readingRoundId: z.string(),
        choiceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);

      const round = await ctx.db.readingRound.findUnique({
        where: { id: input.readingRoundId },
        include: {
          poll: {
            include: {
              choices: true,
            },
          },
        },
      });

      if (!round || !round.poll) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reading round or poll not found",
        });
      }

      if (round.status !== "SETUP") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only delete recommendations during setup",
        });
      }

      const choice = round.poll.choices.find((c) => c.id === input.choiceId);
      if (!choice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recommendation not found",
        });
      }

      // Check if user is admin/owner or the one who added it
      const membership = await ctx.db.groupMember.findUnique({
        where: { groupId_userId: { groupId: round.groupId, userId } },
      });

      const isAdmin = membership?.role === "OWNER" || membership?.role === "ADMIN";
      const isCreator = choice.addedByUserId === userId;

      if (!isAdmin && !isCreator) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins or the person who added it can delete recommendations",
        });
      }

      await ctx.db.pollChoice.delete({
        where: { id: input.choiceId },
      });

      return { ok: true };
    }),

  // Start voting (transition from SETUP to VOTING)
  startVote: publicProcedure
    .input(z.object({ readingRoundId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);

      const round = await ctx.db.readingRound.findUnique({
        where: { id: input.readingRoundId },
        include: { poll: true },
      });

      if (!round || !round.poll) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reading round or poll not found",
        });
      }

      // Check if user is admin/owner
      const membership = await ctx.db.groupMember.findUnique({
        where: { groupId_userId: { groupId: round.groupId, userId } },
      });

      if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can start voting",
        });
      }

      if (round.status !== "SETUP") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only start voting from SETUP status",
        });
      }

      const now = new Date();
      const endsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Update poll to ACTIVE
      await ctx.db.poll.update({
        where: { id: round.poll.id },
        data: {
          status: "ACTIVE",
          startsAt: now,
          endsAt,
        },
      });

      // Update reading round to VOTING
      await ctx.db.readingRound.update({
        where: { id: input.readingRoundId },
        data: {
          status: "VOTING",
          startedAt: now,
        },
      });

      return { ok: true };
    }),

  // Submit a vote
  submitVote: publicProcedure
    .input(
      z.object({
        readingRoundId: z.string(),
        choiceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);

      const round = await ctx.db.readingRound.findUnique({
        where: { id: input.readingRoundId },
        include: { poll: true },
      });

      if (!round || !round.poll) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reading round or poll not found",
        });
      }

      if (round.status !== "VOTING" || round.poll.status !== "ACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Voting is not active",
        });
      }

      // Check if poll has ended
      const now = new Date();
      if (round.poll.endsAt && round.poll.endsAt <= now) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Voting period has ended",
        });
      }

      // Upsert vote
      await ctx.db.vote.upsert({
        where: { pollId_userId: { pollId: round.poll.id, userId } },
        create: { pollId: round.poll.id, userId, choiceId: input.choiceId },
        update: { choiceId: input.choiceId },
      });

      return { ok: true };
    }),

  // Start reading (transition from VOTING to READING when vote completes)
  startReading: publicProcedure
    .input(z.object({ readingRoundId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);

      const round = await ctx.db.readingRound.findUnique({
        where: { id: input.readingRoundId },
        include: {
          poll: {
            include: {
              choices: {
                include: {
                  book: true,
                  votes: true,
                },
              },
              votes: true,
            },
          },
        },
      });

      if (!round || !round.poll) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reading round or poll not found",
        });
      }

      // Check if user is admin/owner
      const membership = await ctx.db.groupMember.findUnique({
        where: { groupId_userId: { groupId: round.groupId, userId } },
      });

      if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can start reading",
        });
      }

      if (round.status !== "VOTING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only start reading from VOTING status",
        });
      }

      // Determine winner
      const choiceTallies = round.poll.choices.map((c) => ({
        id: c.id,
        book: c.book,
        votes: c.votes.length,
      }));
      const sorted = [...choiceTallies].sort((a, b) => b.votes - a.votes);
      const winner = sorted[0];

      if (!winner) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No winner determined",
        });
      }

      // Close poll and set winner
      await ctx.db.poll.update({
        where: { id: round.poll.id },
        data: {
          status: "CLOSED",
          winningBookId: winner.book.id,
        },
      });

      // Update reading round to READING
      const now = new Date();
      await ctx.db.readingRound.update({
        where: { id: input.readingRoundId },
        data: {
          status: "READING",
          bookId: winner.book.id,
        },
      });

      return { ok: true };
    }),

  // Submit rating
  submitRating: publicProcedure
    .input(
      z.object({
        readingRoundId: z.string(),
        rating: z.number().min(1).max(5),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);

      const round = await ctx.db.readingRound.findUnique({
        where: { id: input.readingRoundId },
      });

      if (!round) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reading round not found",
        });
      }

      if (round.status !== "READING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only rate during READING status",
        });
      }

      await ctx.db.rating.upsert({
        where: {
          readingRoundId_userId: {
            readingRoundId: input.readingRoundId,
            userId,
          },
        },
        create: {
          readingRoundId: input.readingRoundId,
          userId,
          rating: input.rating,
        },
        update: {
          rating: input.rating,
        },
      });

      return { ok: true };
    }),

  // Submit review
  submitReview: publicProcedure
    .input(
      z.object({
        readingRoundId: z.string(),
        reviewText: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);

      const round = await ctx.db.readingRound.findUnique({
        where: { id: input.readingRoundId },
      });

      if (!round) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reading round not found",
        });
      }

      if (round.status !== "READING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only review during READING status",
        });
      }

      await ctx.db.review.upsert({
        where: {
          readingRoundId_userId: {
            readingRoundId: input.readingRoundId,
            userId,
          },
        },
        create: {
          readingRoundId: input.readingRoundId,
          userId,
          reviewText: input.reviewText,
        },
        update: {
          reviewText: input.reviewText,
        },
      });

      return { ok: true };
    }),

  // Finish reading (transition from READING to FINISHED)
  finishReading: publicProcedure
    .input(z.object({ readingRoundId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);

      const round = await ctx.db.readingRound.findUnique({
        where: { id: input.readingRoundId },
      });

      if (!round) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reading round not found",
        });
      }

      // Check if user is admin/owner
      const membership = await ctx.db.groupMember.findUnique({
        where: { groupId_userId: { groupId: round.groupId, userId } },
      });

      if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can finish reading",
        });
      }

      if (round.status !== "READING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only finish from READING status",
        });
      }

      const now = new Date();
      await ctx.db.readingRound.update({
        where: { id: input.readingRoundId },
        data: {
          status: "FINISHED",
          finishedAt: now,
        },
      });

      return { ok: true };
    }),
});
