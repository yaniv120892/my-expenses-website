import { format } from "date-fns";
import { TrendPeriod } from "@/types/trends";

export function formatTrendDate(date: string, period: TrendPeriod): string {
  switch (period) {
    case "weekly":
      return `Week ${date.split("-")[1]}`;
    case "monthly":
      return format(new Date(date + "-01"), "MMM yyyy");
    case "yearly":
      return date;
    default:
      return date;
  }
}
