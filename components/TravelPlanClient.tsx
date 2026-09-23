"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { entryTypeLabels, formatTravelDate, normalizeTravelState, transportModeIcons, transportModes, TravelEntry, TravelEntryType, travelTotal } from "../lib/travel";

type EditTarget = { dayIndex: number; entry: TravelEntry } | null;

export default function TravelPlanClient({ initialValue, tripId }: { initialValue: unknown; tripId: string }) {
  const [state, setState] = useState(() => normalizeTravelState(initialValue));
  const [entryTypes, setEntryTypes] = useState<Record<number, TravelEntryType>>({});
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [showChecklist, setShowChecklist] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [editType, setEditType] = useState<TravelEntryType>("activity");
  const saveQueue = useRef(Promise.resolve());
  const trip = state.trips.find((item) => item.id === tripId);
  const total = useMemo(() => trip ? travelTotal(trip) : 0, [trip]);

  const update = (updater: (current: typeof state) => typeof state) => {
    setState((current) => {
      const next = updater(current);
      saveQueue.current = saveQueue.current.catch(() => undefined).then(() => fetch("/api/travel", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next), keepalive: true }).then(() => undefined));
      return next;
    });
  };
  const updateTrip = (updater: (current: NonNullable<typeof trip>) => NonNullable<typeof trip>) => update((current) => ({ ...current, trips: current.trips.map((item) => item.id === tripId ? updater(item) : item) }));
  const entryFromForm = (form: FormData, id: string): TravelEntry | null => {
    const type = String(form.get("type")) as TravelEntryType;
    const origin = String(form.get("origin") || "").trim();
    const destination = String(form.get("destination") || "").trim();
    const title = type === "transport" ? [origin, destination].filter(Boolean).join(" → ") : String(form.get("title") || "").trim();
    if (!title) return null;
    const startTime = String(form.get("startTime") || "");
    const endTime = String(form.get("endTime") || "");
    return { id, type, title, cost: Math.max(0, Number(form.get("cost")) || 0), ...(startTime ? { startTime } : {}), ...(endTime ? { endTime } : {}), ...(type === "transport" ? { origin, destination, transportMode: String(form.get("transportMode") || transportModes[0]) } : {}) };
  };
  const addEntry = (event: FormEvent<HTMLFormElement>, dayIndex: number) => {
    event.preventDefault();
    const entry = entryFromForm(new FormData(event.currentTarget), `travel-entry-${Date.now()}`);
    if (!entry) return;
    updateTrip((current) => ({ ...current, days: current.days.map((day, index) => index === dayIndex ? { ...day, entries: [...day.entries, entry] } : day) }));
    event.currentTarget.reset();
    setEntryTypes((current) => ({ ...current, [dayIndex]: "activity" }));
  };
  const editEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editTarget) return;
    const entry = entryFromForm(new FormData(event.currentTarget), editTarget.entry.id);
    if (!entry) return;
    updateTrip((current) => ({ ...current, days: current.days.map((day, index) => index === editTarget.dayIndex ? { ...day, entries: day.entries.map((item) => item.id === entry.id ? entry : item) } : day) }));
    setEditTarget(null);
  };
  const removeEntry = (dayIndex: number, entryId: string) => updateTrip((current) => ({ ...current, days: current.days.map((day, index) => index === dayIndex ? { ...day, entries: day.entries.filter((entry) => entry.id !== entryId) } : day) }));
  const moveEntry = (dayIndex: number, entryIndex: number, direction: -1 | 1) => updateTrip((current) => ({ ...current, days: current.days.map((day, index) => {
    if (index !== dayIndex) return day;
    const nextIndex = entryIndex + direction;
    if (nextIndex < 0 || nextIndex >= day.entries.length) return day;
    const entries = [...day.entries];
    [entries[entryIndex], entries[nextIndex]] = [entries[nextIndex], entries[entryIndex]];
    return { ...day, entries };
  }) }));
  const addChecklistItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get("checklistItem") || "").trim();
    if (!text) return;
    updateTrip((current) => ({ ...current, checklist: [...current.checklist, { id: `travel-check-${Date.now()}`, text, done: false }] }));
    event.currentTarget.reset();
  };
  const toggleChecklistItem = (id: string) => updateTrip((current) => ({ ...current, checklist: current.checklist.map((item) => item.id === id ? { ...item, done: !item.done } : item) }));
  const removeChecklistItem = (id: string) => updateTrip((current) => ({ ...current, checklist: current.checklist.filter((item) => item.id !== id) }));

  if (!trip) return <main className="shell travelPage"><section className="travelEmpty"><h1>旅行が見つかりません</h1><a className="travelPrimaryButton" href="/travel">旅行一覧へ</a></section></main>;
  const visibleDays = trip.mode === "stay" ? trip.days.map((day, index) => ({ day, index })).filter(({ index }) => index === activeDayIndex) : trip.days.map((day, index) => ({ day, index }));

  const transportSelect = (defaultValue?: string) => <select name="transportMode" aria-label="交通手段" defaultValue={defaultValue || transportModes[0]}>{transportModes.map((mode) => <option key={mode} value={mode}>{transportModeIcons[mode]} {mode}</option>)}</select>;

  return <main className="shell travelPage travelPlanPage">
    <header className="travelPlanHeader"><div><a className="travelBackLink" href="/travel">← 旅行一覧</a><input aria-label="旅行タイトル" value={trip.title} onChange={(event) => updateTrip((current) => ({ ...current, title: event.target.value }))} /><p>{formatTravelDate(trip.startDate)}から・{trip.mode === "daytrip" ? "日帰り" : `${trip.nights}泊${trip.nights + 1}日`}</p></div><div className="travelTotal"><span>合計金額</span><strong>¥{total.toLocaleString()}</strong></div></header>
    <nav className="travelDayTabs" aria-label="旅行日程">{trip.days.map((day, index) => <button className={!showChecklist && activeDayIndex === index ? "active" : undefined} type="button" key={day.date} onClick={() => { setActiveDayIndex(index); setShowChecklist(false); }}><strong>{index + 1}日目</strong><small>{formatTravelDate(day.date)}</small></button>)}<button className={`travelChecklistTab${showChecklist ? " active" : ""}`} type="button" onClick={() => setShowChecklist(true)}><strong>チェックリスト</strong><small>{trip.checklist.filter((item) => item.done).length}/{trip.checklist.length}</small></button></nav>
    {showChecklist ? <section className="travelChecklist"><header><h2>チェックリスト</h2><span>{trip.checklist.filter((item) => item.done).length}/{trip.checklist.length}</span></header><div className="travelChecklistBody"><form onSubmit={addChecklistItem}><input name="checklistItem" placeholder="持ち物・予約・やること" required /><button type="submit">追加</button></form>{trip.checklist.length === 0 ? <p className="emptyText">チェック項目はまだありません。</p> : <div className="travelChecklistItems">{trip.checklist.map((item) => <div className={item.done ? "done" : undefined} key={item.id}><button className="travelChecklistToggle" type="button" onClick={() => toggleChecklistItem(item.id)} aria-label={`${item.text}の完了を切り替え`} /><span>{item.text}</span><button className="travelChecklistDelete" type="button" onClick={() => removeChecklistItem(item.id)} aria-label={`${item.text}を削除`}>×</button></div>)}</div>}</div></section> : <div className="travelDays">{visibleDays.map(({ day, index: dayIndex }) => { const selectedType = entryTypes[dayIndex] || "activity"; const dayTotal = day.entries.reduce((sum, entry) => sum + entry.cost, 0); return <section className="travelDayCard" key={day.date}>
      <header><div><span>DAY {dayIndex + 1}</span><h2>{formatTravelDate(day.date)}</h2></div><strong>¥{dayTotal.toLocaleString()}</strong></header>
      <div className="travelEntryList">{day.entries.length === 0 ? <p className="emptyText">まだ予定がありません。</p> : day.entries.map((entry, entryIndex) => <article className={`travelEntry travelEntry-${entry.type}`} key={entry.id} onDoubleClick={() => { setEditTarget({ dayIndex, entry }); setEditType(entry.type); }} title="ダブルクリックで編集"><span className="travelEntryType">{entryTypeLabels[entry.type]}</span><time>{entry.startTime && entry.endTime ? `${entry.startTime}〜${entry.endTime}` : entry.startTime ? `${entry.startTime}〜` : entry.endTime ? `〜${entry.endTime}` : ""}</time><div><strong>{entry.title}</strong>{entry.transportMode && <small>{transportModeIcons[entry.transportMode] || ""} {entry.transportMode}</small>}</div><b>¥{entry.cost.toLocaleString()}</b><div className="travelEntryActions"><button type="button" disabled={entryIndex === 0} onClick={() => moveEntry(dayIndex, entryIndex, -1)} aria-label="上へ移動">↑</button><button type="button" disabled={entryIndex === day.entries.length - 1} onClick={() => moveEntry(dayIndex, entryIndex, 1)} aria-label="下へ移動">↓</button><button type="button" onClick={() => removeEntry(dayIndex, entry.id)} aria-label={`${entry.title}を削除`}>×</button></div></article>)}</div>
      <form className="travelEntryForm" onSubmit={(event) => addEntry(event, dayIndex)}><div className="travelEntryFormMain"><select name="type" value={selectedType} onChange={(event) => { const nextType = event.currentTarget.value as TravelEntryType; setEntryTypes((current) => ({ ...current, [dayIndex]: nextType })); }}><option value="activity">観光</option><option value="transport">移動</option><option value="meal">ごはん</option><option value="snack">軽食</option><option value="lodging">宿泊</option><option value="souvenir">お土産</option></select>{selectedType === "transport" && transportSelect()}{selectedType === "transport" ? <div className="travelRouteInputs"><input name="origin" placeholder="出発地" required /><span>→</span><input name="destination" placeholder="到着地" required /></div> : <input className="travelEntryTitleInput" name="title" placeholder={selectedType === "meal" ? "お店・食事" : selectedType === "snack" ? "カフェ・軽食" : selectedType === "lodging" ? "宿泊先" : selectedType === "souvenir" ? "お土産・お店" : "観光地・やること"} required />}</div><div className="travelEntryFormMeta"><div className="travelTimeRange"><input name="startTime" type="time" aria-label="開始時刻" /><span>〜</span><input name="endTime" type="time" aria-label="終了時刻" /></div><label className="travelCostInput"><span>¥</span><input name="cost" type="number" min="0" inputMode="numeric" placeholder="費用" /></label><button type="submit">追加</button></div></form>
    </section>; })}</div>}
    {editTarget && <div className="travelModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditTarget(null); }}><section className="travelEditModal" role="dialog" aria-modal="true" aria-label="予定を編集"><header><h2>予定を編集</h2><button type="button" onClick={() => setEditTarget(null)} aria-label="閉じる">×</button></header><form onSubmit={editEntry}><select name="type" value={editType} onChange={(event) => setEditType(event.currentTarget.value as TravelEntryType)}><option value="activity">観光</option><option value="transport">移動</option><option value="meal">ごはん</option><option value="snack">軽食</option><option value="lodging">宿泊</option><option value="souvenir">お土産</option></select>{editType === "transport" && transportSelect(editTarget.entry.transportMode)}{editType === "transport" ? <div className="travelRouteInputs"><input name="origin" defaultValue={editTarget.entry.origin || (editTarget.entry.type === "transport" ? editTarget.entry.title.split(" → ")[0] : "")} placeholder="出発地" required /><span>→</span><input name="destination" defaultValue={editTarget.entry.destination || (editTarget.entry.type === "transport" ? editTarget.entry.title.split(" → ")[1] : "")} placeholder="到着地" required /></div> : <input name="title" defaultValue={editTarget.entry.type === "transport" ? "" : editTarget.entry.title} placeholder="内容" required />}<div className="travelTimeRange"><input name="startTime" type="time" defaultValue={editTarget.entry.startTime || ""} aria-label="開始時刻" /><span>〜</span><input name="endTime" type="time" defaultValue={editTarget.entry.endTime || ""} aria-label="終了時刻" /></div><label className="travelCostInput"><span>¥</span><input name="cost" type="number" min="0" defaultValue={editTarget.entry.cost} inputMode="numeric" /></label><div className="travelEditActions"><button type="button" onClick={() => setEditTarget(null)}>キャンセル</button><button type="submit">保存</button></div></form></section></div>}
  </main>;
}
