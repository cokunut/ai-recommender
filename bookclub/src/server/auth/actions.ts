"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { db } from "~/server/db";
import { signIn, signOut } from "~/server/auth";
import { auth } from "./index";
import { isSetupComplete, isFirstTimeUser } from "./profile-helpers";

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  name?: string,
) {
  // Check if user already exists
  const existingUser = await db.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  await db.user.create({
    data: {
      email,
      password: hashedPassword,
      name: name ?? null,
    },
  });

    // Sign in the user
  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    
    // If signIn failed, result will contain error information
    if (result?.error) {
      throw new Error(result.error === "CredentialsSignin" ? "Invalid email or password" : "Failed to sign in");
    }
    
    // Revalidate to ensure session is fresh
    revalidatePath("/");
    
    // Wait for session to be available (retry up to 5 times with small delay)
    let session = await auth();
    let retries = 0;
    const maxRetries = 5;
    
    while (!session?.user?.id && retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 100ms
      session = await auth();
      retries++;
    }
    
    if (!session?.user?.id) {
      // Session still not available after retries, redirect to home and let it handle routing
      redirect("/");
      return;
    }
    
    // Check if first-time user → redirect to setup (shows welcome view)
    const isFirstTime = await isFirstTimeUser(session.user.id);
    if (isFirstTime) {
      redirect("/profile/setup");
      return;
    }
    
    // Returning user - redirect to clubs (they can use Complete Profile button if needed)
    redirect("/clubs");
  } catch (error) {
    // Check if it's a Next.js redirect (not an error)
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      // Let redirect propagate
      throw error;
    }
    
    if (error instanceof AuthError) {
      throw new Error("Failed to sign in after registration");
    }
    throw error;
  }
}

export async function signInWithEmailPassword(email: string, password: string) {
  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    
    // If signIn failed, result will contain error information
    if (result?.error) {
      throw new Error(result.error === "CredentialsSignin" ? "Invalid email or password" : "Failed to sign in");
    }
    
    // Revalidate to ensure session is fresh
    revalidatePath("/");
    
    // Wait for session to be available (retry up to 5 times with small delay)
    let session = await auth();
    let retries = 0;
    const maxRetries = 5;
    
    while (!session?.user?.id && retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 100ms
      session = await auth();
      retries++;
    }
    
    if (!session?.user?.id) {
      // Session still not available after retries, redirect to home and let it handle routing
      redirect("/");
      return;
    }
    
    // Check if first-time user → redirect to setup (shows welcome view)
    const isFirstTime = await isFirstTimeUser(session.user.id);
    if (isFirstTime) {
      redirect("/profile/setup");
      return;
    }
    
    // Returning user - redirect to clubs (they can use Complete Profile button if needed)
    redirect("/clubs");
  } catch (error) {
    // Check if it's a Next.js redirect (not an error)
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      // Let redirect propagate
      throw error;
    }
    
    if (error instanceof AuthError) {
      throw new Error("Invalid email or password");
    }
    throw error;
  }
}

export async function deleteAccount() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const userId = session.user.id;

  // Check if user has any groups that would prevent deletion
  const userGroups = await db.group.findFirst({
    where: { createdByUserId: userId },
  });

  if (userGroups) {
    throw new Error(
      "Cannot delete account: You have groups that must be deleted first. Please transfer ownership of your groups before deleting your account.",
    );
  }

  try {
    // Delete user (cascades to accounts, sessions, memberships, votes, etc. due to onDelete: Cascade)
    await db.user.delete({
      where: { id: userId },
    });

    // Sign out the user and redirect
    await signOut({ redirectTo: "/" });
  } catch (error) {
    // Check for foreign key constraint errors
    if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
      throw new Error(
        "Cannot delete account: You have groups that must be deleted first. Please transfer ownership of your groups before deleting your account.",
      );
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
