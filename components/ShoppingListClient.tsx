"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ShoppingCategory = { id: string; name: string; color: string };
type ShoppingItem = { id: string; categoryId: string; title: string; price?: number; done: boolean; scheduledYear?: number; scheduledMonth?: number };
type ShoppingState = { categories: ShoppingCategory[]; items: ShoppingItem[] };
type ItemDraft = Omit<ShoppingItem, "id">;
type ShoppingListClientProps = { initialValue: unknown };
type ShoppingSortKey = "year" | "month";

const defaultCategoryColor = "#176b55";

function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function createDefaultState(): ShoppingState { return { categories: [{ id: "shopping-category-default", name: "買い物", color: defaultCategoryColor }], items: [] }; }
function createItemDraft(categoryId: string): ItemDraft { return { categoryId, title: "", done: false }; }

function saveShoppingList(value: string) {
  return fetch("/api/shopping-list", { method: "PUT", headers: { "Content-Type": "application/json" }, body: value, keepalive: true }).catch(() => undefined);
}

function normalizeState(value: unknown): ShoppingState {
  if (!value || typeof value !== "object") return createDefaultState();
  const source = value as Partial<ShoppingState>;
  const categories = Array.isArray(source.categories) ? source.categories
    .filter((category): category is ShoppingCategory => Boolean(category) && typeof category.id === "string" && typeof category.name === "string")
    .map((category) => ({ id: category.id, name: category.name, color: typeof category.color === "string" && /^#[0-9a-f]{6}$/i.test(category.color) ? category.color : defaultCategoryColor })) : [];
  const normalizedCategories = categories.length ? categories : createDefaultState().categories;
  const categoryIds = new Set(normalizedCategories.map((category) => category.id));
  const items = Array.isArray(source.items) ? source.items
    .filter((item): item is ShoppingItem => Boolean(item) && typeof item.id === "string" && typeof item.categoryId === "string" && typeof item.title === "string" && categoryIds.has(item.categoryId))
    .map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      title: item.title,
      done: Boolean(item.done),
      price: typeof item.price === "number" && Number.isFinite(item.price) && item.price >= 0 ? item.price : undefined,
      scheduledYear: typeof item.scheduledYear === "number" && Number.isInteger(item.scheduledYear) ? item.scheduledYear : undefined,
      scheduledMonth: typeof item.scheduledMonth === "number" && item.scheduledMonth >= 1 && item.scheduledMonth <= 12 ? item.scheduledMonth : undefined,
    })) : [];
  return { categories: normalizedCategories, items };
}

