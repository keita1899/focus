import CutoutsClient from "../../components/CutoutsClient";
import { getCutoutsState } from "../../lib/server-state";

export default async function CutoutsPage() {
  const cutouts = await getCutoutsState();

  return <CutoutsClient initialValue={cutouts} />;
}
