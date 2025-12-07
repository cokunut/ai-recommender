import { clubsRouter } from "~/server/api/routers/clubs";
import { booksRouter } from "~/server/api/routers/books";
import { userRouter } from "~/server/api/routers/user";
import { readingRoundsRouter } from "~/server/api/routers/readingRounds";
import { recommendationsRouter } from "~/server/api/routers/recommendations";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  clubs: clubsRouter,
  books: booksRouter,
  user: userRouter,
  readingRounds: readingRoundsRouter,
  recommendations: recommendationsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);
