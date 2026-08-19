"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type WantCategory = { id: string; name: string };
type WantItem = { id: string; categoryId: string; title: string; done: boolean };
type WantsState = { categories: WantCategory[]; items: WantItem[] };

type WantsClientProps = { initialValue: unknown };

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultState(): WantsState {
  const category = { id: "want-category-default", name: "やりたいこと" };
  return { categories: [category], items: [] };
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
      .map((item) => ({ id: item.id, categoryId: item.categoryId, title: item.title, done: Boolean(item.done) }))
    : [];
  return { categories: normalizedCategories, items };
}

export default function WantsClient({ initialValue }: WantsClientProps) {
  const [wants, setWants] = useState<WantsState>(() => normalizeState(initialValue));
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => normalizeState(initialValue).categories[0].id);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemTitle, setNewItemTitle] = useState("");
  const hasMountedRef = useRef(false);

  const selectedCategory = wants.categories.find((category) => category.id === selectedCategoryId) || wants.categories[0];
  const visibleItems = useMemo(
    () => wants.items.filter((item) => item.categoryId === selectedCategory?.id),
    [selectedCategory?.id, wants.items],
  );

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    const timeoutId = window.setTimeout(() => {
      fetch("/api/wants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wants),
      }).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [wants]);

  function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const category = { id: createId("want-category"), name };
    setWants((current) => ({ ...current, categories: [...current.categories, category] }));
    setSelectedCategoryId(category.id);
    setNewCategoryName("");
  }

  function removeCategory(categoryId: string) {
    setWants((current) => {
      if (current.categories.length <= 1) return current;
      const categories = current.categories.filter((category) => category.id !== categoryId);
      if (selectedCategoryId === categoryId) setSelectedCategoryId(categories[0].id);
      return { categories, items: current.items.filter((item) => item.categoryId !== categoryId) };
    });
  }

  function addItem() {
    const title = newItemTitle.trim();
    if (!title || !selectedCategory) return;
    setWants((current) => ({ ...current, items: [...current.items, { id: createId("want-item"), categoryId: selectedCategory.id, title, done: false }] }));
    setNewItemTitle("");
  }

  return <main className="shell wantsPage">
    <section className="roadmapHeader wantsHeader"><h1>やりたいこと</h1></section>
    <section className="wantsWorkspace" aria-label="カテゴリ別のやりたいこと">
      <aside className="wantsSidebar">
        <h2>カテゴリー</h2>
        <div className="wantsCategoryList">
          {wants.categories.map((category) => (
            <div className={`wantsCategoryItem${category.id === selectedCategory?.id ? " active" : ""}`} key={category.id}>
              <button type="button" onClick={() => setSelectedCategoryId(category.id)}>{category.name}</button>
              <button className="iconButton" type="button" onClick={() => removeCategory(category.id)} aria-label={`${category.name}を削除`}>×</button>
            </div>
          ))}
        </div>
        <form className="wantsAddCategory" onSubmit={(event) => { event.preventDefault(); addCategory(); }}>
          <input aria-label="カテゴリーを追加" placeholder="カテゴリー名" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} />
          <button type="submit" aria-label="カテゴリーを追加">＋</button>
        </form>
      </aside>
      <section className="wantsContent">
        <h2>{selectedCategory?.name}</h2>
        <form className="wantsAddItem" onSubmit={(event) => { event.preventDefault(); addItem(); }}>
          <input aria-label="やりたいことを追加" placeholder="やりたいことを入力" value={newItemTitle} onChange={(event) => setNewItemTitle(event.target.value)} />
          <button type="submit">追加</button>
        </form>
        <div className="taskList">
          {visibleItems.length === 0 && <p className="emptyText">やりたいことはありません。</p>}
          {visibleItems.map((item) => <article className={`taskItem wantItem${item.done ? " done" : ""}`} key={item.id}>
            <button className="checkButton" type="button" onClick={() => setWants((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry) }))} aria-label={`${item.title}の完了を切り替え`}>✓</button>
            <input aria-label="やりたいこと" value={item.title} onChange={(event) => setWants((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, title: event.target.value } : entry) }))} />
            <button className="iconButton" type="button" onClick={() => setWants((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }))} aria-label={`${item.title}を削除`}>×</button>
          </article>)}
        </div>
      </section>
    </section>
  </main>;
}
