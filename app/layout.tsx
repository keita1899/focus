import type { Metadata } from "next";
import { AuthProvider } from "../components/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Focus Planner",
  description: "今年・今月・今週の目標と日々のタスク管理",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
