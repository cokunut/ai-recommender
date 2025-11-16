import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

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

export const userRouter = createTRPCRouter({
  getProfile: publicProcedure.query(async ({ ctx }) => {
    const userId = await getOrCreateCurrentUserId(ctx);
    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        image: true,
        avatarUrl: true,
        profileText: true,
        goodreadsImports: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, createdAt: true },
        },
      },
    });
    return user;
  }),

  updateProfile: publicProcedure
    .input(z.object({ profileText: z.string().max(5000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const userId = await getOrCreateCurrentUserId(ctx);
      const updated = await ctx.db.user.update({
        where: { id: userId },
        data: { profileText: input.profileText ?? null },
        select: { id: true, profileText: true },
      });
      return updated;
    }),
});
