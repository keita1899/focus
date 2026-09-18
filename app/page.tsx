import HomeClient from "../components/HomeClient";
import { getAnnualRoadmapState, getPlannerState } from "../lib/server-state";

export default async function HomePage() {
  const [planner, annualRoadmap] = await Promise.all([getPlannerState(), getAnnualRoadmapState()]);
  return <HomeClient initialPlannerValue={planner} initialAnnualRoadmapValue={annualRoadmap} />;
}
