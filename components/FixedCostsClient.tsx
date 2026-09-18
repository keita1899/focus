"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type FixedCost = { id: string; name: string; amount: number; isSubscription: boolean; isActive: boolean };
type FixedCostsState = { items: FixedCost[] };

function createId() { return `fixed-cost-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function normalizeState(value: unknown): FixedCostsState {
  if (!value || typeof value !== "object") return { items: [] };
  const source = value as Partial<FixedCostsState>;
  return { items: Array.isArray(source.items) ? source.items.filter((item): item is FixedCost => Boolean(item) && typeof item.id === "string" && typeof item.name === "string" && typeof item.amount === "number").map((item) => ({ ...item, amount: Math.max(0, item.amount), isSubscription: Boolean(item.isSubscription), isActive: item.isActive !== false })) : [] };
}

function save(value: string) { return fetch("/api/fixed-costs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: value, keepalive: true }).catch(() => undefined); }

export default function FixedCostsClient({ initialValue }: { initialValue: unknown }) {
  const [state, setState] = useState(() => normalizeState(initialValue));
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubscription, setIsSubscription] = useState(false);
  const hasMounted = useRef(false);
  const pending = useRef<string | null>(null);
  const activeItems = state.items.filter((item) => item.isActive);
  const inactiveItems = state.items.filter((item) => !item.isActive);
  const total = activeItems.reduce((sum, item) => sum + item.amount, 0);

  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    const value = JSON.stringify(state); pending.current = value;
    void save(value).then(() => { if (pending.current === value) pending.current = null; });
  }, [state]);
  useEffect(() => () => { if (pending.current) void save(pending.current); }, []);

  function update(id: string, value: Partial<FixedCost>) { setState((current) => ({ items: current.items.map((item) => item.id === id ? { ...item, ...value } : item) })); }
  function add(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!name.trim()) return; setState((current) => ({ items: [...current.items, { id: createId(), name: name.trim(), amount: Math.max(0, Number(amount) || 0), isSubscription, isActive: true }] })); setName(""); setAmount(""); setIsSubscription(false); }
  function renderRows(items: FixedCost[], empty: string) { return items.length ? <div className="fixedCostRows">{items.map((item) => <div className="fixedCostRow" key={item.id}><input className="fixedCostActive" type="checkbox" checked={item.isActive} onChange={(event) => update(item.id, { isActive: event.currentTarget.checked })} aria-label={`${item.name}を支払い中にする`} /><input className="fixedCostName" value={item.name} onChange={(event) => update(item.id, { name: event.currentTarget.value })} aria-label="固定費名" /><input className="fixedCostAmount" type="number" min="0" value={item.amount} onChange={(event) => update(item.id, { amount: Math.max(0, Number(event.currentTarget.value) || 0) })} aria-label={`${item.name}の金額`} /><span>円</span><label className="fixedCostSubscription"><input type="checkbox" checked={item.isSubscription} onChange={(event) => update(item.id, { isSubscription: event.currentTarget.checked })} /> サブスク</label><button type="button" onClick={() => setState((current) => ({ items: current.items.filter((entry) => entry.id !== item.id) }))} aria-label={`${item.name}を削除`}>×</button></div>)}</div> : <p className="emptyText">{empty}</p>; }

  return <section className="fixedCostsPanel" aria-label="固定費リスト"><div className="fixedCostsHeader"><p>現在支払っている固定費</p></div><form className="fixedCostAddForm" onSubmit={add}><input placeholder="固定費名" value={name} onChange={(event) => setName(event.currentTarget.value)} /><input type="number" min="0" placeholder="金額" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} /><label><input type="checkbox" checked={isSubscription} onChange={(event) => setIsSubscription(event.currentTarget.checked)} /> サブスク</label><button type="submit">＋ 追加</button></form><section><h2>支払い中</h2>{renderRows(activeItems, "支払い中の固定費はありません。")}<strong className="fixedCostsTotal">合計 ¥{total.toLocaleString("ja-JP")}<small>/ 月</small></strong></section><section className="inactiveFixedCosts"><h2>現在は支払っていない固定費</h2>{renderRows(inactiveItems, "現在は支払っていない固定費はありません。")}</section></section>;
}
