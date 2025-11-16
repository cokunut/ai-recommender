import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env";

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
});

