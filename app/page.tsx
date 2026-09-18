import HomeClient from "../components/HomeClient";
import { getAnnualRoadmapState, getPlannerState, getShoppingListState, getWantsState } from "../lib/server-state";

export default async function HomePage() {
  const [planner, annualRoadmap, wants, shoppingList] = await Promise.all([getPlannerState(), getAnnualRoadmapState(), getWantsState(), getShoppingListState()]);
  return <HomeClient initialPlannerValue={planner} initialAnnualRoadmapValue={annualRoadmap} initialWantsValue={wants} initialShoppingListValue={shoppingList} />;
}
