import type { Metadata } from "next";
import { AuthProvider } from "../components/AuthProvider";
import { auth } from "../auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Focus Planner",
  description: "今年・今月・今週の目標と日々のタスク管理",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="ja">
      <body>
        <AuthProvider session={session}>{children}</AuthProvider>
      </body>
    </html>
  );
}
