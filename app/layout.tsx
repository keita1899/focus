import type { Metadata, Viewport } from "next";
import { AuthProvider } from "../components/AuthProvider";
import { ServiceWorkerRegistration } from "../components/ServiceWorkerRegistration";
import { auth } from "../auth";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Focus Planner",
  title: "Focus Planner",
  description: "今年・今月・今週の目標と日々のタスク管理",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Focus Planner",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#176b55",
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
        <ServiceWorkerRegistration />
        <AuthProvider session={session}>{children}</AuthProvider>
      </body>
    </html>
  );
}
