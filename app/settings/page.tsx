import SettingsClient from "../../components/SettingsClient";
import { getPlannerState } from "../../lib/server-state";

export default async function SettingsPage() {
  const planner = await getPlannerState();

  return <SettingsClient initialPlannerValue={planner} />;
}
