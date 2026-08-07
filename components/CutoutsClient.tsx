"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CutoutKind = "regular" | "short";
type Platform = "youtube" | "instagram" | "tiktok";

type Cutout = {
  id: string;
  kind: CutoutKind;
  title: string;
  scheduledAt: string;
  posted: boolean;
  platforms: Record<Platform, boolean>;
};

type CutoutsState = {
  items: Cutout[];
};

type CutoutsClientProps = {
  initialValue: unknown;
};

const platformLabels: Array<{ key: Platform; label: string }> = [
  { key: "youtube", label: "YouTube" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
];

function createId() {
  return `cutout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyPlatforms(): Record<Platform, boolean> {
  return { youtube: false, instagram: false, tiktok: false };
}

function formatDateTimeLocal(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function getNextShortScheduledAt(items: Cutout[]) {
  const latest = items
    .filter((item) => item.kind === "short" && item.scheduledAt)
    .map((item) => item.scheduledAt)
    .sort()
    .at(-1);

  const next = latest ? new Date(latest) : new Date();
  const isFirstForDay = !latest || next.getHours() >= 22;
  if (isFirstForDay) {
    if (latest) next.setDate(next.getDate() + 1);
    next.setHours(20, 0, 0, 0);
  } else {
    next.setHours(22, 0, 0, 0);
  }

  return formatDateTimeLocal(next);
}

function createCutout(kind: CutoutKind, items: Cutout[]): Cutout {
  return {
    id: createId(),
    kind,
    title: "",
    scheduledAt: kind === "short" ? getNextShortScheduledAt(items) : "",
    posted: false,
    platforms: emptyPlatforms(),
  };
}

function normalizeState(value: unknown): CutoutsState {
  if (!value || typeof value !== "object") return { items: [] };
  const source = value as Partial<CutoutsState>;
  if (!Array.isArray(source.items)) return { items: [] };

  return {
    items: source.items.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const sourceItem = item as Partial<Cutout>;
      if (sourceItem.kind !== "regular" && sourceItem.kind !== "short") return [];
      const platforms = sourceItem.platforms && typeof sourceItem.platforms === "object"
        ? sourceItem.platforms
        : {};
      return [{
        id: typeof sourceItem.id === "string" && sourceItem.id ? sourceItem.id : `cutout-${index}`,
        kind: sourceItem.kind,
        title: typeof sourceItem.title === "string" ? sourceItem.title : "",
        scheduledAt: typeof sourceItem.scheduledAt === "string" ? sourceItem.scheduledAt : "",
        posted: sourceItem.posted === true,
        platforms: {
          youtube: (platforms as Partial<Record<Platform, unknown>>).youtube === true,
          instagram: (platforms as Partial<Record<Platform, unknown>>).instagram === true,
          tiktok: (platforms as Partial<Record<Platform, unknown>>).tiktok === true,
        },
      }];
    }),
  };
}

function isScheduledToday(value: string) {
  return value.slice(0, 10) === formatDateTimeLocal(new Date()).slice(0, 10);
}

function isPosted(item: Cutout) {
  return item.posted || (item.kind === "short" && Object.values(item.platforms).some(Boolean));
}

export default function CutoutsClient({ initialValue }: CutoutsClientProps) {
  const [cutouts, setCutouts] = useState<CutoutsState>(() => normalizeState(initialValue));
  const [selectedKind, setSelectedKind] = useState<CutoutKind>("regular");
  const [isComposing, setIsComposing] = useState(false);
  const hasMountedRef = useRef(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const visibleItems = useMemo(
    () => cutouts.items.filter((item) => item.kind === selectedKind),
    [cutouts.items, selectedKind],
  );

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (isComposing) return;

    const timeoutId = window.setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const response = await fetch("/api/cutouts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cutouts),
          });
          if (!response.ok) throw new Error("切り抜きの保存に失敗しました。");
        });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [cutouts, isComposing]);

  function updateItem(id: string, updater: (item: Cutout) => Cutout) {
    setCutouts((current) => ({
      items: current.items.map((item) => (item.id === id ? updater(item) : item)),
    }));
  }

  function addItem() {
    setCutouts((current) => ({
      items: [...current.items, createCutout(selectedKind, current.items)],
    }));
  }

  function removeItem(id: string) {
    setCutouts((current) => ({
      items: current.items.filter((item) => item.id !== id),
    }));
  }

  return (
    <main className="shell cutoutsPage">
      <section className="roadmapHeader cutoutsHeader" aria-label="切り抜き">
        <div><h1>切り抜き</h1></div>
      </section>

      <div className="cutoutsToolbar">
        <div className="cutoutsTabs" role="tablist" aria-label="動画形式">
          <button
            className={selectedKind === "regular" ? "active" : undefined}
            type="button"
            role="tab"
            aria-selected={selectedKind === "regular"}
            onClick={() => setSelectedKind("regular")}
          >
            通常
          </button>
          <button
            className={selectedKind === "short" ? "active" : undefined}
            type="button"
            role="tab"
            aria-selected={selectedKind === "short"}
            onClick={() => setSelectedKind("short")}
          >
            ショート
          </button>
        </div>
        <button className="cutoutsAddButton" type="button" onClick={addItem}>追加</button>
      </div>

      <div className="cutoutsTableWrap">
        <table className="cutoutsTable">
          <thead>
            <tr>
              <th scope="col">No.</th>
              <th scope="col">切り抜き名</th>
              <th scope="col">投稿日時</th>
              {selectedKind === "short" && platformLabels.map((platform) => (
                <th scope="col" key={platform.key}>{platform.label}</th>
              ))}
              <th scope="col">投稿済み</th>
              <th scope="col"><span className="srOnly">削除</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item, index) => (
              <tr
                key={item.id}
                className={isPosted(item) ? "isPosted" : isScheduledToday(item.scheduledAt) ? "isToday" : undefined}
              >
                <td>{index + 1}</td>
                <td>
                  <input
                    aria-label={`${index + 1}番の切り抜き名`}
                    placeholder="切り抜き名を入力"
                    value={item.title}
                    onChange={(event) => updateItem(item.id, (current) => ({ ...current, title: event.target.value }))}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={(event) => {
                      setIsComposing(false);
                      updateItem(item.id, (current) => ({ ...current, title: event.currentTarget.value }));
                    }}
                  />
                </td>
                <td>
                  <input
                    aria-label={`${index + 1}番の投稿日時`}
                    type="datetime-local"
                    value={item.scheduledAt}
                    onChange={(event) => updateItem(item.id, (current) => ({ ...current, scheduledAt: event.target.value }))}
                  />
                </td>
                {selectedKind === "short" && platformLabels.map((platform) => (
                  <td key={platform.key}>
                    <input
                      aria-label={`${platform.label}に投稿済み`}
                      type="checkbox"
                      checked={item.platforms[platform.key]}
                      onChange={(event) => updateItem(item.id, (current) => ({
                        ...current,
                        platforms: { ...current.platforms, [platform.key]: event.target.checked },
                      }))}
                    />
                  </td>
                ))}
                <td>
                  <input
                    aria-label={`${index + 1}番を投稿済みにする`}
                    type="checkbox"
                    checked={item.posted}
                    onChange={(event) => updateItem(item.id, (current) => ({ ...current, posted: event.target.checked }))}
                  />
                </td>
                <td>
                  <button className="cutoutsRemoveButton" type="button" onClick={() => removeItem(item.id)} aria-label={`${index + 1}番を削除`}>×</button>
                </td>
              </tr>
            ))}
            {visibleItems.length === 0 && (
              <tr><td className="cutoutsEmpty" colSpan={selectedKind === "short" ? 8 : 5}>「追加」から切り抜きを登録できます。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
