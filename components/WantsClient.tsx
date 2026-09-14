"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type WantCategory = { id: string; name: string };
type WantItem = { id: string; categoryId: string; title: string; done: boolean; scheduledYearMonth?: string };
type WantsState = { categories: WantCategory[]; items: WantItem[] };
type WantsClientProps = { initialValue: unknown };

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultState(): WantsState {
  return { categories: [{ id: "want-category-default", name: "やりたいこと" }], items: [] };
}

function normalizeState(value: unknown): WantsState {
  if (!value || typeof value !== "object") return createDefaultState();
  const source = value as Partial<WantsState>;
  const categories = Array.isArray(source.categories)
    ? source.categories
      .filter((category): category is WantCategory => Boolean(category) && typeof category.id === "string" && typeof category.name === "string")
      .map((category) => ({ id: category.id, name: category.name }))
    : [];
  const normalizedCategories = categories.length ? categories : createDefaultState().categories;
  const categoryIds = new Set(normalizedCategories.map((category) => category.id));
  const items = Array.isArray(source.items)
    ? source.items
      .filter((item): item is WantItem => Boolean(item) && typeof item.id === "string" && typeof item.categoryId === "string" && typeof item.title === "string" && categoryIds.has(item.categoryId))
      .map((item) => ({ ...item, done: Boolean(item.done), scheduledYearMonth: typeof item.scheduledYearMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(item.scheduledYearMonth) ? item.scheduledYearMonth : undefined }))
    : [];
  return { categories: normalizedCategories, items };
}

export default function WantsClient({ initialValue }: WantsClientProps) {
  const [wants, setWants] = useState<WantsState>(() => normalizeState(initialValue));
  const [newCategoryName, setNewCategoryName] = useState("");
  const hasMountedRef = useRef(false);
  const sortedItems = useMemo(() => [...wants.items].sort((left, right) => (left.scheduledYearMonth || "9999-12").localeCompare(right.scheduledYearMonth || "9999-12")), [wants.items]);

  useEffect(() => {
    if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
    const timeoutId = window.setTimeout(() => {
      fetch("/api/wants", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wants) }).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [wants]);

  function addItem() {
    setWants((current) => ({ ...current, items: [...current.items, { id: createId("want-item"), categoryId: current.categories[0].id, title: "", done: false }] }));
  }

  function updateItem(id: string, value: Partial<WantItem>) {
    setWants((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, ...value } : item) }));
  }

  function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setWants((current) => ({ ...current, categories: [...current.categories, { id: createId("want-category"), name }] }));
    setNewCategoryName("");
  }

  return <main className="shell wantsPage">
    <section className="roadmapHeader wantsHeader"><h1>やりたいこと</h1></section>
    <section className="wantsTablePanel" aria-label="やりたいこと一覧">
      <div className="wantsTableActions">
        <form className="wantsAddCategory" onSubmit={(event) => { event.preventDefault(); addCategory(); }}>
          <input aria-label="カテゴリーを追加" placeholder="カテゴリー名を追加" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} />
          <button type="submit">カテゴリーを追加</button>
        </form>
        <button className="wantsAddButton" type="button" onClick={addItem}>＋ やりたいことを追加</button>
      </div>
      <div className="wantsTableScroll">
        <table className="wantsTable">
          <thead><tr><th scope="col">完了</th><th scope="col">予定年月</th><th scope="col">カテゴリー</th><th scope="col">やりたいこと名</th><th scope="col">削除</th></tr></thead>
          <tbody>
            {sortedItems.length === 0 ? <tr><td className="wantsEmpty" colSpan={5}>やりたいことはありません。追加ボタンから登録してください。</td></tr> : sortedItems.map((item) => <tr className={item.done ? "done" : ""} key={item.id}>
              <td><button className="checkButton" type="button" onClick={() => updateItem(item.id, { done: !item.done })} aria-label={`${item.title || "やりたいこと"}の完了を切り替え`}>✓</button></td>
              <td><input type="month" aria-label="予定年月" value={item.scheduledYearMonth || ""} onChange={(event) => updateItem(item.id, { scheduledYearMonth: event.currentTarget.value || undefined })} /></td>
              <td><select aria-label="カテゴリー" value={item.categoryId} onChange={(event) => updateItem(item.id, { categoryId: event.currentTarget.value })}>{wants.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></td>
              <td><input aria-label="やりたいこと名" placeholder="やりたいことを入力" value={item.title} onChange={(event) => updateItem(item.id, { title: event.currentTarget.value })} /></td>
              <td><button className="iconButton wantsDeleteButton" type="button" onClick={() => setWants((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }))} aria-label={`${item.title || "やりたいこと"}を削除`}>×</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  </main>;
}
