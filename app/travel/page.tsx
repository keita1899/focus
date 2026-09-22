import TravelListClient from "../../components/TravelListClient";
import { getTravelState } from "../../lib/server-state";

export default async function TravelPage() { return <TravelListClient initialValue={await getTravelState()} />; }
