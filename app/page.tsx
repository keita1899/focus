import HomeClient from "../components/HomeClient";
import { getAnnualRoadmapState, getDiaryState, getPlannerState, getShoppingListState, getVisionState, getWantsState } from "../lib/server-state";

export default async function HomePage() {
  const [planner, diary, annualRoadmap, vision, wants, shoppingList] = await Promise.all([getPlannerState(), getDiaryState(), getAnnualRoadmapState(), getVisionState(), getWantsState(), getShoppingListState()]);
  return <HomeClient initialPlannerValue={planner} initialDiaryValue={diary} initialAnnualRoadmapValue={annualRoadmap} initialVisionValue={vision} initialWantsValue={wants} initialShoppingListValue={shoppingList} />;
}
