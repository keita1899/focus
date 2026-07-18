import Roadmap2Client from "../../components/Roadmap2Client";
import { getRoadmap2State } from "../../lib/server-state";

export default async function Roadmap2Page() {
  const roadmap2 = await getRoadmap2State();

  return <Roadmap2Client initialValue={roadmap2} />;
}
