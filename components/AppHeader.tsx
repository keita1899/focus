"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { SignOutButton } from "./AuthControls";

function getTodayLabel() {
  const today = new Date();
  return `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
}

export default function AppHeader() {
  const { data: session } = useSession();
  const [todayLabel, setTodayLabel] = useState(() => getTodayLabel());

  useEffect(() => {
    let timeoutId: number | null = null;

    const scheduleNextTick = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);

      timeoutId = window.setTimeout(() => {
        setTodayLabel(getTodayLabel());
        scheduleNextTick();
      }, Math.max(0, nextMidnight.getTime() - now.getTime()));
    };

    scheduleNextTick();
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <header className="topbar">
      <div className="headerDateBlock">
        <time className="todayLabel" dateTime={todayLabel}>
          {todayLabel}
        </time>
      </div>
      <div className="topbarLinks">
        {session?.user && (
          <span className="userBadge">
            {session.user.name || session.user.email || "ログイン中"}
          </span>
        )}
        <nav className="topbarNav" aria-label="ナビゲーション">
          <a className="navLink" href="/">
            ホーム
          </a>
          <a className="navLink" href="/roadmap">
            ロードマップ
          </a>
          <a className="navLink" href="/notes">
            メモ
          </a>
          <a className="navLink" href="/diary">
            日記
          </a>
        </nav>
        <div className="topbarAuth">
          <a className="settingsLink" href="/settings" aria-label="設定">
            ⚙
          </a>
          <SignOutButton className="navLink authNavButton" />
        </div>
      </div>
    </header>
  );
}
