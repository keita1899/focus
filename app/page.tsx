import HomeClient from "../components/HomeClient";
import { getDiaryState, getPlannerState } from "../lib/server-state";

export default async function HomePage() {
  const [planner, diary] = await Promise.all([getPlannerState(), getDiaryState()]);
  return <HomeClient initialPlannerValue={planner} initialDiaryValue={diary} />;
}
