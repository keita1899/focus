"use client";

import { signIn, signOut } from "next-auth/react";

type AuthButtonProps = {
  className?: string;
};

export function GoogleSignInButton({ className }: AuthButtonProps) {
  return (
    <button className={className} type="button" onClick={() => signIn("google")}>
      Googleでログイン
    </button>
  );
}

export function SignOutButton({ className }: AuthButtonProps) {
  return (
    <button className={className} type="button" onClick={() => signOut()}>
      ログアウト
    </button>
  );
}