export default function ShoppingListClient({ initialValue }: ShoppingListClientProps) {
  const [shopping, setShopping] = useState<ShoppingState>(() => normalizeState(initialValue));
  const [itemEditor, setItemEditor] = useState<{ id: string | null; draft: ItemDraft } | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [lastCategoryId, setLastCategoryId] = useState(shopping.categories[0].id);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [sortDirections, setSortDirections] = useState<Record<ShoppingSortKey, "asc" | "desc">>({ year: "asc", month: "asc" });
  const [categorySortMode, setCategorySortMode] = useState<"grouped" | "created">("grouped");
  const hasMountedRef = useRef(false);
  const pendingSaveRef = useRef<string | null>(null);

  const sortedItems = useMemo(() => {
    const filteredItems = selectedCategoryId === "all" ? shopping.items : shopping.items.filter((item) => item.categoryId === selectedCategoryId);
    if (categorySortMode === "created") return filteredItems;
    const categoryOrder = new Map(shopping.categories.map((category, index) => [category.id, index]));
    return [...filteredItems].sort((left, right) => {
      const leftHasSchedule = Boolean(left.scheduledYear && left.scheduledMonth);
      const rightHasSchedule = Boolean(right.scheduledYear && right.scheduledMonth);
      const yearComparison = (left.scheduledYear || 9999) - (right.scheduledYear || 9999);
      const monthComparison = (left.scheduledMonth || 99) - (right.scheduledMonth || 99);
      const categoryComparison = (categoryOrder.get(left.categoryId) || 0) - (categoryOrder.get(right.categoryId) || 0);
      const withDirection = (value: number, key: ShoppingSortKey) => sortDirections[key] === "asc" ? value : -value;
      if (leftHasSchedule && rightHasSchedule) return withDirection(yearComparison, "year") || withDirection(monthComparison, "month") || left.title.localeCompare(right.title, "ja");
      if (leftHasSchedule) return -1;
      if (rightHasSchedule) return 1;
      return categoryComparison || withDirection(yearComparison, "year") || withDirection(monthComparison, "month") || left.title.localeCompare(right.title, "ja");
    });
  }, [categorySortMode, selectedCategoryId, shopping.categories, shopping.items, sortDirections]);

  useEffect(() => {
    if (!hasMountedRef.current) { hasMountedRef.current = true; return; }
    const value = JSON.stringify(shopping);
    pendingSaveRef.current = value;
    const timeoutId = window.setTimeout(() => {
      void saveShoppingList(value).then(() => {
        if (pendingSaveRef.current === value) pendingSaveRef.current = null;
      });
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [shopping]);

  useEffect(() => () => {
    if (pendingSaveRef.current) void saveShoppingList(pendingSaveRef.current);
  }, []);

  function openNewItem() {
    const categoryId = selectedCategoryId !== "all" && shopping.categories.some((category) => category.id === selectedCategoryId)
      ? selectedCategoryId
      : shopping.categories.some((category) => category.id === lastCategoryId) ? lastCategoryId : shopping.categories[0].id;
    setItemEditor({ id: null, draft: createItemDraft(categoryId) });
  }
  function openEditItem(item: ShoppingItem) { setItemEditor({ id: item.id, draft: { categoryId: item.categoryId, title: item.title, price: item.price, done: item.done, scheduledYear: item.scheduledYear, scheduledMonth: item.scheduledMonth } }); }
  function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemEditor || !itemEditor.draft.title.trim()) return;
    const item = { ...itemEditor.draft, title: itemEditor.draft.title.trim(), price: itemEditor.draft.price === undefined || itemEditor.draft.price === null ? undefined : Math.max(0, itemEditor.draft.price), scheduledYear: itemEditor.draft.scheduledYear || undefined, scheduledMonth: itemEditor.draft.scheduledMonth || undefined };
    setShopping((current) => itemEditor.id ? { ...current, items: current.items.map((entry) => entry.id === itemEditor.id ? { ...entry, ...item } : entry) } : { ...current, items: [...current.items, { ...item, id: createId("shopping-item") }] });
    if (!itemEditor.id) setLastCategoryId(item.categoryId);
    setItemEditor(null);
  }
  function updateCategory(id: string, value: Partial<ShoppingCategory>) { setShopping((current) => ({ ...current, categories: current.categories.map((category) => category.id === id ? { ...category, ...value } : category) })); }
  function addCategory(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const name = newCategoryName.trim(); if (!name) return; setShopping((current) => ({ ...current, categories: [...current.categories, { id: createId("shopping-category"), name, color: defaultCategoryColor }] })); setNewCategoryName(""); }
  function removeCategory(id: string) {
    const fallbackId = shopping.categories.find((category) => category.id !== id)?.id;
    if (lastCategoryId === id && fallbackId) setLastCategoryId(fallbackId);
    if (selectedCategoryId === id) setSelectedCategoryId("all");
    setShopping((current) => {
      if (current.categories.length === 1) return current;
      const nextCategoryId = current.categories.find((category) => category.id !== id)!.id;
      return { categories: current.categories.filter((category) => category.id !== id), items: current.items.map((item) => item.categoryId === id ? { ...item, categoryId: nextCategoryId } : item) };
    });
  }
  function toggleSort(key: ShoppingSortKey) { setSortDirections((current) => ({ ...current, [key]: current[key] === "asc" ? "desc" : "asc" })); }
  function sortLabel(key: ShoppingSortKey) { return sortDirections[key] === "asc" ? " ↑" : " ↓"; }
  function toggleCategorySortMode() { setCategorySortMode((current) => current === "grouped" ? "created" : "grouped"); }

  return <main className="shell wantsPage">
    <section className="roadmapHeader wantsHeader"><h1>買い物リスト</h1></section>
    <section className="wantsTablePanel" aria-label="買い物リスト一覧">
      <div className="wantsTableActions"><div className="wantsTableFilters"><button className="wantsCategoryButton" type="button" onClick={() => setIsCategoryModalOpen(true)}>カテゴリーを管理</button><label>表示<select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.currentTarget.value)}><option value="all">すべて</option>{shopping.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div><button className="wantsAddButton" type="button" onClick={openNewItem}>＋ 買い物を追加</button></div>
      <div className="wantsTableScroll"><table className="wantsTable shoppingTable"><thead><tr><th>完了</th><th><button className="wantsSortHeader" type="button" onClick={() => toggleSort("year")}>予定年{sortLabel("year")}</button></th><th><button className="wantsSortHeader" type="button" onClick={() => toggleSort("month")}>予定月{sortLabel("month")}</button></th><th><button className="wantsSortHeader" type="button" onClick={toggleCategorySortMode}>{categorySortMode === "grouped" ? "カテゴリーごと" : "追加順"}</button></th><th>買うもの</th><th>値段</th><th>削除</th></tr></thead><tbody>
        {sortedItems.length === 0 ? <tr><td className="wantsEmpty" colSpan={7}>買い物はありません。追加ボタンから登録してください。</td></tr> : sortedItems.map((item) => {
          const category = shopping.categories.find((entry) => entry.id === item.categoryId) || shopping.categories[0];
          return <tr className={item.done ? "done" : ""} key={item.id} onDoubleClick={() => openEditItem(item)} title="ダブルクリックで編集">
            <td><button className="checkButton" type="button" onClick={() => setShopping((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }))} aria-label={`${item.title || "買い物"}を購入済みにして削除`}>✓</button></td>
            <td>{item.scheduledYear || "—"}</td><td>{item.scheduledMonth ? `${item.scheduledMonth}月` : "—"}</td><td><span className="wantCategoryTag" style={{ ["--category-color" as string]: category.color }}>{category.name}</span></td><td className="wantTitleCell">{item.title}</td><td>{item.price === undefined ? "—" : `¥${item.price.toLocaleString("ja-JP")}`}</td>
            <td><button className="iconButton wantsDeleteButton" type="button" onClick={() => setShopping((current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }))} aria-label={`${item.title || "買い物"}を削除`}>×</button></td>
          </tr>;
        })}
      </tbody></table></div>
      <button className="wantsAddButton wantsAddButtonBottom" type="button" onClick={openNewItem}>＋ 買い物を追加</button>
    </section>
    {itemEditor && <div className="wantsModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setItemEditor(null); }}><form className="wantsModal" onSubmit={saveItem}><header><h2>{itemEditor.id ? "買い物を編集" : "買い物を追加"}</h2><button type="button" onClick={() => setItemEditor(null)} aria-label="閉じる">×</button></header><label>買うもの<input autoFocus value={itemEditor.draft.title} onChange={(event) => setItemEditor((current) => current && { ...current, draft: { ...current.draft, title: event.target.value } })} /></label><label>値段<input type="number" min="0" step="1" inputMode="numeric" value={itemEditor.draft.price ?? ""} onChange={(event) => setItemEditor((current) => current && { ...current, draft: { ...current.draft, price: event.target.value === "" ? undefined : Number(event.target.value) } })} /></label><div className="wantsDateFields"><label>予定年<input type="number" min="2000" max="9999" value={itemEditor.draft.scheduledYear || ""} onChange={(event) => setItemEditor((current) => current && { ...current, draft: { ...current.draft, scheduledYear: event.target.value ? Number(event.target.value) : undefined } })} /></label><label>予定月<select value={itemEditor.draft.scheduledMonth || ""} onChange={(event) => setItemEditor((current) => current && { ...current, draft: { ...current.draft, scheduledMonth: event.target.value ? Number(event.target.value) : undefined } })}><option value="">未設定</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}月</option>)}</select></label></div><label>カテゴリー<select value={itemEditor.draft.categoryId} onChange={(event) => setItemEditor((current) => current && { ...current, draft: { ...current.draft, categoryId: event.target.value } })}>{shopping.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div className="wantsModalActions"><button type="button" onClick={() => setItemEditor(null)}>キャンセル</button><button type="submit">保存</button></div></form></div>}
    {isCategoryModalOpen && <div className="wantsModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsCategoryModalOpen(false); }}><section className="wantsModal wantsCategoryModal"><header><h2>カテゴリーを管理</h2><button type="button" onClick={() => setIsCategoryModalOpen(false)} aria-label="閉じる">×</button></header><div className="wantsCategoryEditorList">{shopping.categories.map((category) => <div key={category.id}><input type="color" value={category.color} onChange={(event) => updateCategory(category.id, { color: event.target.value })} aria-label={`${category.name}の色`} /><input value={category.name} onChange={(event) => updateCategory(category.id, { name: event.target.value })} aria-label="カテゴリー名" /><button className="iconButton wantsDeleteButton" type="button" disabled={shopping.categories.length === 1} onClick={() => removeCategory(category.id)} aria-label={`${category.name}を削除`}>×</button></div>)}</div><form className="wantsCategoryAddForm" onSubmit={addCategory}><input placeholder="新しいカテゴリー" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} /><button type="submit">追加</button></form></section></div>}
  </main>;
}
