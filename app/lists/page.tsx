import ListsClient from "../../components/ListsClient";
import { getFixedCostsState, getPrefectureListState, getShoppingListState, getWantsState } from "../../lib/server-state";

export default async function ListsPage() {
  const [wants, shopping, fixedCosts, prefectures] = await Promise.all([getWantsState(), getShoppingListState(), getFixedCostsState(), getPrefectureListState()]);
  return <ListsClient wants={wants} shopping={shopping} fixedCosts={fixedCosts} prefectures={prefectures} />;
}
