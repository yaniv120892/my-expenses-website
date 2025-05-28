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

/**
 * Format a date string to a readable date string
 * @param dateString - The date string to format
 * @param includeTime - Whether to include the time in the formatted date
 * @returns The formatted date string in the format of DD/MM/YYYY HH:MM
 */
export const formatDate = (
  dateString: string,
  includeTime: boolean = false
) => {
  const date = new Date(dateString);
  if (includeTime) {
    return format(date, "dd/MM/yyyy HH:mm");
  }
  return date.toLocaleDateString();
};
