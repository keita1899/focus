import HomeClient from "../components/HomeClient";
import { getPlannerState } from "../lib/server-state";

export default async function HomePage() {
  const planner = await getPlannerState();
  return <HomeClient initialPlannerValue={planner} />;
}
