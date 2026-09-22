import TravelNewClient from "../../../components/TravelNewClient";
import { getTravelState } from "../../../lib/server-state";

export default async function TravelNewPage() { return <TravelNewClient initialValue={await getTravelState()} />; }
