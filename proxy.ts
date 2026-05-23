import NextAuth from "next-auth";

import { authConfig } from "./auth.config";

export const proxy = NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon.svg|maskable-icon.svg).*)",
  ],
};
