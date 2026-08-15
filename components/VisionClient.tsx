"use client";

import { useEffect, useRef, useState } from "react";

import { createVisionItem, normalizeVision } from "../lib/vision";

type VisionClientProps = { initialValue: unknown };

export default function VisionClient({ initialValue }: VisionClientProps) {
  const [items, setItems] = useState(() => normalizeVision(initialValue));
  const hasMounted = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    const timeoutId = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
        const response = await fetch("/api/vision", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(items) });
        if (!response.ok) throw new Error("ビジョンの保存に失敗しました。");
      });
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [items]);

  return <main className="shell visionPage">
    <section className="roadmapHeader visionHeader"><div><h1>ビジョン</h1></div></section>
    <section className="visionList" aria-label="ビジョン一覧">
      <ol>{items.map((item, index) => <li key={item.id}>
        <div className="visionListItem">
          <span className="visionItemNumber" aria-hidden="true">{index + 1}</span>
          <input aria-label={`${index + 1}番目のビジョン`} placeholder="理想の生活や、やりたいこと" value={item.text} onChange={(event) => { const text = event.currentTarget.value; setItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, text } : currentItem)); }} />
          <button type="button" onClick={() => setItems((current) => current.length === 1 ? [{ ...current[0], text: "" }] : current.filter((currentItem) => currentItem.id !== item.id))} aria-label={`${index + 1}番目のビジョンを削除`}>×</button>
        </div>
        {index < items.length - 1 && <div className="visionInsertPoint"><button type="button" onClick={() => setItems((current) => [...current.slice(0, index + 1), createVisionItem(), ...current.slice(index + 1)])} aria-label={`${index + 1}番目と${index + 2}番目の間に追加`}>＋</button></div>}
      </li>)}</ol>
      <button className="visionAddButton" type="button" onClick={() => setItems((current) => [...current, createVisionItem()])}>＋ 追加</button>
    </section>
  </main>;
}
