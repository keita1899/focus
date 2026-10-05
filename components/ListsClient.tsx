"use client";

import { useState } from "react";
import FixedCostsClient from "./FixedCostsClient";
import PrefectureChecklistClient from "./PrefectureChecklistClient";
import ShoppingListClient from "./ShoppingListClient";
import WantsClient from "./WantsClient";

type ListTab = "wants" | "shopping" | "fixed-costs" | "prefectures";

export default function ListsClient({ wants, shopping, fixedCosts, prefectures }: { wants: unknown; shopping: unknown; fixedCosts: unknown; prefectures: unknown }) {
  const [tab, setTab] = useState<ListTab>("wants");
  return <main className="shell listsPage"><div className="tabList listsTabList" role="tablist" aria-label="リストの切り替え"><button className={tab === "wants" ? "tabButton active" : "tabButton"} type="button" onClick={() => setTab("wants")}>やりたいこと</button><button className={tab === "shopping" ? "tabButton active" : "tabButton"} type="button" onClick={() => setTab("shopping")}>買い物リスト</button><button className={tab === "fixed-costs" ? "tabButton active" : "tabButton"} type="button" onClick={() => setTab("fixed-costs")}>固定費リスト</button><button className={tab === "prefectures" ? "tabButton active" : "tabButton"} type="button" onClick={() => setTab("prefectures")}>47都道府県</button></div>{tab === "wants" && <WantsClient initialValue={wants} />}{tab === "shopping" && <ShoppingListClient initialValue={shopping} />}{tab === "fixed-costs" && <FixedCostsClient initialValue={fixedCosts} />}{tab === "prefectures" && <PrefectureChecklistClient initialValue={prefectures} />}</main>;
}
