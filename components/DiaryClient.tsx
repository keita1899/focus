"use client";

import { useEffect, useMemo, useState } from "react";

type DiaryEntry = {
  id: string;
  date: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type TopicResponse = {
  date: string;
  topicId: string;
  body: string;
  updatedAt: string;
};

type DiaryState = {
  entries: DiaryEntry[];
  topicResponses: TopicResponse[];
};

type DiaryPageProps = {
  initialValue: unknown;
};

const storageKey = "diary-v1";
const dailyTopics = [
  "最近、買ってよかったものは何ですか？",
  "理想の休日をどのように過ごしたいですか？",
  "子どもの頃に夢中になっていたことは何ですか？",
  "今住んでいる場所の好きなところを紹介してください。",
  "最近うれしかった出来事は何ですか？",
  "朝型と夜型のどちらが自分に合っていますか？",
  "人から言われて印象に残っている言葉はありますか？",
  "今、一つだけ新しい習慣を作るなら何にしますか？",
  "好きな食べ物の魅力を、食べたことがない人に説明してください。",
  "旅行で計画を立てる派ですか、行き当たりばったり派ですか？",
  "最近、自分が成長したと感じたことは何ですか？",
  "仕事や勉強に集中するために工夫していることは何ですか？",
  "一日だけ別の職業を体験できるなら何を選びますか？",
  "自分にとって居心地のよい場所とはどんな場所ですか？",
  "現金とキャッシュレス決済のどちらが使いやすいですか？",
  "誰かにおすすめしたい本・映画・動画はありますか？",
  "苦手なことに取り組むとき、どうやって気持ちを整えますか？",
  "一か月の休みがあったら何をしたいですか？",
  "自分が大切にしている時間について話してください。",
  "友人を作るうえで大切だと思うことは何ですか？",
  "最近知って驚いたことは何ですか？",
  "都会と地方なら、どちらに住みたいですか？",
  "昔の自分に一つ助言できるなら何を伝えますか？",
  "毎日続けていること、または続けたいことは何ですか？",
  "好きな季節と、その理由を教えてください。",
  "一日の中で最も好きな時間帯はいつですか？",
  "自分の長所を具体的な経験とともに説明してください。",
  "最近やめてよかったことはありますか？",
  "時間とお金なら、今はどちらを大切にしたいですか？",
  "初対面の人と話すときに意識していることはありますか？",
  "地元のおすすめスポットを一つ紹介してください。",
  "失敗から学んだことを一つ挙げてください。",
  "スマートフォンを使わない一日をどう過ごしますか？",
  "自分にとって『よい仕事』とはどんな仕事ですか？",
  "最近、誰かに感謝したことは何ですか？",
  "家で過ごすのと外出するのは、どちらが好きですか？",
  "新しく学んでみたいことと、その理由は何ですか？",
  "予定が急に空いたら何をしますか？",
  "自分の趣味を知らない人に分かりやすく説明してください。",
  "十年後、どのような毎日を過ごしていたいですか？",
];

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

function normalizeState(value: unknown): DiaryState {
  const entriesValue = Array.isArray(value) ? value : value && typeof value === "object" ? (value as Partial<DiaryState>).entries : [];
  const responsesValue = value && !Array.isArray(value) && typeof value === "object" ? (value as Partial<DiaryState>).topicResponses : [];
  const topicResponses = Array.isArray(responsesValue) ? responsesValue.filter((item): item is TopicResponse => Boolean(item) && typeof item.date === "string" && typeof item.topicId === "string" && typeof item.body === "string") : [];
  return { entries: normalizeEntries(entriesValue), topicResponses };
}

function getDailyTopic(dateKey: string) {
  const hash = Array.from(dateKey).reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 7);
  const index = hash % dailyTopics.length;
  return { id: `topic-${index}`, text: dailyTopics[index] };
}

