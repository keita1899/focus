import RoadmapTabs from "../../components/RoadmapTabs";
import { getMemoState, getRoadmap2State, getVisionState } from "../../lib/server-state";

export default async function RoadmapPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const memos = await getMemoState();
  const roadmap2 = await getRoadmap2State();
  const vision = await getVisionState();
  const { tab } = await searchParams;

  return <RoadmapTabs initialMemoValue={memos.length > 0 ? memos : null} initialRoadmap2Value={roadmap2} initialVisionValue={vision} initialTab={tab === "annual" || tab === "vision" ? tab : "roadmap"} />;
}
