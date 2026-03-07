import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  IconButton,
  Collapse,
} from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  CategorySpendingTrend,
  TransactionType,
  TrendPeriod,
} from "@/types/trends";
import { TrendIcon } from "./TrendIcon";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { formatTrendDate } from "@/utils/dateUtils";

interface CategoryTrendCardProps {
  trend: CategorySpendingTrend;
  transactionType: TransactionType;
  period: TrendPeriod;
  isExpanded: boolean;
  onExpand: (categoryId: string) => void;
}

export const CategoryTrendCard = ({
  trend,
  transactionType,
  period,
  isExpanded,
  onExpand,
}: CategoryTrendCardProps) => {
  return (
    <Card sx={{ mb: 3, border: 1, borderColor: "text.primary" }}>
      <Box sx={{ display: "flex", backgroundColor: "background.default" }}>
        <CardActionArea
          onClick={() => onExpand(trend.categoryId)}
          sx={{ flex: 1, backgroundColor: "background.default" }}
        >
          <CardContent>
            <Box>
              <Typography
                variant="h6"
                gutterBottom
                color="text.primary"
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                {trend.categoryName}{" "}
                {transactionType === "EXPENSE" ? "Spending" : "Income"}
                <TrendIcon trend={trend.trend} />
              </Typography>
              <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <Box>
                  <Typography variant="body2" color="text.primary">
                    Total{" "}
                    {transactionType === "EXPENSE" ? "Spending" : "Income"}
                  </Typography>
                  <Typography variant="h6" color="text.primary">
                    ₪{trend.totalAmount.toFixed(2)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.primary">
                    Change from Previous Period
                  </Typography>
                  <Typography
                    variant="h6"
                    color={
                      trend.percentageChange > 0 ? "error.main" : "success.main"
                    }
                  >
                    {trend.percentageChange > 0 ? "+" : ""}
                    {trend.percentageChange.toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </CardActionArea>
        <Box sx={{ display: "flex", alignItems: "center", p: 2 }}>
          <IconButton onClick={() => onExpand(trend.categoryId)}>
            {isExpanded ? (
              <ExpandLessIcon sx={{ color: "text.primary" }} />
            ) : (
              <ExpandMoreIcon sx={{ color: "text.primary" }} />
            )}
          </IconButton>
        </Box>
      </Box>
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <CardContent sx={{ backgroundColor: "background.default" }}>
          <Box sx={{ height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={trend.points}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--text-secondary)"
                  strokeOpacity={0.3}
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
                <Line
                  type="monotone"
                  dataKey="amount"
                  name="Spending"
                  stroke="#82ca9d"
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </CardContent>
      </Collapse>
    </Card>
  );
};
