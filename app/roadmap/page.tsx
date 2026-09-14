import RoadmapTabs from "../../components/RoadmapTabs";
import { getAchievementsState, getMemoState, getVisionState, getWantsState } from "../../lib/server-state";

export default async function RoadmapPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [memos, vision, wants, achievements] = await Promise.all([getMemoState(), getVisionState(), getWantsState(), getAchievementsState()]);
  const { tab } = await searchParams;

  return <RoadmapTabs initialMemoValue={memos.length > 0 ? memos : null} initialVisionValue={vision} initialWantsValue={wants} initialAchievementsValue={achievements} initialTab={tab === "vision" || tab === "wants" || tab === "achievements" ? tab : "roadmap"} />;
}
