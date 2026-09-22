import TravelPlanClient from "../../../components/TravelPlanClient";
import { getTravelState } from "../../../lib/server-state";

export default async function TravelPlanPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <TravelPlanClient initialValue={await getTravelState()} tripId={id} />; }
