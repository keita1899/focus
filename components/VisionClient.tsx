"use client";

import { useEffect, useRef, useState } from "react";

type VisionClientProps = { initialValue: unknown };

const defaultVision = `# 私のビジョン

ここに、理想の生活や実現したいやりたいことを書きます。
`;

function normalizeVision(value: unknown) {
  return typeof value === "string" ? value : defaultVision;
}

export default function VisionClient({ initialValue }: VisionClientProps) {
  const [vision, setVision] = useState(() => normalizeVision(initialValue));
  const hasMounted = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    const timeoutId = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
        const response = await fetch("/api/vision", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vision) });
        if (!response.ok) throw new Error("ビジョンの保存に失敗しました。");
      });
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [vision]);

  return <main className="shell visionPage">
    <section className="roadmapHeader visionHeader"><div><h1>ビジョン</h1></div></section>
    <textarea className="visionEditor" aria-label="ビジョン" value={vision} onChange={(event) => setVision(event.currentTarget.value)} />
  </main>;
}
