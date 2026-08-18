import RoadmapTabs from "../../components/RoadmapTabs";
import { getMemoState, getPlannerState, getRoadmap2State, getVisionState } from "../../lib/server-state";

export default async function RoadmapPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [memos, roadmap2, planner, vision] = await Promise.all([getMemoState(), getRoadmap2State(), getPlannerState(), getVisionState()]);
  const { tab } = await searchParams;

  return <RoadmapTabs initialMemoValue={memos.length > 0 ? memos : null} initialRoadmap2Value={roadmap2} initialPlannerValue={planner} initialVisionValue={vision} initialTab={tab === "annual" || tab === "vision" ? tab : "roadmap"} />;
}
