import React, { useEffect, useState } from "react";
import { Box, Typography, CircularProgress, Paper } from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import dayjs from "dayjs";
import {
  getTransactionSummary,
  getTransactions,
} from "../services/transactions";
import { Transaction } from "@/types";
import { formatNumber } from "@/utils/format";

// Color palette
const COLORS = {
  income: "#2ecc40", // green
  expense: "#e74c3c", // red
  background: "var(--background)",
  purple: "#7c3aed",
  text: "var(--text-color)",
};

// 5 distinct colors for doughnut chart (not black/purple/red/green)
const DOUGHNUT_COLORS = [
  "#f39c12", // orange
  "#3498db", // blue
  "#e67e22", // dark orange
  "#9b59b6", // violet
  "#1abc9c", // teal
];

// Types
interface MonthSummary {
  month: string; // e.g. '2024-12'
  income: number;
  expense: number;
}

const getLast6Months = () => {
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    months.push(dayjs().subtract(i, "month").format("YYYY-MM"));
  }
  return months.reverse();
};

const fetchLast6MonthsSummary = async (): Promise<MonthSummary[]> => {
  const months = getLast6Months();
  const promises = months.map(async (m) => {
    const startDate = dayjs(m + "-01")
      .startOf("month")
      .format("YYYY-MM-DD");
    const endDate = dayjs(m + "-01")
      .endOf("month")
      .format("YYYY-MM-DD");
    try {
      const summary = await getTransactionSummary({ startDate, endDate });
      return {
        month: m,
        income: summary.totalIncome || 0,
        expense: summary.totalExpense || 0,
      };
    } catch (err) {
      console.error(`[SummaryChart] Failed to fetch summary for`, {
        startDate,
        endDate,
        err,
      });
      return {
        month: m,
        income: 0,
        expense: 0,
      };
    }
  });
  return Promise.all(promises).then((results) => results);
};

// Custom compact tooltip for PieChart
const CompactTooltip: React.FC<{
  active?: boolean;
  payload?: { name: string; value: number }[];
}> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const { name, value } = payload[0];
  return (
    <div
      style={{
        background: COLORS.background,
        color: COLORS.text,
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 6,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        minWidth: 0,
        pointerEvents: "auto",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontWeight: 500 }}>{name}:</span> {formatNumber(value)}
    </div>
  );
};

