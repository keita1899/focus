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
const resizeTextarea = (target: HTMLTextAreaElement) => { target.style.height = "auto"; target.style.height = `${target.scrollHeight}px`; };

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
  const [view, setView] = useState<"list" | "add" | "settings">("list");
  const [category, setCategory] = useState("すべて");
  const [newCategory, setNewCategory] = useState("");
  const [openAnswerCardId, setOpenAnswerCardId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const mounted = useRef(false);
  const visible = state.cards.filter((card) => category === "すべて" || card.category === category);
  const due = useMemo(() => visible.filter((card) => card.dueDate <= date() && card.lastReviewed !== date()), [visible]);
  const openAnswerCard = state.cards.find((card) => card.id === openAnswerCardId);
  const editingCard = state.cards.find((card) => card.id === editingCardId);

  useEffect(() => { if (!mounted.current) { mounted.current = true; return; } void save(state); }, [state]);
  useEffect(() => {
    const openSettings = () => setView("settings");
    window.addEventListener("open-study-settings", openSettings);
    return () => window.removeEventListener("open-study-settings", openSettings);
  }, []);
  useEffect(() => {
    if (!openAnswerCardId && !editingCardId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenAnswerCardId(null);
        setEditingCardId(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [openAnswerCardId, editingCardId]);

  const review = (id: string, level: Level) => {
    const interval = state.intervals[level === 0 ? 0 : level === 1 ? Math.floor((state.intervals.length - 1) / 2) : state.intervals.length - 1] ?? 1;
    setState((current) => ({ ...current, cards: current.cards.map((item) => item.id === id ? { ...item, level, dueDate: date(interval), lastReviewed: date() } : item) }));
    setOpenAnswerCardId(null);
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
    setEditingCardId(null);
    setOpenAnswerCardId((current) => current === id ? null : current);
  };

  const editCard = (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const question = String(form.get("question") || "").trim();
    if (!question) return;
    setState((current) => ({ ...current, cards: current.cards.map((item) => item.id === id ? { ...item, question, answer: String(form.get("answer") || ""), notes: String(form.get("notes") || ""), source: String(form.get("source") || ""), category: String(form.get("category") || item.category) } : item) }));
    setEditingCardId(null);
  };

  const addCard = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const question = String(form.get("question") || "").trim();
    if (!question) return;
    setState((current) => ({ ...current, cards: [...current.cards, { id: `study-${Date.now()}`, question, answer: String(form.get("answer") || ""), notes: String(form.get("notes") || ""), source: String(form.get("source") || ""), category: String(form.get("category") || current.categories[0] || "未分類"), dueDate: date(), level: 0 }] }));
    event.currentTarget.reset();
    setView("list");
  };

  return <main className="studyShell">
    <header><div><p>公認会計士</p><h1>学習モード</h1></div><div className="studyHeaderActions"><strong>今日の復習 {due.length}件</strong><button type="button" onClick={() => setView(view === "add" ? "list" : "add")}>{view === "add" ? "一覧へ戻る" : "＋ 問題を追加"}</button></div></header>
    <div className="studyLayout">
      <aside className="studySidebar">
        <div className="studyCategoryList"><button className={category === "すべて" ? "active" : undefined} onClick={() => setCategory("すべて")}>すべて</button>{state.categories.map((item) => <div className={`studyCategoryItem${category === item ? " active" : ""}`} key={item}><button type="button" onClick={() => setCategory(item)}>{item}</button><button className="studyCategoryDelete" type="button" onClick={() => removeCategory(item)} aria-label={`${item}を削除`}>×</button></div>)}</div>
        <form className="studyCategoryForm" onSubmit={addCategory}><div><input id="new-study-category" value={newCategory} onChange={(event) => setNewCategory(event.currentTarget.value)} placeholder="カテゴリー名" aria-label="新しいカテゴリー名" /><button type="submit" aria-label="カテゴリーを追加">＋</button></div></form>
      </aside>
      <div className="studyMain">
        {view === "list" && <section className="studyQuestionSection"><div className="studyQuestionHeading"><h2>{category}</h2><span>{visible.length}件</span></div>{visible.length === 0 ? <p className="emptyText">このカテゴリーに問題はありません。</p> : <div className="studyQuestionGrid">{visible.map((item) => <article className="studyCard studyQuestionCard" key={item.id}><div className="studyQuestionCardActions"><button type="button" onClick={() => setEditingCardId(item.id)} aria-label={`${item.question}を編集`}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m14 7 3 3"/></svg></button><button type="button" onClick={() => removeCard(item.id)} aria-label={`${item.question}を削除`}>×</button></div><span>{item.category}</span><h3>{item.question}</h3>{item.source && <small>{item.source}</small>}<button className="studyReveal" type="button" onClick={() => setOpenAnswerCardId(item.id)}>答えを確認する</button></article>)}</div>}</section>}
        {view === "add" && <form className="studyCard studyAddForm" onSubmit={addCard}><h2>問題を追加</h2><label>カテゴリー<select name="category" defaultValue={category === "すべて" ? state.categories[0] : category}>{state.categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>問題・論点名<input name="question" required /></label><label>解答・要点<textarea name="answer" /></label><label>解き方・注意点<textarea name="notes" /></label><label>教材・問題番号<input name="source" /></label><button>追加して今日復習する</button></form>}
        {view === "settings" && <section className="studyCard"><div className="studySettingsHeading"><h2>復習の頻度</h2><button type="button" onClick={() => setView("list")}>閉じる</button></div><div className="studyIntervalList">{choices.map((item) => <label key={item}><input type="checkbox" checked={state.intervals.includes(item)} disabled={state.intervals.length === 1 && state.intervals.includes(item)} onChange={() => setState((current) => ({ ...current, intervals: current.intervals.includes(item) ? current.intervals.filter((value) => value !== item) : [...current.intervals, item].sort((left, right) => left - right) }))} />{intervalLabel(item)}</label>)}</div></section>}
      </div>
    </div>
    {editingCard && <div className="studyAnswerModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingCardId(null); }}><section className="studyAnswerModal studyEditModal" role="dialog" aria-modal="true" aria-labelledby={`study-edit-${editingCard.id}`}><div className="studyModalHeading"><h2 id={`study-edit-${editingCard.id}`}>問題を編集</h2><button type="button" onClick={() => setEditingCardId(null)} aria-label="閉じる">×</button></div><form className="studyAddForm" onSubmit={(event) => editCard(event, editingCard.id)}><label>カテゴリー<select name="category" defaultValue={editingCard.category}>{state.categories.map((name) => <option key={name} value={name}>{name}</option>)}</select></label><label>問題・論点名<input name="question" defaultValue={editingCard.question} required /></label><label>解答・要点<textarea name="answer" defaultValue={editingCard.answer} ref={(node) => { if (node) resizeTextarea(node); }} onInput={(event) => resizeTextarea(event.currentTarget)} /></label><label>解き方・注意点<textarea name="notes" defaultValue={editingCard.notes} ref={(node) => { if (node) resizeTextarea(node); }} onInput={(event) => resizeTextarea(event.currentTarget)} /></label><label>教材・問題番号<input name="source" defaultValue={editingCard.source} /></label><div className="studyEditActions"><button type="button" onClick={() => setEditingCardId(null)}>キャンセル</button><button type="submit">保存</button></div></form></section></div>}
    {openAnswerCard && <div className="studyAnswerModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenAnswerCardId(null); }}><section className="studyAnswerModal" role="dialog" aria-modal="true" aria-labelledby={`study-answer-${openAnswerCard.id}`}><header><div><span>{openAnswerCard.category}</span><h2 id={`study-answer-${openAnswerCard.id}`}>{openAnswerCard.question}</h2>{openAnswerCard.source && <small>{openAnswerCard.source}</small>}</div><button type="button" onClick={() => setOpenAnswerCardId(null)} aria-label="閉じる">×</button></header><div className="studyAnswerModalBody">{openAnswerCard.answer.trim() && <section className="studyAnswerSection"><h3>解答・要点</h3><p>{openAnswerCard.answer}</p></section>}{openAnswerCard.notes.trim() && <section className="studyAnswerSection"><h3>解き方・注意点</h3><p>{openAnswerCard.notes}</p></section>}{!openAnswerCard.answer.trim() && !openAnswerCard.notes.trim() && <p className="emptyText">解答・注意点は未入力です。</p>}</div><div className="studyLevelButtons"><button type="button" onClick={() => review(openAnswerCard.id, 0)}>要復習</button><button type="button" onClick={() => review(openAnswerCard.id, 1)}>理解中</button><button type="button" onClick={() => review(openAnswerCard.id, 2)}>定着</button></div></section></div>}
  </main>;
}
