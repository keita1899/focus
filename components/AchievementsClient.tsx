"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AchievementCategory = { id: string; name: string };
type AchievementItem = { id: string; categoryId: string; title: string; done: boolean };
type AchievementsState = { categories: AchievementCategory[]; items: AchievementItem[] };

type AchievementsClientProps = { initialValue: unknown };

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultState(): AchievementsState {
  const category = { id: "achievement-category-default", name: "達成すること" };
  return { categories: [category], items: [] };
}

function normalizeState(value: unknown): AchievementsState {
  if (!value || typeof value !== "object") return createDefaultState();
  const source = value as Partial<AchievementsState>;
  const categories = Array.isArray(source.categories)
    ? source.categories
      .filter((category): category is AchievementCategory => Boolean(category) && typeof category.id === "string" && typeof category.name === "string")
      .map((category) => ({ id: category.id, name: category.name }))
    : [];
  const normalizedCategories = categories.length ? categories : createDefaultState().categories;
  const categoryIds = new Set(normalizedCategories.map((category) => category.id));
  const items = Array.isArray(source.items)
    ? source.items
      .filter((item): item is AchievementItem => Boolean(item) && typeof item.id === "string" && typeof item.categoryId === "string" && typeof item.title === "string" && categoryIds.has(item.categoryId))
      .map((item) => ({ id: item.id, categoryId: item.categoryId, title: item.title, done: Boolean(item.done) }))
    : [];
  return { categories: normalizedCategories, items };
}

export default function AchievementsClient({ initialValue }: AchievementsClientProps) {
  const [achievements, setAchievements] = useState<AchievementsState>(() => normalizeState(initialValue));
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => normalizeState(initialValue).categories[0].id);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemTitle, setNewItemTitle] = useState("");
  const hasMountedRef = useRef(false);

  const selectedCategory = achievements.categories.find((category) => category.id === selectedCategoryId) || achievements.categories[0];
  const visibleItems = useMemo(
    () => achievements.items.filter((item) => item.categoryId === selectedCategory?.id),
    [selectedCategory?.id, achievements.items],
  );

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    const timeoutId = window.setTimeout(() => {
      fetch("/api/achievements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(achievements),
      }).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [achievements]);

  function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const category = { id: createId("achievement-category"), name };
    setAchievements((current) => ({ ...current, categories: [...current.categories, category] }));
    setSelectedCategoryId(category.id);
    setNewCategoryName("");
  }

  function removeCategory(categoryId: string) {
    setAchievements((current) => {
      if (current.categories.length <= 1) return current;
      const categories = current.categories.filter((category) => category.id !== categoryId);
      if (selectedCategoryId === categoryId) setSelectedCategoryId(categories[0].id);
      return { categories, items: current.items.filter((item) => item.categoryId !== categoryId) };
    });
  }

  function addItem() {
    const title = newItemTitle.trim();
    if (!title || !selectedCategory) return;
    setAchievements((current) => ({ ...current, items: [...current.items, { id: createId("achievement-item"), categoryId: selectedCategory.id, title, done: false }] }));
    setNewItemTitle("");
  }

  return <main className="shell wantsPage">
    <section className="roadmapHeader wantsHeader"><h1>達成すること</h1></section>
    <section className="wantsWorkspace" aria-label="カテゴリ別の達成すること">
      <aside className="wantsSidebar">
        <h2>カテゴリー</h2>
        <div className="wantsCategoryList">
          {achievements.categories.map((category) => (
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
          <input aria-label="達成することを追加" placeholder="達成することを入力" value={newItemTitle} onChange={(event) => setNewItemTitle(event.target.value)} />
          <button type="submit">追加</button>
        </form>
        <div className="taskList">
          {visibleItems.length === 0 && <p className="emptyText">達成することはありません。</p>}
          {visibleItems.map((item) => <article className={`taskItem wantItem${item.done ? " done" : ""}`} key={item.id}>
            <button className="checkButton" type="button" onClick={() => setAchievements((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry) }))} aria-label={`${item.title}の完了を切り替え`}>✓</button>
            <input aria-label="達成すること" value={item.title} onChange={(event) => setAchievements((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, title: event.target.value } : entry) }))} />
            <button className="iconButton" type="button" onClick={() => setAchievements((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }))} aria-label={`${item.title}を削除`}>×</button>
          </article>)}
        </div>
      </section>
    </section>
  </main>;
}
