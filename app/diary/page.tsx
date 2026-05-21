"use client";

import { useEffect, useMemo, useState } from "react";

type DiaryEntry = {
  id: string;
  date: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

const storageKey = "diary-v1";

function createId() {
  return `diary-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDiaryDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${Number(year)}年${Number(month)}月${Number(day)}日`;
}

function normalizeEntries(value: unknown): DiaryEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry, index) => {
      const item = entry as Partial<DiaryEntry>;
      const now = new Date().toISOString();
      return {
        id: item.id || `diary-${index + 1}`,
        date: item.date || getTodayKey(),
        body: item.body || "",
        createdAt: item.createdAt || now,
        updatedAt: item.updatedAt || now,
      };
    })
    .sort((first, second) => second.date.localeCompare(first.date));
}

export default function DiaryPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [activeId, setActiveId] = useState("");
  const [entryDate, setEntryDate] = useState(getTodayKey());
  const [entryBody, setEntryBody] = useState("");
  const [isReady, setIsReady] = useState(false);

  const activeEntry = useMemo(
    () => entries.find((entry) => entry.id === activeId) || null,
    [activeId, entries],
  );

  useEffect(() => {
    async function loadDiary() {
      try {
        const response = await fetch("/api/diary", { cache: "no-store" });
        const data = (await response.json()) as { value: unknown };
        const dbEntries = normalizeEntries(data.value);

        if (dbEntries.length > 0) {
          setEntries(dbEntries);
          setActiveId(dbEntries[0].id);
          setEntryDate(dbEntries[0].date);
          setEntryBody(dbEntries[0].body);
          return;
        }

        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return;
        const migratedEntries = normalizeEntries(JSON.parse(stored));
        setEntries(migratedEntries);
        if (migratedEntries[0]) {
          setActiveId(migratedEntries[0].id);
          setEntryDate(migratedEntries[0].date);
          setEntryBody(migratedEntries[0].body);
        }
        await fetch("/api/diary", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(migratedEntries),
        });
        window.localStorage.removeItem(storageKey);
      } catch {
        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return;
        const localEntries = normalizeEntries(JSON.parse(stored));
        setEntries(localEntries);
        if (localEntries[0]) {
          setActiveId(localEntries[0].id);
          setEntryDate(localEntries[0].date);
          setEntryBody(localEntries[0].body);
        }
      }
    }

    loadDiary().finally(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (!isReady) return;
    fetch("/api/diary", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entries),
    }).catch(() => undefined);
  }, [entries, isReady]);

  function selectEntry(entry: DiaryEntry) {
    setActiveId(entry.id);
    setEntryDate(entry.date);
    setEntryBody(entry.body);
  }

  function resetForm() {
    const now = new Date().toISOString();
    const nextEntry = {
      id: createId(),
      date: getTodayKey(),
      body: "",
      createdAt: now,
      updatedAt: now,
    };
    setEntries((current) =>
      [nextEntry, ...current].sort((first, second) =>
        second.date.localeCompare(first.date),
      ),
    );
    setActiveId(nextEntry.id);
    setEntryDate(nextEntry.date);
    setEntryBody(nextEntry.body);
  }

  function updateActiveEntry(nextValue: Partial<Pick<DiaryEntry, "body" | "date">>) {
    const now = new Date().toISOString();

    if (activeEntry) {
      const updatedEntry = {
        ...activeEntry,
        ...nextValue,
        updatedAt: now,
      };
      setEntries((current) =>
        current
          .map((entry) => (entry.id === activeEntry.id ? updatedEntry : entry))
          .sort((first, second) => second.date.localeCompare(first.date)),
      );
      return;
    }

    const nextEntry = {
      id: createId(),
      date: nextValue.date || entryDate,
      body: nextValue.body || "",
      createdAt: now,
      updatedAt: now,
    };
    setEntries((current) =>
      [nextEntry, ...current].sort((first, second) =>
        second.date.localeCompare(first.date),
      ),
    );
    setActiveId(nextEntry.id);
  }

  function updateEntryDate(date: string) {
    setEntryDate(date);
    updateActiveEntry({ date });
  }

  function updateEntryBody(body: string) {
    setEntryBody(body);
    updateActiveEntry({ body });
  }

  function removeEntry(entryId: string) {
    setEntries((current) => {
      const nextEntries = current.filter((entry) => entry.id !== entryId);
      const nextActive = nextEntries[0];
      setActiveId(nextActive?.id || "");
      setEntryDate(nextActive?.date || getTodayKey());
      setEntryBody(nextActive?.body || "");
      return nextEntries;
    });
  }

  if (!isReady) {
    return <main className="shell diaryPage" aria-label="読み込み中" />;
  }

  return (
    <main className="shell diaryPage">
      <section className="diaryHeader" aria-label="日記">
        <div>
          <a className="backLink" href="/">
            ← メイン
          </a>
          <h1>Diary</h1>
        </div>
        <button className="roadmapAddButton" type="button" onClick={resetForm}>
          新規
        </button>
      </section>

      <section className="diaryLayout" aria-label="日記一覧と入力">
        <aside className="diaryList" aria-label="日記一覧">
          {entries.length === 0 ? (
            <p className="emptyText">まだ日記がありません。</p>
          ) : (
            entries.map((entry) => (
              <button
                className={
                  entry.id === activeId ? "diaryListItem active" : "diaryListItem"
                }
                key={entry.id}
                type="button"
                onClick={() => selectEntry(entry)}
              >
                <time dateTime={entry.date}>{formatDiaryDate(entry.date)}</time>
                <span>{entry.body.split("\n").find(Boolean) || "無題"}</span>
              </button>
            ))
          )}
        </aside>

        <section className="diaryEditor" aria-label="日記入力">
          <div className="diaryEditorHeader">
            <input
              aria-label="日付"
              type="date"
              value={entryDate}
              onChange={(event) => updateEntryDate(event.target.value)}
            />
            {activeEntry && (
              <button
                className="memoDeleteButton"
                type="button"
                onClick={() => removeEntry(activeEntry.id)}
                aria-label="日記を削除"
                title="削除"
              >
                ×
              </button>
            )}
          </div>
          <textarea
            aria-label="日記本文"
            placeholder="今日の記録"
            value={entryBody}
            onChange={(event) => updateEntryBody(event.target.value)}
          />
        </section>
      </section>
    </main>
  );
}
