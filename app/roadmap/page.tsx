import RoadmapTabs from "../../components/RoadmapTabs";
import { getAchievementsState, getMemoState, getPlannerState, getRoadmap2State, getVisionState, getWantsState } from "../../lib/server-state";

export default async function RoadmapPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [memos, roadmap2, planner, vision, wants, achievements] = await Promise.all([getMemoState(), getRoadmap2State(), getPlannerState(), getVisionState(), getWantsState(), getAchievementsState()]);
  const { tab } = await searchParams;

  return <RoadmapTabs initialMemoValue={memos.length > 0 ? memos : null} initialRoadmap2Value={roadmap2} initialPlannerValue={planner} initialVisionValue={vision} initialWantsValue={wants} initialAchievementsValue={achievements} initialTab={tab === "annual" || tab === "vision" || tab === "wants" || tab === "achievements" ? tab : "roadmap"} />;
}
