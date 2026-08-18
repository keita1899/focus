"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { SignOutButton } from "./AuthControls";

function getTodayLabel() {
  const today = new Date();
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][today.getDay()];
  return `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日（${weekday}）`;
}

export default function AppHeader() {
  const { data: session } = useSession();
  const [todayLabel, setTodayLabel] = useState(() => getTodayLabel());
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

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
        <nav className="topbarNav" aria-label="ナビゲーション">
          <a className="navLink homeNavLink" href="/" aria-label="ホーム" title="ホーム">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3.5 10 8.5-7 8.5 7v9.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9.5 21v-6h5v6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
          </a>
          <a className="navLink" href="/roadmap">
            ロードマップ
          </a>
          <a className="navLink" href="/learnings">
            学習
          </a>
          <a className="navLink" href="/notes">
            メモ
          </a>
          <a className="navLink" href="/daily-report">
            日報
          </a>
          <a className="navLink" href="/diary">
            日記
          </a>
        </nav>
        <div className="accountMenu">
          <button className="settingsLink" type="button" aria-label="アカウントメニュー" aria-expanded={isAccountMenuOpen} onClick={() => setIsAccountMenuOpen((current) => !current)}>⚙</button>
          {isAccountMenuOpen && <div className="accountMenuPopup">
            <span>{session?.user?.name || session?.user?.email || "ログイン中"}</span>
            <a href="/settings" onClick={() => setIsAccountMenuOpen(false)}>設定</a>
            <SignOutButton />
          </div>}
        </div>
      </div>
    </header>
  );
}
