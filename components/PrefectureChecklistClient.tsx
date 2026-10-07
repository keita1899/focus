"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type ChecklistKind = "place" | "food" | "activity" | "other";
type ChecklistItem = { id: string; title: string; kind: ChecklistKind; done: boolean };
type PrefectureEntry = { visited: boolean; items: ChecklistItem[] };
type PrefectureState = { prefectures: Record<string, PrefectureEntry> };

const regions = [
  { name: "北海道", prefectures: ["北海道"] },
  { name: "東北", prefectures: ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"] },
  { name: "関東", prefectures: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"] },
  { name: "中部", prefectures: ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"] },
  { name: "近畿", prefectures: ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"] },
  { name: "中国", prefectures: ["鳥取県", "島根県", "岡山県", "広島県", "山口県"] },
  { name: "四国", prefectures: ["徳島県", "香川県", "愛媛県", "高知県"] },
  { name: "九州・沖縄", prefectures: ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"] },
] as const;

const prefectureNames = regions.flatMap((region) => [...region.prefectures]);
const kindLabels: Record<ChecklistKind, string> = { place: "訪れたい場所", food: "食べたい物", activity: "やりたいこと", other: "その他" };

function createId() { return `prefecture-item-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function emptyEntry(): PrefectureEntry { return { visited: false, items: [] }; }
function normalizeState(value: unknown): PrefectureState {
  const source = value && typeof value === "object" ? value as { prefectures?: unknown } : {};
  const stored = source.prefectures && typeof source.prefectures === "object" ? source.prefectures as Record<string, unknown> : {};
  return {
    prefectures: Object.fromEntries(prefectureNames.map((name) => {
      const raw = stored[name] && typeof stored[name] === "object" ? stored[name] as Partial<PrefectureEntry> : {};
      const items = Array.isArray(raw.items) ? raw.items.flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const current = item as Partial<ChecklistItem>;
        if (typeof current.title !== "string") return [];
        const kind: ChecklistKind = current.kind === "food" || current.kind === "activity" || current.kind === "other" ? current.kind : "place";
        return [{ id: typeof current.id === "string" ? current.id : `${name}-${index}`, title: current.title, kind, done: Boolean(current.done) }];
      }) : [];
      return [name, { visited: Boolean(raw.visited), items }];
    })),
  };
}

function save(value: string) { return fetch("/api/prefecture-list", { method: "PUT", headers: { "Content-Type": "application/json" }, body: value, keepalive: true }).catch(() => undefined); }

export default function PrefectureChecklistClient({ initialValue }: { initialValue: unknown }) {
  const [state, setState] = useState(() => normalizeState(initialValue));
  const [selectedPrefecture, setSelectedPrefecture] = useState<string>(prefectureNames[0]);
  const [kind, setKind] = useState<ChecklistKind>("place");
  const [title, setTitle] = useState("");
  const hasMounted = useRef(false);
  const pending = useRef<string | null>(null);
  const entry = state.prefectures[selectedPrefecture] || emptyEntry();
  const visitedCount = prefectureNames.filter((name) => state.prefectures[name]?.visited).length;
  const sortedItems = [...entry.items].sort((left, right) => Number(left.done) - Number(right.done));

  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    const value = JSON.stringify(state); pending.current = value;
    void save(value).then(() => { if (pending.current === value) pending.current = null; });
  }, [state]);
  useEffect(() => () => { if (pending.current) void save(pending.current); }, []);

  function updateEntry(updater: (current: PrefectureEntry) => PrefectureEntry) {
    setState((current) => ({ ...current, prefectures: { ...current.prefectures, [selectedPrefecture]: updater(current.prefectures[selectedPrefecture] || emptyEntry()) } }));
  }
  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const nextTitle = title.trim(); if (!nextTitle) return;
    updateEntry((current) => ({ ...current, items: [...current.items, { id: createId(), title: nextTitle, kind, done: false }] }));
    setTitle("");
  }

  return <section className="prefectureChecklistPanel" aria-label="47都道府県リスト">
    <header className="prefectureChecklistHeader"><div><h1>47都道府県リスト</h1><p>都道府県ごとに、行きたい場所や食べたい物を記録できます。</p></div><strong>{visitedCount}<span>/47</span></strong></header>
    <div className="prefectureChecklistLayout">
      <aside className="prefecturePicker" aria-label="都道府県を選択">{regions.map((region) => <section key={region.name}><h2>{region.name}</h2><div>{region.prefectures.map((name) => <button className={`${name === selectedPrefecture ? "active" : ""}${state.prefectures[name]?.visited ? " visited" : ""}`} type="button" key={name} onClick={() => setSelectedPrefecture(name)}><span aria-hidden="true" />{name}</button>)}</div></section>)}</aside>
      <section className="prefectureChecklistContent">
        <header><h2>{selectedPrefecture}</h2><label><input type="checkbox" checked={entry.visited} onChange={(event) => { const visited = event.currentTarget.checked; updateEntry((current) => ({ ...current, visited })); }} />訪問済み</label></header>
        <form className="prefectureChecklistForm" onSubmit={addItem}><select aria-label="チェック項目の種類" value={kind} onChange={(event) => setKind(event.currentTarget.value as ChecklistKind)}>{Object.entries(kindLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><input aria-label={`${selectedPrefecture}のチェック項目`} value={title} onChange={(event) => setTitle(event.currentTarget.value)} placeholder="記録したいこと" /><button type="submit">追加</button></form>
        <div className="prefectureChecklistItems">{sortedItems.length ? sortedItems.map((item) => <div className={item.done ? "done" : ""} key={item.id}><input type="checkbox" checked={item.done} onChange={() => updateEntry((current) => ({ ...current, items: current.items.map((entryItem) => entryItem.id === item.id ? { ...entryItem, done: !entryItem.done } : entryItem) }))} aria-label={`${item.title}の完了を切り替え`} /><span className={`prefectureKindTag is-${item.kind}`}>{kindLabels[item.kind]}</span><span>{item.title}</span><button type="button" onClick={() => updateEntry((current) => ({ ...current, items: current.items.filter((entryItem) => entryItem.id !== item.id) }))} aria-label={`${item.title}を削除`}>×</button></div>) : <p className="emptyText">チェック項目はまだありません。</p>}</div>
      </section>
    </div>
  </section>;
}