export default function DiaryClient({ initialValue }: DiaryPageProps) {
  const initialState = useMemo(() => normalizeState(initialValue), [initialValue]);
  const initialEntries = initialState.entries;
  const firstEntry = initialEntries[0] || null;
  const [entries, setEntries] = useState<DiaryEntry[]>(initialEntries);
  const [topicResponses, setTopicResponses] = useState<TopicResponse[]>(initialState.topicResponses);
  const [activeId, setActiveId] = useState(firstEntry?.id || "");
  const [entryDate, setEntryDate] = useState(firstEntry?.date || getTodayKey());
  const [entryBody, setEntryBody] = useState(firstEntry?.body || "");
  const [isReady, setIsReady] = useState(initialValue !== null);
  const todayKey = getTodayKey();
  const todayTopic = getDailyTopic(todayKey);
  const todayTopicBody = topicResponses.find((item) => item.date === todayKey)?.body || "";

  const activeEntry = useMemo(
    () => entries.find((entry) => entry.id === activeId) || null,
    [activeId, entries],
  );

  useEffect(() => {
    if (initialValue !== null) return;

    async function loadDiary() {
      try {
        const response = await fetch("/api/diary", { cache: "no-store" });
        const data = (await response.json()) as { value: unknown };
        const dbState = normalizeState(data.value);
        const dbEntries = dbState.entries;

        if (dbEntries.length > 0 || dbState.topicResponses.length > 0) {
          setEntries(dbEntries);
          setTopicResponses(dbState.topicResponses);
          setActiveId(dbEntries[0].id);
          setEntryDate(dbEntries[0].date);
          setEntryBody(dbEntries[0].body);
          return;
        }

        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return;
        const migratedState = normalizeState(JSON.parse(stored));
        const migratedEntries = migratedState.entries;
        setEntries(migratedEntries);
        setTopicResponses(migratedState.topicResponses);
        if (migratedEntries[0]) {
          setActiveId(migratedEntries[0].id);
          setEntryDate(migratedEntries[0].date);
          setEntryBody(migratedEntries[0].body);
        }
        await fetch("/api/diary", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(migratedState),
        });
        window.localStorage.removeItem(storageKey);
      } catch {
        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return;
        const localState = normalizeState(JSON.parse(stored));
        const localEntries = localState.entries;
        setEntries(localEntries);
        setTopicResponses(localState.topicResponses);
        if (localEntries[0]) {
          setActiveId(localEntries[0].id);
          setEntryDate(localEntries[0].date);
          setEntryBody(localEntries[0].body);
        }
      }
    }

    loadDiary().finally(() => setIsReady(true));
  }, [initialValue]);

  useEffect(() => {
    if (!isReady) return;
    fetch("/api/diary", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries, topicResponses }),
    }).catch(() => undefined);
  }, [entries, topicResponses, isReady]);

  function updateTopicResponse(body: string) {
    setTopicResponses((current) => {
      const response = { date: todayKey, topicId: todayTopic.id, body, updatedAt: new Date().toISOString() };
      return current.some((item) => item.date === todayKey) ? current.map((item) => item.date === todayKey ? response : item) : [response, ...current];
    });
  }

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

  return (
    <main className="shell diaryPage">
      <section className="diaryHeader" aria-label="日記">
        <div>
          <h1>Diary</h1>
        </div>
        <button className="roadmapAddButton" type="button" onClick={resetForm}>
          新規
        </button>
      </section>

      <section className="diaryDailyTopic" aria-labelledby="daily-topic-title">
        <div>
          <span>今日の話題</span>
          <h2 id="daily-topic-title">{todayTopic.text}</h2>
          <p>結論、理由、具体例、まとめの順で書いてみましょう。</p>
        </div>
        <textarea aria-label="今日の話題への回答" placeholder="自分の考えを書いてみる" value={todayTopicBody} onChange={(event) => updateTopicResponse(event.currentTarget.value)} />
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
