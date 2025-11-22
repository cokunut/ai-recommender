import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";

import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );

        if (!isValidPassword) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    GoogleProvider,
  ],
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt", // Use JWT tokens instead of database sessions (required for credentials provider)
  },
  callbacks: {
    /**
     * Session Callback
     * Called whenever a session is accessed (e.g., via `auth()` or `useSession()`)
     * 
     * Flow:
     * 1. Client requests session data
     * 2. NextAuth reads the JWT token from the cookie
     * 3. This callback runs with the decoded JWT token
     * 4. You can add/modify session properties here
     * 5. Returns the session object that will be available to your app
     * 
     * @param session - The current session object (initially from JWT)
     * @param token - The decoded JWT token (contains user data)
     * @returns The modified session object
     */
    session: ({ session, token }) => {
      // Add user.id to session (JWT stores it in token.sub)
      // This ensures we always have access to user.id in the session
      if (session.user && token.sub) {
        session.user.id = token.sub; // token.sub contains the user ID
      }
      return session;
    },

    /**
     * JWT Callback
     * Called when:
     * 1. A user signs in (creates the initial JWT)
     * 2. A session is accessed and needs to be refreshed
     * 
     * Flow:
     * 1. User signs in → NextAuth calls this callback
     * 2. You can add data to the JWT token here
     * 3. Token is encoded and stored in a cookie
     * 4. Later, when session is accessed, token is decoded and passed to session callback
     * 
     * @param token - The JWT token being created/updated
     * @param user - The user object (only present on initial sign-in)
     * @param account - OAuth account info (only present on OAuth sign-in)
     * @returns The modified JWT token
     */
    jwt: ({ token, user, account }) => {
      // On initial sign-in, user object is available
      // 
      // For EMAIL/PASSWORD:
      // user = {
      //   id: "clx123abc...",      // Database ID (cuid)
      //   email: "user@example.com",
      //   name: "John Doe",
      //   image: null
      // }
      // account = undefined (credentials provider doesn't create account records)
      //
      // For GOOGLE OAUTH:
      // user = {
      //   id: "clx456def...",       // Database ID (cuid) - created by PrismaAdapter
      //   email: "user@gmail.com",  // From Google
      //   name: "John Doe",         // From Google profile
      //   image: "https://...",     // Google profile picture URL
      //   emailVerified: Date       // Verified by Google
      // }
      // account = {
      //   provider: "google",
      //   type: "oauth",
      //   providerAccountId: "1234567890",  // Google user ID
      //   access_token: "ya29...",
      //   refresh_token: "ya29...",
      //   expires_at: 1734892800,
      //   ...
      // }
      
      // Store the user ID in token.sub (standard JWT field for "subject")
      if (user) {
        token.sub = user.id; // This will be available in session callback later
      }
      
      // For OAuth providers (Google), the PrismaAdapter automatically:
      // - Creates/updates the user in the database
      // - Stores OAuth account info in Account table
      // We just need to ensure the user ID flows through to the token
      if (account && account.provider !== "credentials") {
        // PrismaAdapter handles user creation/update automatically
        // The user.id from the adapter will be in the 'user' param above
      }
      
      return token;
    },
  },
  pages: {
    signIn: "/",
  },
} satisfies NextAuthConfig;
