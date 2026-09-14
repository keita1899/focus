"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type WantCategory = { id: string; name: string; color: string };
type WantItem = { id: string; categoryId: string; title: string; done: boolean; scheduledYear?: number; scheduledMonth?: number };
type WantsState = { categories: WantCategory[]; items: WantItem[] };
type ItemDraft = Omit<WantItem, "id">;
type WantsClientProps = { initialValue: unknown };
type WantsSortKey = "year" | "month" | "category";

const defaultCategoryColor = "#176b55";

function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function createDefaultState(): WantsState { return { categories: [{ id: "want-category-default", name: "やりたいこと", color: defaultCategoryColor }], items: [] }; }
function createItemDraft(categoryId: string): ItemDraft { return { categoryId, title: "", done: false }; }

function normalizeState(value: unknown): WantsState {
  if (!value || typeof value !== "object") return createDefaultState();
  const source = value as Partial<WantsState>;
  const categories = Array.isArray(source.categories) ? source.categories
    .filter((category): category is WantCategory => Boolean(category) && typeof category.id === "string" && typeof category.name === "string")
    .map((category) => ({ id: category.id, name: category.name, color: typeof category.color === "string" && /^#[0-9a-f]{6}$/i.test(category.color) ? category.color : defaultCategoryColor })) : [];
  const normalizedCategories = categories.length ? categories : createDefaultState().categories;
  const categoryIds = new Set(normalizedCategories.map((category) => category.id));
  const items = Array.isArray(source.items) ? source.items
    .filter((item): item is WantItem => Boolean(item) && typeof item.id === "string" && typeof item.categoryId === "string" && typeof item.title === "string" && categoryIds.has(item.categoryId))
    .map((item) => {
      const legacyItem = item as unknown as { scheduledYearMonth?: unknown };
      const legacyDate = typeof legacyItem.scheduledYearMonth === "string" ? legacyItem.scheduledYearMonth.match(/^(\d{4})-(0[1-9]|1[0-2])$/) : null;
      const scheduledYear = typeof item.scheduledYear === "number" && Number.isInteger(item.scheduledYear) ? item.scheduledYear : legacyDate ? Number(legacyDate[1]) : undefined;
      const scheduledMonth = typeof item.scheduledMonth === "number" && item.scheduledMonth >= 1 && item.scheduledMonth <= 12 ? item.scheduledMonth : legacyDate ? Number(legacyDate[2]) : undefined;
      return { id: item.id, categoryId: item.categoryId, title: item.title, done: Boolean(item.done), scheduledYear, scheduledMonth };
    }) : [];
  return { categories: normalizedCategories, items };
}

export default function WantsClient({ initialValue }: WantsClientProps) {
  const [wants, setWants] = useState<WantsState>(() => normalizeState(initialValue));
  const [itemEditor, setItemEditor] = useState<{ id: string | null; draft: ItemDraft } | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [lastCategoryId, setLastCategoryId] = useState(wants.categories[0].id);
  const [sortDirections, setSortDirections] = useState<Record<WantsSortKey, "asc" | "desc">>({ year: "asc", month: "asc", category: "asc" });
  const hasMountedRef = useRef(false);
  const sortedItems = useMemo(() => {
    const categoryOrder = new Map(wants.categories.map((category, index) => [category.id, index]));
    return [...wants.items].sort((left, right) => {
      const yearComparison = (left.scheduledYear || 9999) - (right.scheduledYear || 9999);
      const monthComparison = (left.scheduledMonth || 99) - (right.scheduledMonth || 99);
      const categoryComparison = (categoryOrder.get(left.categoryId) || 0) - (categoryOrder.get(right.categoryId) || 0);
      const withDirection = (value: number, key: WantsSortKey) => sortDirections[key] === "asc" ? value : -value;
      return withDirection(categoryComparison, "category") || withDirection(yearComparison, "year") || withDirection(monthComparison, "month") || left.title.localeCompare(right.title, "ja");
    });
  }, [sortDirections, wants.categories, wants.items]);

  useEffect(() => {
    if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
    const timeoutId = window.setTimeout(() => fetch("/api/wants", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wants) }).catch(() => undefined), 400);
    return () => window.clearTimeout(timeoutId);
  }, [wants]);

  function openNewItem() { setItemEditor({ id: null, draft: createItemDraft(wants.categories.some((category) => category.id === lastCategoryId) ? lastCategoryId : wants.categories[0].id) }); }
  function openEditItem(item: WantItem) { setItemEditor({ id: item.id, draft: { categoryId: item.categoryId, title: item.title, done: item.done, scheduledYear: item.scheduledYear, scheduledMonth: item.scheduledMonth } }); }
  function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemEditor || !itemEditor.draft.title.trim()) return;
    const item = { ...itemEditor.draft, title: itemEditor.draft.title.trim(), scheduledYear: itemEditor.draft.scheduledYear || undefined, scheduledMonth: itemEditor.draft.scheduledMonth || undefined };
    setWants((current) => itemEditor.id ? { ...current, items: current.items.map((entry) => entry.id === itemEditor.id ? { ...entry, ...item } : entry) } : { ...current, items: [...current.items, { ...item, id: createId("want-item") }] });
    if (!itemEditor.id) setLastCategoryId(item.categoryId);
    setItemEditor(null);
  }
  function updateCategory(id: string, value: Partial<WantCategory>) { setWants((current) => ({ ...current, categories: current.categories.map((category) => category.id === id ? { ...category, ...value } : category) })); }
  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const name = newCategoryName.trim(); if (!name) return;
    setWants((current) => ({ ...current, categories: [...current.categories, { id: createId("want-category"), name, color: defaultCategoryColor }] })); setNewCategoryName("");
  }
  function removeCategory(id: string) {
    const fallbackId = wants.categories.find((category) => category.id !== id)?.id;
    if (lastCategoryId === id && fallbackId) setLastCategoryId(fallbackId);
    setWants((current) => {
      if (current.categories.length === 1) return current;
      const nextCategoryId = current.categories.find((category) => category.id !== id)!.id;
      return { categories: current.categories.filter((category) => category.id !== id), items: current.items.map((item) => item.categoryId === id ? { ...item, categoryId: nextCategoryId } : item) };
    });
  }
  function toggleSort(key: WantsSortKey) { setSortDirections((current) => ({ ...current, [key]: current[key] === "asc" ? "desc" : "asc" })); }
  function sortLabel(key: WantsSortKey) { return sortDirections[key] === "asc" ? " ↑" : " ↓"; }

  return <main className="shell wantsPage">
    <section className="roadmapHeader wantsHeader"><h1>やりたいこと</h1></section>
    <section className="wantsTablePanel" aria-label="やりたいこと一覧">
      <div className="wantsTableActions"><button className="wantsCategoryButton" type="button" onClick={() => setIsCategoryModalOpen(true)}>カテゴリーを管理</button><button className="wantsAddButton" type="button" onClick={openNewItem}>＋ やりたいことを追加</button></div>
      <div className="wantsTableScroll"><table className="wantsTable"><thead><tr><th>完了</th><th><button className="wantsSortHeader" type="button" onClick={() => toggleSort("year")}>予定年{sortLabel("year")}</button></th><th><button className="wantsSortHeader" type="button" onClick={() => toggleSort("month")}>予定月{sortLabel("month")}</button></th><th><button className="wantsSortHeader" type="button" onClick={() => toggleSort("category")}>カテゴリー{sortLabel("category")}</button></th><th>やりたいこと名</th><th>削除</th></tr></thead><tbody>
        {sortedItems.length === 0 ? <tr><td className="wantsEmpty" colSpan={6}>やりたいことはありません。追加ボタンから登録してください。</td></tr> : sortedItems.map((item) => {
          const category = wants.categories.find((entry) => entry.id === item.categoryId) || wants.categories[0];
          return <tr className={item.done ? "done" : ""} key={item.id} onDoubleClick={() => openEditItem(item)} title="ダブルクリックで編集">
            <td><button className="checkButton" type="button" onClick={() => setWants((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry) }))} aria-label={`${item.title || "やりたいこと"}の完了を切り替え`}>✓</button></td>
            <td>{item.scheduledYear || "—"}</td><td>{item.scheduledMonth ? `${item.scheduledMonth}月` : "—"}</td>
            <td><span className="wantCategoryTag" style={{ ["--category-color" as string]: category.color }}>{category.name}</span></td>
            <td className="wantTitleCell">{item.title}</td>
            <td><button className="iconButton wantsDeleteButton" type="button" onClick={() => setWants((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }))} aria-label={`${item.title || "やりたいこと"}を削除`}>×</button></td>
          </tr>;
        })}
      </tbody></table></div>
      <button className="wantsAddButton wantsAddButtonBottom" type="button" onClick={openNewItem}>＋ やりたいことを追加</button>
    </section>
    {itemEditor && <div className="wantsModalBackdrop" role="presentation"><form className="wantsModal" onSubmit={saveItem}><header><h2>{itemEditor.id ? "やりたいことを編集" : "やりたいことを追加"}</h2><button type="button" onClick={() => setItemEditor(null)} aria-label="閉じる">×</button></header><label>やりたいこと名<input autoFocus value={itemEditor.draft.title} onChange={(event) => setItemEditor((current) => current && { ...current, draft: { ...current.draft, title: event.target.value } })} /></label><div className="wantsDateFields"><label>予定年<input type="number" min="2000" max="9999" value={itemEditor.draft.scheduledYear || ""} onChange={(event) => setItemEditor((current) => current && { ...current, draft: { ...current.draft, scheduledYear: event.target.value ? Number(event.target.value) : undefined } })} /></label><label>予定月<select value={itemEditor.draft.scheduledMonth || ""} onChange={(event) => setItemEditor((current) => current && { ...current, draft: { ...current.draft, scheduledMonth: event.target.value ? Number(event.target.value) : undefined } })}><option value="">未設定</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}月</option>)}</select></label></div><label>カテゴリー<select value={itemEditor.draft.categoryId} onChange={(event) => setItemEditor((current) => current && { ...current, draft: { ...current.draft, categoryId: event.target.value } })}>{wants.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div className="wantsModalActions"><button type="button" onClick={() => setItemEditor(null)}>キャンセル</button><button type="submit">保存</button></div></form></div>}
    {isCategoryModalOpen && <div className="wantsModalBackdrop" role="presentation"><section className="wantsModal wantsCategoryModal"><header><h2>カテゴリーを管理</h2><button type="button" onClick={() => setIsCategoryModalOpen(false)} aria-label="閉じる">×</button></header><div className="wantsCategoryEditorList">{wants.categories.map((category) => <div key={category.id}><input type="color" value={category.color} onChange={(event) => updateCategory(category.id, { color: event.target.value })} aria-label={`${category.name}の色`} /><input value={category.name} onChange={(event) => updateCategory(category.id, { name: event.target.value })} aria-label="カテゴリー名" /><button className="iconButton wantsDeleteButton" type="button" disabled={wants.categories.length === 1} onClick={() => removeCategory(category.id)} aria-label={`${category.name}を削除`}>×</button></div>)}</div><form className="wantsCategoryAddForm" onSubmit={addCategory}><input placeholder="新しいカテゴリー" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} /><button type="submit">追加</button></form></section></div>}
  </main>;
}
