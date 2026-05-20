import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
  providers: [Google],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      return token;
    },
    authorized({ auth, request }) {
      if (request.nextUrl.pathname === "/login") {
        return true;
      }

      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
