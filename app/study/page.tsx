import StudyClient from "../../components/StudyClient";
import { getStudyState } from "../../lib/server-state";
export default async function StudyPage() { return <StudyClient initialValue={await getStudyState()} />; }
