"use client";

import { useState } from "react";

import {
  MarkdownMemoPage,
  defaultMemoMarkdown,
  memoStorageKey,
} from "./MarkdownMemoClient";
import Roadmap2Client from "./Roadmap2Client";

type RoadmapTabsProps = {
  initialMemoValue: unknown;
  initialRoadmap2Value: unknown;
  initialTab?: "roadmap" | "annual";
};

export default function RoadmapTabs({
  initialMemoValue,
  initialRoadmap2Value,
  initialTab = "roadmap",
}: RoadmapTabsProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  return <main className="roadmapTabsPage">
    <div className="roadmapPageTabs" role="tablist" aria-label="ロードマップの種類">
      <button className={activeTab === "roadmap" ? "active" : undefined} type="button" role="tab" aria-selected={activeTab === "roadmap"} onClick={() => setActiveTab("roadmap")}>ロードマップ</button>
      <button className={activeTab === "annual" ? "active" : undefined} type="button" role="tab" aria-selected={activeTab === "annual"} onClick={() => setActiveTab("annual")}>年間ロードマップ</button>
    </div>
    {activeTab === "roadmap" ? <MarkdownMemoPage apiPath="/api/memos" ariaLabel="ロードマップ" defaultMarkdown={defaultMemoMarkdown} defaultTitle="ロードマップ" idPrefix="roadmap" initialValue={initialMemoValue} pageTitle="ロードマップ" storageKey={memoStorageKey} /> : <Roadmap2Client initialValue={initialRoadmap2Value} />}
  </main>;
}
