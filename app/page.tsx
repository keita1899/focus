import HomeClient from "../components/HomeClient";
import { getDiaryState, getPlannerState, getRoadmap2State } from "../lib/server-state";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [planner, diary, roadmap2, { tab }] = await Promise.all([getPlannerState(), getDiaryState(), getRoadmap2State(), searchParams]);
  return <HomeClient initialPlannerValue={planner} initialDiaryValue={diary} initialRoadmap2Value={roadmap2} initialHomeTab={tab === "annual" ? "annual" : "today"} />;
}
