import type { Metadata, Viewport } from "next";
import { AuthProvider } from "../components/AuthProvider";
import AppHeader from "../components/AppHeader";
import VisionReminder from "../components/VisionReminder";
import { ServiceWorkerRegistration } from "../components/ServiceWorkerRegistration";
import { auth } from "../auth";
import { getVisionState } from "../lib/server-state";
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
  const vision = await getVisionState();

  return (
    <html lang="ja">
      <body>
        <ServiceWorkerRegistration />
        <AuthProvider session={session}>
          <AppHeader />
          {children}
          <VisionReminder initialValue={vision} />
        </AuthProvider>
      </body>
    </html>
  );
}
