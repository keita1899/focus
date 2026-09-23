"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createTravelDays, normalizeTravelState, Trip } from "../lib/travel";

export default function TravelNewClient({ initialValue }: { initialValue: unknown }) {
  const router = useRouter();
  const [mode, setMode] = useState<"daytrip" | "stay">("daytrip");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const startDate = String(form.get("startDate") || "");
    const nights = mode === "stay" ? Math.max(1, Number(form.get("nights")) || 1) : 0;
    if (!title || !startDate) return;
    setSaving(true);
    const trip: Trip = { id: `trip-${Date.now()}`, title, startDate, mode, nights, days: createTravelDays(startDate, mode === "daytrip" ? 1 : nights + 1), checklist: [], createdAt: new Date().toISOString() };
    const current = normalizeTravelState(initialValue);
    await fetch("/api/travel", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trips: [...current.trips, trip] }) });
    router.push(`/travel/${trip.id}`);
    router.refresh();
  };

  return <main className="shell travelPage travelCreatePage"><header className="travelPageHeader"><div><a className="travelBackLink" href="/travel">← 旅行一覧</a><h1>旅行を作成</h1><p>日程を決めると、日数分の計画欄を自動で用意します。</p></div></header><form className="travelCreateForm" onSubmit={submit}><label>旅行のタイトル<input name="title" placeholder="例：京都の紅葉旅行" required autoFocus /></label><label>旅行開始日<input name="startDate" type="date" required /></label><fieldset><legend>旅行タイプ</legend><div className="travelChoiceRow"><label><input type="radio" name="mode" checked={mode === "daytrip"} onChange={() => setMode("daytrip")} />日帰り</label><label><input type="radio" name="mode" checked={mode === "stay"} onChange={() => setMode("stay")} />宿泊</label></div></fieldset>{mode === "stay" && <label>宿泊数<select name="nights" defaultValue="1">{Array.from({ length: 14 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}泊{index + 2}日</option>)}</select></label>}<div className="travelFormActions"><a href="/travel">キャンセル</a><button type="submit" disabled={saving}>{saving ? "作成中…" : "計画を作成"}</button></div></form></main>;
}
