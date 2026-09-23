"use client";

import { useState } from "react";
import { formatTravelDate, normalizeTravelState } from "../lib/travel";

export default function TravelListClient({ initialValue }: { initialValue: unknown }) {
  const [state, setState] = useState(() => normalizeTravelState(initialValue));
  const removeTrip = async (id: string) => {
    const next = { trips: state.trips.filter((trip) => trip.id !== id) };
    setState(next);
    await fetch("/api/travel", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
  };

  const todayKey = new Date().toISOString().slice(0, 10);
  const trips = [...state.trips].sort((left, right) => {
    const leftPast = left.startDate < todayKey;
    const rightPast = right.startDate < todayKey;
    if (leftPast !== rightPast) return leftPast ? 1 : -1;
    return leftPast ? right.startDate.localeCompare(left.startDate) : left.startDate.localeCompare(right.startDate);
  });

  return <main className="shell travelPage travelListPage">
    <header className="travelPageHeader"><h1>旅行一覧</h1><a className="travelPrimaryButton" href="/travel/new">＋ 旅行を作成</a></header>
    {trips.length === 0 ? <section className="travelEmpty"><h2>旅行の計画はまだありません</h2><p>最初の旅行を作って、移動やごはん、観光を日ごとに整理しましょう。</p><a className="travelPrimaryButton" href="/travel/new">旅行を作成</a></section> : <div className="travelCardGrid">{trips.map((trip) => { const endDate = trip.days.at(-1)?.date || trip.startDate; return <article className="travelCardWrap" key={trip.id}><a className="travelCard" href={`/travel/${trip.id}`}><span className="travelCardType">{trip.mode === "daytrip" ? "日帰り" : `${trip.nights}泊${trip.nights + 1}日`}</span><time>{trip.startDate === endDate ? formatTravelDate(trip.startDate) : `${formatTravelDate(trip.startDate)}〜${formatTravelDate(endDate)}`}</time><h2>{trip.title}</h2></a><button className="travelCardDelete" type="button" onClick={() => void removeTrip(trip.id)} aria-label={`${trip.title}を削除`}>×</button></article>; })}</div>}
  </main>;
}
