import DailyReportClient from "../../components/reports/DailyReportClient";
import { getDailyReportState } from "../../lib/server-state";

export default async function DailyReportPage() {
  const dailyReport = await getDailyReportState();

  return <DailyReportClient initialValue={dailyReport} />;
}
