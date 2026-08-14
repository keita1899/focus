import RoadmapTabs from "../../components/RoadmapTabs";
import { getMemoState, getRoadmap2State } from "../../lib/server-state";

export default async function RoadmapPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const memos = await getMemoState();
  const roadmap2 = await getRoadmap2State();
  const { tab } = await searchParams;

  return <RoadmapTabs initialMemoValue={memos.length > 0 ? memos : null} initialRoadmap2Value={roadmap2} initialTab={tab === "annual" ? "annual" : "roadmap"} />;
}
