import ListsClient from "../../components/ListsClient";
import { getFixedCostsState, getShoppingListState, getWantsState } from "../../lib/server-state";

export default async function ListsPage() {
  const [wants, shopping, fixedCosts] = await Promise.all([getWantsState(), getShoppingListState(), getFixedCostsState()]);
  return <ListsClient wants={wants} shopping={shopping} fixedCosts={fixedCosts} />;
}
