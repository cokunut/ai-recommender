import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { isSetupComplete } from "~/server/auth/profile-helpers";

async function getOrCreateCurrentUserId() {
  const session = await auth();
  if (session?.user?.id) return session.user.id as string;
  const DUMMY_ID = "guest";
  await db.user.upsert({
    where: { id: DUMMY_ID },
    create: { id: DUMMY_ID, name: "Guest", image: null },
    update: {},
  });
  return DUMMY_ID;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const text = await file.text();
    const userId = await getOrCreateCurrentUserId();

    await db.goodreadsImport.create({
      data: {
        userId,
        jsonData: { csvText: text },
        status: "DONE",
      },
    });

    // Check if setup is complete - if so, redirect to clubs, otherwise back to setup
    const setupComplete = await isSetupComplete(userId);
    const redirectUrl = setupComplete ? "/clubs" : "/profile/setup";

    const referer = req.headers.get("referer");
    const isFromSetup = referer?.includes("/profile/setup");

    if (isFromSetup) {
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }

    return NextResponse.redirect(new URL("/profile?import=success", req.url));
  } catch (err) {
    console.error("Goodreads import error", err);
    const referer = req.headers.get("referer");
    const isFromSetup = referer?.includes("/profile/setup");
    
    if (isFromSetup) {
      return NextResponse.redirect(new URL("/profile/setup", req.url));
    }
    return NextResponse.redirect(new URL("/profile?import=error", req.url));
  }
}

