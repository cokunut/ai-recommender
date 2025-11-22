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
 * Check if user has uploaded Goodreads data
 */
export async function hasGoodreadsImport(userId: string): Promise<boolean> {
  const importCount = await db.goodreadsImport.count({
    where: { userId },
  });

  return importCount > 0;
}

/**
 * Check if setup is complete (both profile text and Goodreads import)
 */
export async function isSetupComplete(userId: string): Promise<boolean> {
  const [profileComplete, hasGoodreads] = await Promise.all([
    isProfileComplete(userId),
    hasGoodreadsImport(userId),
  ]);

  return profileComplete && hasGoodreads;
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

