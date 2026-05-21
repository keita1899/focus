import DiaryClient from "../../components/DiaryClient";
import { getDiaryState } from "../../lib/server-state";

export default async function DiaryPage() {
  const diary = await getDiaryState();

  return <DiaryClient initialValue={diary} />;
}
