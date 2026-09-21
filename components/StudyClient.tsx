"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Level = 0 | 1 | 2;
type Card = { id: string; question: string; answer: string; notes: string; source: string; category: string; dueDate: string; level: Level; lastReviewed?: string };
type State = { intervals: number[]; categories: string[]; cards: Card[] };

const defaultCategories = ["未分類"];
const defaults: State = { intervals: [0, 1, 3, 7, 30], categories: defaultCategories, cards: [] };
const choices = [0, 1, 3, 7, 30];
const intervalLabel = (value: number) => value === 0 ? "当日" : value === 1 ? "翌日" : value === 3 ? "3日後" : value === 7 ? "1週間後" : "1か月後";
const date = (offset = 0) => { const value = new Date(); value.setDate(value.getDate() + offset); return value.toISOString().slice(0, 10); };

function normalize(value: unknown): State {
  if (!value || typeof value !== "object") return defaults;
  const source = value as Partial<State>;
  const cards = Array.isArray(source.cards)
    ? source.cards.filter((card): card is Card => Boolean(card) && typeof card.id === "string").map((card) => ({ ...card, answer: card.answer || "", notes: card.notes || "", source: card.source || "", category: card.category || "未分類", dueDate: card.dueDate || date(), level: (card.level === 1 || card.level === 2 ? card.level : 0) as Level }))
    : [];
  const savedCategories = Array.isArray(source.categories) ? source.categories.filter((category): category is string => typeof category === "string" && Boolean(category.trim())).map((category) => category.trim()) : [];
  const categories = Array.from(new Set([...savedCategories, ...cards.map((card) => card.category)]));
  return {
    intervals: Array.isArray(source.intervals) && source.intervals.length ? source.intervals.filter((item): item is number => typeof item === "number").sort((left, right) => left - right) : defaults.intervals,
    categories: categories.length ? categories : defaultCategories,
    cards,
  };
}

function save(value: State) { return fetch("/api/study", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value), keepalive: true }).catch(() => undefined); }

