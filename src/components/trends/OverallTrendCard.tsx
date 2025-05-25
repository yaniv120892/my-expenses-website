import { Box, Typography, Card, CardContent } from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { SpendingTrend, TransactionType, TrendPeriod } from "@/types/trends";
import { Category } from "@/types";
import { TrendIcon } from "./TrendIcon";
import { formatTrendDate } from "@/utils/dateUtils";

interface OverallTrendCardProps {
  trend: SpendingTrend;
  selectedCategory: string;
  categories: Category[];
  transactionType: TransactionType;
  period: TrendPeriod;
}

export const OverallTrendCard = ({
  trend,
  selectedCategory,
  categories,
  transactionType,
  period,
}: OverallTrendCardProps) => {
  if (!trend.points.length) {
    return (
      <Card sx={{ mb: 4 }}>
        <Typography
          variant="body2"
          color="var(--text-color)"
          textAlign="center"
          bgcolor="var(--background)"
        >
          No transactions found for selected period and category
        </Typography>
      </Card>
    );
  }

  return (
    <Card sx={{ mb: 4 }}>
      <CardContent sx={{ backgroundColor: "var(--background)" }}>
        <Typography variant="h6" gutterBottom color="var(--text-color)">
          {selectedCategory !== "All Categories"
            ? `${categories.find((c) => c.id === selectedCategory)?.name} `
            : "Overall "}
          {transactionType === "EXPENSE" ? "Spending" : "Income"} Trend
          <TrendIcon trend={trend.trend} />
        </Typography>
        <Box sx={{ display: "flex", gap: 2, mt: 2, flexWrap: "wrap" }}>
          <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
            <Typography variant="body2" color="var(--text-color)">
              Total {transactionType === "EXPENSE" ? "Spending" : "Income"}
            </Typography>
            <Typography variant="h6" color="var(--text-color)">
              ₪{trend.totalAmount.toFixed(2)}
            </Typography>
          </Box>
          <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
            <Typography variant="body2" color="var(--text-color)">
              Change from Previous Period
            </Typography>
            <Typography
              variant="h6"
              color={trend.percentageChange > 0 ? "error.main" : "success.main"}
            >
              {trend.percentageChange > 0 ? "+" : ""}
              {trend.percentageChange.toFixed(1)}%
            </Typography>
          </Box>
        </Box>
        <Box sx={{ height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={trend.points}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255, 255, 255, 0.1)"
              />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => formatTrendDate(date, period)}
                stroke="var(--text-color)"
                tick={{ fill: "var(--text-color)" }}
                reversed={true}
              />
              <YAxis
                stroke="var(--text-color)"
                tick={{ fill: "var(--text-color)" }}
              />
              <Tooltip
                labelFormatter={(date) => formatTrendDate(date, period)}
                formatter={(value: number) => [
                  `₪${value.toFixed(2)}`,
                  "Amount",
                ]}
                contentStyle={{
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--text-color)",
                  color: "var(--text-color)",
                }}
              />
              <Legend wrapperStyle={{ color: "var(--text-color)" }} />
              <Line
                type="monotone"
                dataKey="amount"
                name={`${
                  selectedCategory !== "All Categories"
                    ? categories.find((c) => c.id === selectedCategory)?.name +
                      " "
                    : ""
                }${transactionType === "EXPENSE" ? "Spending" : "Income"}`}
                stroke="#8884d8"
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};
