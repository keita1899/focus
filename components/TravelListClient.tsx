"use client";

import { useState } from "react";
import { formatTravelDate, normalizeTravelState, travelTotal } from "../lib/travel";

export default function TravelListClient({ initialValue }: { initialValue: unknown }) {
  const [state, setState] = useState(() => normalizeTravelState(initialValue));
  const removeTrip = async (id: string) => {
    const next = { trips: state.trips.filter((trip) => trip.id !== id) };
    setState(next);
    await fetch("/api/travel", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
  };

  return <main className="shell travelPage">
    <header className="travelPageHeader"><div><p className="eyebrow">TRAVEL PLANNER</p><h1>旅行</h1><p>行きたい場所と一日の流れ、費用をまとめて計画できます。</p></div><a className="travelPrimaryButton" href="/travel/new">＋ 旅行を作成</a></header>
    {state.trips.length === 0 ? <section className="travelEmpty"><h2>旅行の計画はまだありません</h2><p>最初の旅行を作って、移動やごはん、目的を日ごとに整理しましょう。</p><a className="travelPrimaryButton" href="/travel/new">旅行を作成</a></section> : <div className="travelCardGrid">{[...state.trips].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((trip) => <article className="travelCard" key={trip.id}><div className="travelCardTop"><span>{trip.mode === "daytrip" ? "日帰り" : `${trip.nights}泊${trip.nights + 1}日`}</span><button type="button" onClick={() => void removeTrip(trip.id)} aria-label={`${trip.title}を削除`}>×</button></div><h2>{trip.title}</h2><p>{formatTravelDate(trip.startDate)}から</p><div className="travelCardSummary"><span>{trip.days.length}日分の計画</span><strong>¥{travelTotal(trip).toLocaleString()}</strong></div><a href={`/travel/${trip.id}`}>計画を開く</a></article>)}</div>}
  </main>;
}
