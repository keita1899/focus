import LearningsClient from "../../components/LearningsClient";
import { getLearningsState } from "../../lib/server-state";

export default async function LearningsPage() {
  return <LearningsClient initialValue={await getLearningsState()} />;
}
