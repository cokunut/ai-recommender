import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

interface OpenLibrarySearchResponse {
  numFound: number;
  docs: Array<{
    title: string;
    author_name?: string[];
    cover_i?: number;
    key: string;
  }>;
}

export const booksRouter = createTRPCRouter({
  getThumbnail: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        author: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      try {
        // Search for the book using Open Library API
        const searchParams = new URLSearchParams({
          title: input.title,
          author: input.author,
        });

        const searchUrl = `https://openlibrary.org/search.json?${searchParams.toString()}`;
        const searchResponse = await fetch(searchUrl, {
          headers: {
            "User-Agent": "Bookclub App (https://github.com/yourusername/bookclub)",
          },
        });

        if (!searchResponse.ok) {
          throw new Error(
            `Open Library API error: ${searchResponse.statusText}`,
          );
        }

        const searchData =
          (await searchResponse.json()) as OpenLibrarySearchResponse;

        // Check if we found any results
        if (searchData.numFound === 0 || !searchData.docs?.[0]) {
          return {
            thumbnail: null,
            title: input.title,
            author: input.author,
            found: false,
          };
        }

        const firstResult = searchData.docs[0];

        // Construct thumbnail URL if cover_i exists
        let thumbnail: string | null = null;
        if (firstResult.cover_i) {
          // Use medium size thumbnail (M)
          thumbnail = `https://covers.openlibrary.org/b/id/${firstResult.cover_i}-M.jpg`;
        }

        return {
          thumbnail,
          title: firstResult.title,
          author: firstResult.author_name?.[0] ?? input.author,
          found: true,
        };
      } catch (error) {
        console.error("Error fetching book thumbnail:", error);
        throw new Error(
          error instanceof Error
            ? error.message
            : "Failed to fetch book thumbnail",
        );
      }
    }),
});

