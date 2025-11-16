import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

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
});
