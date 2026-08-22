"use client";

import { useEffect, useState } from "react";

import {
  MarkdownMemoPage,
  defaultMemoMarkdown,
  memoStorageKey,
} from "./MarkdownMemoClient";
import Roadmap2Client from "./Roadmap2Client";
import VisionClient from "./VisionClient";
import WantsClient from "./WantsClient";
import AchievementsClient from "./AchievementsClient";

type RoadmapTabsProps = {
  initialMemoValue: unknown;
  initialRoadmap2Value: unknown;
  initialPlannerValue: unknown;
  initialVisionValue: unknown;
  initialWantsValue: unknown;
  initialAchievementsValue: unknown;
  initialTab?: "roadmap" | "annual" | "vision" | "wants" | "achievements";
};

export default function RoadmapTabs({
  initialMemoValue,
  initialRoadmap2Value,
  initialPlannerValue,
  initialVisionValue,
  initialWantsValue,
  initialAchievementsValue,
  initialTab = "roadmap",
}: RoadmapTabsProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    try {
      const storedTab = window.localStorage.getItem("roadmap-active-tab-v1");
      if (storedTab === "roadmap" || storedTab === "annual" || storedTab === "vision" || storedTab === "wants" || storedTab === "achievements") setActiveTab(storedTab);
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem("roadmap-active-tab-v1", activeTab); } catch {}
  }, [activeTab]);

  return <main className="roadmapTabsPage">
    <div className="roadmapPageTabs" role="tablist" aria-label="ロードマップの種類">
      <button className={activeTab === "roadmap" ? "active" : undefined} type="button" role="tab" aria-selected={activeTab === "roadmap"} onClick={() => setActiveTab("roadmap")}>ロードマップ</button>
      <button className={activeTab === "annual" ? "active" : undefined} type="button" role="tab" aria-selected={activeTab === "annual"} onClick={() => setActiveTab("annual")}>年間ロードマップ</button>
      <button className={activeTab === "vision" ? "active" : undefined} type="button" role="tab" aria-selected={activeTab === "vision"} onClick={() => setActiveTab("vision")}>ビジョン</button>
      <button className={activeTab === "wants" ? "active" : undefined} type="button" role="tab" aria-selected={activeTab === "wants"} onClick={() => setActiveTab("wants")}>やりたいこと</button>
      <button className={activeTab === "achievements" ? "active" : undefined} type="button" role="tab" aria-selected={activeTab === "achievements"} onClick={() => setActiveTab("achievements")}>達成すること</button>
    </div>
    <div className="roadmapTabPanel" hidden={activeTab !== "roadmap"}>
      <MarkdownMemoPage apiPath="/api/memos" ariaLabel="ロードマップ" defaultMarkdown={defaultMemoMarkdown} defaultTitle="ロードマップ" idPrefix="roadmap" initialValue={initialMemoValue} pageTitle="ロードマップ" storageKey={memoStorageKey} />
    </div>
    <div className="roadmapTabPanel" hidden={activeTab !== "annual"}>
      <Roadmap2Client initialValue={initialRoadmap2Value} initialPlannerValue={initialPlannerValue} />
    </div>
    <div className="roadmapTabPanel" hidden={activeTab !== "vision"}>
      <VisionClient initialValue={initialVisionValue} />
    </div>
    <div className="roadmapTabPanel" hidden={activeTab !== "wants"}>
      <WantsClient initialValue={initialWantsValue} />
    </div>
    <div className="roadmapTabPanel" hidden={activeTab !== "achievements"}>
      <AchievementsClient initialValue={initialAchievementsValue} />
    </div>
  </main>;
}
