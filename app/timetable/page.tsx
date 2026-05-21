import TimetableClient from "../../components/TimetableClient";
import { getPlannerState } from "../../lib/server-state";

export default async function TimetablePage() {
  const planner = await getPlannerState();

  return <TimetableClient initialPlannerValue={planner} />;
}
