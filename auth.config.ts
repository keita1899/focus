import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      if (request.nextUrl.pathname === "/login") {
        return true;
      }

      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