export default function StudyClient({ initialValue }: { initialValue: unknown }) {
  const [state, setState] = useState(() => normalize(initialValue));
  const [tab, setTab] = useState<"review" | "add" | "settings">("review");
  const [category, setCategory] = useState("すべて");
  const [newCategory, setNewCategory] = useState("");
  const [revealed, setRevealed] = useState(false);
  const mounted = useRef(false);
  const visible = state.cards.filter((card) => category === "すべて" || card.category === category);
  const due = useMemo(() => visible.filter((card) => card.dueDate <= date() && card.lastReviewed !== date()), [visible]);
  const card = due[0];

  useEffect(() => { if (!mounted.current) { mounted.current = true; return; } void save(state); }, [state]);

  const review = (level: Level) => {
    if (!card) return;
    const interval = state.intervals[level === 0 ? 0 : level === 1 ? Math.floor((state.intervals.length - 1) / 2) : state.intervals.length - 1] ?? 1;
    setState((current) => ({ ...current, cards: current.cards.map((item) => item.id === card.id ? { ...item, level, dueDate: date(interval), lastReviewed: date() } : item) }));
    setRevealed(false);
  };

  const addCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    setState((current) => current.categories.includes(name) ? current : { ...current, categories: [...current.categories, name] });
    setCategory(name);
    setNewCategory("");
  };

  const removeCategory = (name: string) => {
    setState((current) => {
      const remaining = current.categories.filter((item) => item !== name);
      const fallback = remaining[0] || "未分類";
      return {
        ...current,
        categories: remaining.length ? remaining : [fallback],
        cards: current.cards.map((card) => card.category === name ? { ...card, category: fallback } : card),
      };
    });
    if (category === name) setCategory("すべて");
  };

  const removeCard = (id: string) => {
    setState((current) => ({ ...current, cards: current.cards.filter((item) => item.id !== id) }));
    setRevealed(false);
  };

  const addCard = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const question = String(form.get("question") || "").trim();
    if (!question) return;
    setState((current) => ({ ...current, cards: [...current.cards, { id: `study-${Date.now()}`, question, answer: String(form.get("answer") || ""), notes: String(form.get("notes") || ""), source: String(form.get("source") || ""), category: String(form.get("category") || current.categories[0] || "未分類"), dueDate: date(), level: 0 }] }));
    event.currentTarget.reset();
    setTab("review");
  };

  return <main className="studyShell">
    <header><div><p>公認会計士</p><h1>学習モード</h1></div><strong>今日の復習 {due.length}件</strong></header>
    <div className="studyLayout">
      <aside className="studySidebar">
        <div className="studyCategoryList"><button className={category === "すべて" ? "active" : undefined} onClick={() => setCategory("すべて")}>すべて</button>{state.categories.map((item) => <div className={`studyCategoryItem${category === item ? " active" : ""}`} key={item}><button type="button" onClick={() => setCategory(item)}>{item}</button><button className="studyCategoryDelete" type="button" onClick={() => removeCategory(item)} aria-label={`${item}を削除`}>×</button></div>)}</div>
        <form className="studyCategoryForm" onSubmit={addCategory}><div><input id="new-study-category" value={newCategory} onChange={(event) => setNewCategory(event.currentTarget.value)} placeholder="カテゴリー名" aria-label="新しいカテゴリー名" /><button type="submit" aria-label="カテゴリーを追加">＋</button></div></form>
      </aside>
      <div className="studyMain">
        <div className="tabList studyTabs"><button className={tab === "review" ? "tabButton active" : "tabButton"} onClick={() => setTab("review")}>復習</button><button className={tab === "add" ? "tabButton active" : "tabButton"} onClick={() => setTab("add")}>問題を追加</button><button className={tab === "settings" ? "tabButton active" : "tabButton"} onClick={() => setTab("settings")}>設定</button></div>
        {tab === "review" && <section className="studyCard studyReviewCard">{card ? <><button className="studyReviewDelete" type="button" onClick={() => removeCard(card.id)} aria-label={`${card.question}を削除`}>×</button><span>{card.category}</span><h2>{card.question}</h2>{revealed ? <><div className="studyAnswer"><h3>解答・要点</h3><p>{card.answer || "未入力"}</p><h3>解き方・注意点</h3><p>{card.notes || "未入力"}</p></div><div className="studyLevelButtons"><button onClick={() => review(0)}>要復習</button><button onClick={() => review(1)}>理解中</button><button onClick={() => review(2)}>定着</button></div></> : <button className="studyReveal" onClick={() => setRevealed(true)}>答えを確認する</button>}</> : <><p className="emptyText">このカテゴリの復習はありません。</p><h3>問題一覧</h3><div className="studyReviewList">{visible.map((item) => <div className="studyReviewItem" key={item.id}><span>{item.question}</span><button type="button" onClick={() => removeCard(item.id)} aria-label={`${item.question}を削除`}>×</button></div>)}</div></>}</section>}
        {tab === "add" && <form className="studyCard studyAddForm" onSubmit={addCard}><label>カテゴリー<select name="category" defaultValue={category === "すべて" ? state.categories[0] : category}>{state.categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>問題・論点名<input name="question" required /></label><label>解答・要点<textarea name="answer" /></label><label>解き方・注意点<textarea name="notes" /></label><label>教材・問題番号<input name="source" /></label><button>追加して今日復習する</button></form>}
        {tab === "settings" && <section className="studyCard"><h2>復習の頻度</h2><div className="studyIntervalList">{choices.map((item) => <label key={item}><input type="checkbox" checked={state.intervals.includes(item)} disabled={state.intervals.length === 1 && state.intervals.includes(item)} onChange={() => setState((current) => ({ ...current, intervals: current.intervals.includes(item) ? current.intervals.filter((value) => value !== item) : [...current.intervals, item].sort((left, right) => left - right) }))} />{intervalLabel(item)}</label>)}</div></section>}
      </div>
    </div>
  </main>;
}
