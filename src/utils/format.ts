import { ScheduleType, Transaction } from "../types";
import { format } from "date-fns";

export function formatTransactionDate(date: string) {
  return format(new Date(date), "yyyy-MM-dd");
}

export function formatTransaction(transaction: Transaction) {
  return `${transaction.description} - (${
    transaction.category?.name || "N/A"
  }) on ${formatTransactionDate(transaction.date)}`;
}

export function formatNumber(value: number) {
  return value.toLocaleString();
}

export function translateToScheduleSummary(
  scheduleType: ScheduleType,
  interval: number | undefined,
  dayOfWeek: number | undefined,
  dayOfMonth: number | undefined
) {
  const baseIntervalText =
    interval && interval > 1 ? `every ${interval} ` : "every ";
  if (scheduleType === "DAILY") {
    return `Runs ${baseIntervalText.trim()} day${
      interval && interval > 1 ? "s" : ""
    }.`;
  }
  if (scheduleType === "WEEKLY") {
    if (!dayOfWeek) return "Choose a day of week.";
    const weekInterval =
      interval && interval > 1 ? `every ${interval} weeks` : "every week";
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return `Runs ${weekInterval} on ${days[(dayOfWeek - 1) % 7]}.`;
  }
  if (scheduleType === "MONTHLY") {
    if (!dayOfMonth) return "Choose a day of month.";
    const monthInterval =
      interval && interval > 1 ? `every ${interval} months` : "every month";
    return `Runs ${monthInterval} on day ${dayOfMonth}.`;
  }
  return "";
}
