"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { entryTypeLabels, formatTravelDate, normalizeTravelState, transportModeIcons, transportModes, TravelEntry, TravelEntryType, travelTotal } from "../lib/travel";

type EditTarget = { dayIndex: number; entry: TravelEntry } | null;

export default function TravelPlanClient({ initialValue, tripId }: { initialValue: unknown; tripId: string }) {
  const [state, setState] = useState(() => normalizeTravelState(initialValue));
  const [entryTypes, setEntryTypes] = useState<Record<number, TravelEntryType>>({});
  const [activeDayIndex, setActiveDayIndex] = useState(0);
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

  if (!trip) return <main className="shell travelPage"><section className="travelEmpty"><h1>旅行が見つかりません</h1><a className="travelPrimaryButton" href="/travel">旅行一覧へ</a></section></main>;
  const visibleDays = trip.mode === "stay" ? trip.days.map((day, index) => ({ day, index })).filter(({ index }) => index === activeDayIndex) : trip.days.map((day, index) => ({ day, index }));

  const transportSelect = (defaultValue?: string) => <select name="transportMode" aria-label="交通手段" defaultValue={defaultValue || transportModes[0]}>{transportModes.map((mode) => <option key={mode} value={mode}>{transportModeIcons[mode]} {mode}</option>)}</select>;

  return <main className="shell travelPage">
    <header className="travelPlanHeader"><div><a className="travelBackLink" href="/travel">← 旅行一覧</a><input aria-label="旅行タイトル" value={trip.title} onChange={(event) => updateTrip((current) => ({ ...current, title: event.target.value }))} /><p>{formatTravelDate(trip.startDate)}から・{trip.mode === "daytrip" ? "日帰り" : `${trip.nights}泊${trip.nights + 1}日`}</p></div><div className="travelTotal"><span>合計金額</span><strong>¥{total.toLocaleString()}</strong></div></header>
    {trip.mode === "stay" && <nav className="travelDayTabs" aria-label="旅行日程">{trip.days.map((day, index) => <button className={activeDayIndex === index ? "active" : undefined} type="button" key={day.date} onClick={() => setActiveDayIndex(index)}><strong>{index + 1}日目</strong><small>{formatTravelDate(day.date)}</small></button>)}</nav>}
    <div className="travelDays">{visibleDays.map(({ day, index: dayIndex }) => { const selectedType = entryTypes[dayIndex] || "activity"; const dayTotal = day.entries.reduce((sum, entry) => sum + entry.cost, 0); return <section className="travelDayCard" key={day.date}>
      <header><div><span>DAY {dayIndex + 1}</span><h2>{formatTravelDate(day.date)}</h2></div><strong>¥{dayTotal.toLocaleString()}</strong></header>
      <div className="travelEntryList">{day.entries.length === 0 ? <p className="emptyText">まだ予定がありません。</p> : day.entries.map((entry) => <article className={`travelEntry travelEntry-${entry.type}`} key={entry.id} onDoubleClick={() => { setEditTarget({ dayIndex, entry }); setEditType(entry.type); }} title="ダブルクリックで編集"><span className="travelEntryType">{entryTypeLabels[entry.type]}</span><div><strong>{entry.title}</strong>{(entry.startTime || entry.endTime || entry.transportMode) && <small>{[entry.startTime && entry.endTime ? `${entry.startTime}〜${entry.endTime}` : entry.startTime ? `${entry.startTime}〜` : entry.endTime ? `〜${entry.endTime}` : "", entry.transportMode ? `${transportModeIcons[entry.transportMode] || ""} ${entry.transportMode}` : ""].filter(Boolean).join(" ・ ")}</small>}</div><b>¥{entry.cost.toLocaleString()}</b><button type="button" onClick={() => removeEntry(dayIndex, entry.id)} aria-label={`${entry.title}を削除`}>×</button></article>)}</div>
      <form className="travelEntryForm" onSubmit={(event) => addEntry(event, dayIndex)}><select name="type" value={selectedType} onChange={(event) => { const nextType = event.currentTarget.value as TravelEntryType; setEntryTypes((current) => ({ ...current, [dayIndex]: nextType })); }}><option value="activity">観光</option><option value="transport">移動</option><option value="meal">ごはん</option><option value="lodging">宿泊</option><option value="souvenir">お土産</option></select>{selectedType === "transport" && transportSelect()}{selectedType === "transport" ? <div className="travelRouteInputs"><input name="origin" placeholder="出発地" required /><span>→</span><input name="destination" placeholder="到着地" required /></div> : <input className="travelEntryTitleInput" name="title" placeholder={selectedType === "meal" ? "お店・食事" : selectedType === "lodging" ? "宿泊先" : selectedType === "souvenir" ? "お土産・お店" : "観光地・やること"} required />}<div className="travelTimeRange"><input name="startTime" type="time" aria-label="開始時刻" /><span>〜</span><input name="endTime" type="time" aria-label="終了時刻" /></div><label className="travelCostInput"><span>¥</span><input name="cost" type="number" min="0" inputMode="numeric" placeholder="費用" /></label><button type="submit">追加</button></form>
    </section>; })}</div>
    {editTarget && <div className="travelModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditTarget(null); }}><section className="travelEditModal" role="dialog" aria-modal="true" aria-label="予定を編集"><header><h2>予定を編集</h2><button type="button" onClick={() => setEditTarget(null)} aria-label="閉じる">×</button></header><form onSubmit={editEntry}><select name="type" value={editType} onChange={(event) => setEditType(event.currentTarget.value as TravelEntryType)}><option value="activity">観光</option><option value="transport">移動</option><option value="meal">ごはん</option><option value="lodging">宿泊</option><option value="souvenir">お土産</option></select>{editType === "transport" && transportSelect(editTarget.entry.transportMode)}{editType === "transport" ? <div className="travelRouteInputs"><input name="origin" defaultValue={editTarget.entry.origin || (editTarget.entry.type === "transport" ? editTarget.entry.title.split(" → ")[0] : "")} placeholder="出発地" required /><span>→</span><input name="destination" defaultValue={editTarget.entry.destination || (editTarget.entry.type === "transport" ? editTarget.entry.title.split(" → ")[1] : "")} placeholder="到着地" required /></div> : <input name="title" defaultValue={editTarget.entry.type === "transport" ? "" : editTarget.entry.title} placeholder="内容" required />}<div className="travelTimeRange"><input name="startTime" type="time" defaultValue={editTarget.entry.startTime || ""} aria-label="開始時刻" /><span>〜</span><input name="endTime" type="time" defaultValue={editTarget.entry.endTime || ""} aria-label="終了時刻" /></div><label className="travelCostInput"><span>¥</span><input name="cost" type="number" min="0" defaultValue={editTarget.entry.cost} inputMode="numeric" /></label><div className="travelEditActions"><button type="button" onClick={() => setEditTarget(null)}>キャンセル</button><button type="submit">保存</button></div></form></section></div>}
  </main>;
}
