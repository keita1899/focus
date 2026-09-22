"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { entryTypeLabels, formatTravelDate, normalizeTravelState, transportModes, TravelEntryType, travelTotal } from "../lib/travel";

export default function TravelPlanClient({ initialValue, tripId }: { initialValue: unknown; tripId: string }) {
  const initial = normalizeTravelState(initialValue);
  const [state, setState] = useState(initial);
  const [entryTypes, setEntryTypes] = useState<Record<number, TravelEntryType>>({});
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
  const addEntry = (event: FormEvent<HTMLFormElement>, dayIndex: number) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = String(form.get("type")) as TravelEntryType;
    const title = String(form.get("title") || "").trim();
    if (!title) return;
    const entry = { id: `travel-entry-${Date.now()}`, type, title, cost: Math.max(0, Number(form.get("cost")) || 0), ...(type === "transport" ? { transportMode: String(form.get("transportMode") || transportModes[0]) } : {}) };
    updateTrip((current) => ({ ...current, days: current.days.map((day, index) => index === dayIndex ? { ...day, entries: [...day.entries, entry] } : day) }));
    event.currentTarget.reset();
    setEntryTypes((current) => ({ ...current, [dayIndex]: "activity" }));
  };
  const removeEntry = (dayIndex: number, entryId: string) => updateTrip((current) => ({ ...current, days: current.days.map((day, index) => index === dayIndex ? { ...day, entries: day.entries.filter((entry) => entry.id !== entryId) } : day) }));

  if (!trip) return <main className="shell travelPage"><section className="travelEmpty"><h1>旅行が見つかりません</h1><a className="travelPrimaryButton" href="/travel">旅行一覧へ</a></section></main>;

  return <main className="shell travelPage"><header className="travelPlanHeader"><div><a className="travelBackLink" href="/travel">← 旅行一覧</a><input aria-label="旅行タイトル" value={trip.title} onChange={(event) => updateTrip((current) => ({ ...current, title: event.target.value }))} /><p>{formatTravelDate(trip.startDate)}から・{trip.mode === "daytrip" ? "日帰り" : `${trip.nights}泊${trip.nights + 1}日`}</p></div><div className="travelTotal"><span>合計金額</span><strong>¥{total.toLocaleString()}</strong></div></header><div className="travelDays">{trip.days.map((day, dayIndex) => { const selectedType = entryTypes[dayIndex] || "activity"; const dayTotal = day.entries.reduce((sum, entry) => sum + entry.cost, 0); return <section className="travelDayCard" key={day.date}><header><div><span>DAY {dayIndex + 1}</span><h2>{formatTravelDate(day.date)}</h2></div><strong>¥{dayTotal.toLocaleString()}</strong></header><div className="travelEntryList">{day.entries.length === 0 ? <p className="emptyText">まだ予定がありません。</p> : day.entries.map((entry) => <article className={`travelEntry travelEntry-${entry.type}`} key={entry.id}><span className="travelEntryType">{entryTypeLabels[entry.type]}</span><div><strong>{entry.title}</strong>{entry.transportMode && <small>{entry.transportMode}</small>}</div><b>¥{entry.cost.toLocaleString()}</b><button type="button" onClick={() => removeEntry(dayIndex, entry.id)} aria-label={`${entry.title}を削除`}>×</button></article>)}</div><form className="travelEntryForm" onSubmit={(event) => addEntry(event, dayIndex)}><select name="type" value={selectedType} onChange={(event) => setEntryTypes((current) => ({ ...current, [dayIndex]: event.currentTarget.value as TravelEntryType }))}><option value="activity">目的</option><option value="transport">移動</option><option value="meal">ごはん</option></select>{selectedType === "transport" && <select name="transportMode" aria-label="交通手段">{transportModes.map((mode) => <option key={mode}>{mode}</option>)}</select>}<input name="title" placeholder={selectedType === "transport" ? "移動区間・行き先" : selectedType === "meal" ? "お店・食事" : "場所・やること"} required /><label><span>¥</span><input name="cost" type="number" min="0" inputMode="numeric" placeholder="費用" /></label><button type="submit">追加</button></form></section>; })}</div></main>;
}
