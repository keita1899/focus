import HomeClient from "../components/HomeClient";
import { getAchievementsState, getDiaryState, getMemoState, getPlannerState, getVisionState, getWantsState } from "../lib/server-state";

export default async function HomePage() {
  const [planner, diary, memos, vision, wants, achievements] = await Promise.all([getPlannerState(), getDiaryState(), getMemoState(), getVisionState(), getWantsState(), getAchievementsState()]);
  return <HomeClient initialPlannerValue={planner} initialDiaryValue={diary} initialMemoValue={memos.length ? memos : null} initialVisionValue={vision} initialWantsValue={wants} initialAchievementsValue={achievements} />;
}
