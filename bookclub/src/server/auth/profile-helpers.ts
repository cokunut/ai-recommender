"use server";

import { db } from "~/server/db";

/**
 * Check if a user's profile is complete
 * Profile is complete if profileText is filled
 */
export async function isProfileComplete(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { profileText: true },
  });

  return Boolean(user?.profileText && user.profileText.trim().length > 0);
}

/**
 * Check if user is a first-time user (account created recently and profile incomplete)
 * Used to determine if we should force onboarding
 */
export async function isFirstTimeUser(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { profileText: true, createdAt: true },
  });

  if (!user) return false;

  const isComplete = Boolean(user.profileText && user.profileText.trim().length > 0);
  
  // Consider user "first-time" if account was created less than 5 minutes ago
  // and profile is not complete
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const isRecent = new Date(user.createdAt) > fiveMinutesAgo;

  return !isComplete && isRecent;
}

