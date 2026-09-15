import HomeClient from "../components/HomeClient";
import { getDiaryState, getMemoState, getPlannerState, getShoppingListState, getVisionState, getWantsState } from "../lib/server-state";

export default async function HomePage() {
  const [planner, diary, memos, vision, wants, shoppingList] = await Promise.all([getPlannerState(), getDiaryState(), getMemoState(), getVisionState(), getWantsState(), getShoppingListState()]);
  return <HomeClient initialPlannerValue={planner} initialDiaryValue={diary} initialMemoValue={memos.length ? memos : null} initialVisionValue={vision} initialWantsValue={wants} initialShoppingListValue={shoppingList} />;
}
