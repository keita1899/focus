import VisionClient from "../../components/VisionClient";
import { getVisionState } from "../../lib/server-state";

export default async function VisionPage() {
  const vision = await getVisionState();
  return <VisionClient initialValue={vision} />;
}
