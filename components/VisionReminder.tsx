"use client";

import { useEffect, useState } from "react";

import { MarkdownPreview } from "./MarkdownMemoClient";

type VisionReminderProps = { initialValue: unknown };
const reminderStorageKey = "vision-last-confirmed-date-v1";

function getDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function VisionReminder({ initialValue }: VisionReminderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const vision = typeof initialValue === "string" ? initialValue : "";

  useEffect(() => {
    try {
      if (window.localStorage.getItem(reminderStorageKey) !== getDateKey()) setIsOpen(true);
    } catch {
      setIsOpen(true);
    }
  }, []);

  if (!isOpen) return null;
  return <div className="visionModalBackdrop" role="presentation">
    <section className="visionModal" role="dialog" aria-modal="true" aria-label="今日のビジョン">
      <header><h2>今日のビジョン</h2></header>
      <article className="visionModalContent"><MarkdownPreview markdown={vision || "ビジョンページから、理想の生活ややりたいことを書いてみましょう。"} onToggleChecklist={() => undefined} /></article>
      <button type="button" onClick={() => { try { window.localStorage.setItem(reminderStorageKey, getDateKey()); } finally { setIsOpen(false); } }}>確認</button>
    </section>
  </div>;
}
