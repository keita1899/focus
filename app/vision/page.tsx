import VisionClient from "../../components/VisionClient";
import { getVisionState } from "../../lib/server-state";

export default async function VisionPage() {
  return <VisionClient initialValue={await getVisionState()} />;
}
