export type TravelEntryType = "transport" | "meal" | "snack" | "activity" | "lodging" | "souvenir";
export type TravelEntry = { id: string; type: TravelEntryType; title: string; cost: number; transportMode?: string; origin?: string; destination?: string; startTime?: string; endTime?: string };
export type TravelDay = { date: string; entries: TravelEntry[] };
export type TravelChecklistItem = { id: string; text: string; done: boolean };
export type Trip = { id: string; title: string; startDate: string; mode: "daytrip" | "stay"; nights: number; days: TravelDay[]; checklist: TravelChecklistItem[]; createdAt: string };
export type TravelState = { trips: Trip[] };

export const transportModes = ["徒歩", "電車", "新幹線", "バス", "飛行機", "車", "タクシー", "自転車", "船", "その他"];
export const transportModeIcons: Record<string, string> = { "徒歩": "🚶", "電車": "🚃", "新幹線": "🚄", "バス": "🚌", "飛行機": "✈️", "車": "🚗", "タクシー": "🚕", "自転車": "🚲", "船": "⛴️", "その他": "📍" };
export const entryTypeLabels: Record<TravelEntryType, string> = { transport: "移動", meal: "ごはん", snack: "軽食", activity: "観光", lodging: "宿泊", souvenir: "お土産" };

export function normalizeTravelState(value: unknown): TravelState {
  if (!value || typeof value !== "object") return { trips: [] };
  const trips = (value as { trips?: unknown }).trips;
  if (!Array.isArray(trips)) return { trips: [] };
  return { trips: trips.filter((trip): trip is Trip => Boolean(trip) && typeof trip === "object" && typeof (trip as Trip).id === "string").map((trip) => ({ ...trip, title: trip.title || "無題の旅行", mode: trip.mode === "stay" ? "stay" : "daytrip", nights: Number.isFinite(trip.nights) ? trip.nights : 0, days: Array.isArray(trip.days) ? trip.days.map((day) => ({ ...day, entries: Array.isArray(day.entries) ? day.entries : [] })) : [], checklist: Array.isArray(trip.checklist) ? trip.checklist : [], createdAt: trip.createdAt || new Date().toISOString() })) };
}

export function createTravelDays(startDate: string, count: number): TravelDay[] {
  const [year, month, day] = startDate.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const value = new Date(year, month - 1, day + index);
    return { date: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`, entries: [] };
  });
}

export function travelTotal(trip: Trip) { return trip.days.flatMap((day) => day.entries).reduce((sum, entry) => sum + (Number(entry.cost) || 0), 0); }
export function formatTravelDate(value: string) { return value ? new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${value}T00:00:00`)) : "日付未定"; }