const SummaryChart: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MonthSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [topCategories, setTopCategories] = useState<
    { name: string; value: number }[]
  >([]);

  useEffect(() => {
    setLoading(true);
    fetchLast6MonthsSummary()
      .then(setData)
      .catch(() => setError("Failed to load summary"))
      .finally(() => setLoading(false));

    // Fetch all expense transactions for the last 6 months and compute top 5 categories
    const fetchTopCategories = async () => {
      const startDate = dayjs()
        .subtract(5, "month")
        .startOf("month")
        .format("YYYY-MM-DD");
      const endDate = dayjs().endOf("month").format("YYYY-MM-DD");
      let page = 1;
      let allExpenses: Transaction[] = [];
      let hasMore = true;
      while (hasMore) {
        const txs: Transaction[] = await getTransactions({
          type: "EXPENSE",
          startDate,
          endDate,
          page,
          perPage: 100,
        });
        allExpenses = allExpenses.concat(txs);
        hasMore = txs.length === 100;
        page++;
      }
      // Aggregate by category
      const categoryTotals: Record<string, { name: string; value: number }> =
        {};
      allExpenses.forEach((tx) => {
        if (!tx.category) return;
        if (!categoryTotals[tx.category.id]) {
          categoryTotals[tx.category.id] = { name: tx.category.name, value: 0 };
        }
        categoryTotals[tx.category.id].value += tx.value;
      });
      // Sort and take top 5
      const sorted = Object.values(categoryTotals)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      setTopCategories(sorted);
    };
    fetchTopCategories();
  }, []);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={300}
      >
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Box textAlign="center" color={COLORS.expense} py={4} fontWeight={500}>
        {error}
      </Box>
    );
  }
  if (!data.length) {
    return (
      <Box textAlign="center" color={COLORS.text} py={4} fontWeight={500}>
        No data to display
      </Box>
    );
  }

  // Bar chart data (total for last 6 months)
  const totalIncome = data.reduce((sum, m) => sum + m.income, 0);
  const totalExpense = data.reduce((sum, m) => sum + m.expense, 0);
  const barData = [
    { name: "Income", value: totalIncome },
    { name: "Expense", value: totalExpense },
  ];

  return (
    <Paper
      sx={{
        background: COLORS.background,
        color: COLORS.text,
        p: 3,
        borderRadius: 4,
        boxShadow: 6,
        mb: 4,
      }}
    >
      <Typography variant="h6" fontWeight={700} mb={2} color={COLORS.text}>
        Summary (Last 6 Months)
      </Typography>
      <Box display="flex" flexDirection={{ xs: "column", md: "row" }} gap={4}>
        <Box flex={1} display="flex" flexDirection="column" gap={4}>
          <Box>
            <Typography variant="subtitle1" mb={1} color={COLORS.text}>
              Total Income vs Expense
            </Typography>
            <Box display="flex" flexDirection="row" alignItems="center" gap={4}>
              <ResponsiveContainer width="60%" height={180}>
                <BarChart
                  data={barData}
                  margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    stroke={COLORS.text}
                    tick={{ fill: COLORS.text, fontWeight: 500 }}
                  />
                  <YAxis stroke={COLORS.text} tick={{ fill: COLORS.text }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    <Cell fill={COLORS.income} />
                    <Cell fill={COLORS.expense} />
                    <LabelList
                      dataKey="value"
                      position="top"
                      fill={COLORS.text}
                      fontWeight={700}
                      formatter={formatNumber}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
          {topCategories.length > 0 && (
            <Box>
              <Typography variant="subtitle1" mb={1} color={COLORS.text}>
                Top 5 Expense Categories
              </Typography>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={topCategories}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    label={({ name, value }) => {
                      const total = topCategories.reduce(
                        (sum, c) => sum + c.value,
                        0
                      );
                      const percent = total > 0 ? (value / total) * 100 : 0;
                      return `${name}: ${percent.toFixed(1)}%`;
                    }}
                    stroke={COLORS.background}
                    strokeWidth={2}
                  >
                    {topCategories.map((entry, idx) => (
                      <Cell
                        key={entry.name}
                        fill={DOUGHNUT_COLORS[idx % DOUGHNUT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CompactTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Box>
        <Box flex={1}>
          <Typography variant="subtitle1" mb={1} color={COLORS.text}>
            Monthly Breakdown
          </Typography>
          <Box display="flex" flexDirection="column" gap={3}>
            {data.map((monthData) => {
              const pieData = [
                { name: "Income", value: monthData.income },
                { name: "Expense", value: monthData.expense },
              ];
              const total = monthData.income - monthData.expense;
              const monthLabel = dayjs(monthData.month + "-01").format(
                "MMMM YYYY"
              );
              return (
                <Box
                  key={monthData.month}
                  display="flex"
                  flexDirection="row"
                  alignItems="center"
                  gap={4}
                >
                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    minWidth={160}
                  >
                    <Typography
                      color={COLORS.text}
                      fontWeight={700}
                      fontSize={18}
                      mb={1}
                    >
                      {monthLabel}
                    </Typography>
                    <PieChart width={140} height={140}>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        innerRadius={36}
                        stroke={COLORS.background}
                        strokeWidth={2}
                        startAngle={90}
                        endAngle={-270}
                      >
                        <Cell key="income" fill={COLORS.income} />
                        <Cell key="expense" fill={COLORS.expense} />
                      </Pie>
                      <Tooltip content={<CompactTooltip />} />
                    </PieChart>
                  </Box>
                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="flex-start"
                    minWidth={120}
                  >
                    <Typography
                      fontWeight={400}
                      color={COLORS.text}
                      fontSize={12}
                    >
                      Income: ₪{formatNumber(monthData.income)}
                    </Typography>
                    <Typography
                      fontWeight={400}
                      color={COLORS.text}
                      fontSize={12}
                    >
                      Expenses: ₪{formatNumber(monthData.expense)}
                    </Typography>
                    <Typography
                      fontWeight={700}
                      color={total >= 0 ? COLORS.income : COLORS.expense}
                      fontSize={14}
                    >
                      Total: ₪{formatNumber(total)}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default SummaryChart;
