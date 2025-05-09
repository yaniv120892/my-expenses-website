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
} from "recharts";
import dayjs from "dayjs";
import { getTransactionSummary } from "../services/transactions";

// Color palette
const COLORS = {
  income: "#2ecc40", // green
  expense: "#e74c3c", // red
  background: "#18141c", // black
  purple: "#7c3aed",
  text: "#fff",
};

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
  return months;
};

const fetchLast6MonthsSummary = async (): Promise<MonthSummary[]> => {
  const months = getLast6Months();
  // Run all requests in parallel and log each request/response
  const promises = months.map(async (m) => {
    const startDate = dayjs(m + "-01")
      .startOf("month")
      .format("YYYY-MM-DD");
    const endDate = dayjs(m + "-01")
      .endOf("month")
      .format("YYYY-MM-DD");
    console.log(`[SummaryChart] Fetching summary for`, { startDate, endDate });
    try {
      const summary = await getTransactionSummary({ startDate, endDate });
      console.log(`[SummaryChart] Got summary for`, {
        startDate,
        endDate,
        summary,
      });
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
  return Promise.all(promises);
};

const SummaryChart: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MonthSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchLast6MonthsSummary()
      .then(setData)
      .catch(() => setError("Failed to load summary"))
      .finally(() => setLoading(false));
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

  // Pie chart data for each month
  const pieCharts = data.map((m) => {
    const pieData = [
      { name: "Income", value: m.income },
      { name: "Expense", value: m.expense },
    ];
    const label = dayjs(m.month + "-01").format("MMMM YYYY");
    return (
      <Box key={m.month} display="flex" alignItems="center" mb={2}>
        <PieChart width={80} height={80}>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={32}
            innerRadius={18}
            stroke={COLORS.background}
            strokeWidth={2}
            startAngle={90}
            endAngle={-270}
          >
            <Cell key="income" fill={COLORS.income} />
            <Cell key="expense" fill={COLORS.expense} />
          </Pie>
        </PieChart>
        <Typography ml={2} color={COLORS.text} fontWeight={500}>
          {label}
        </Typography>
      </Box>
    );
  });

  return (
    <Paper
      sx={{
        background: `linear-gradient(135deg, ${COLORS.background} 80%, ${COLORS.purple} 100%)`,
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
        <Box flex={1}>
          <Typography variant="subtitle1" mb={1} color={COLORS.text}>
            Total Income vs Expense
          </Typography>
          <ResponsiveContainer width="100%" height={180}>
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
              <Tooltip
                contentStyle={{
                  background: COLORS.background,
                  color: COLORS.text,
                  border: "none",
                }}
                labelStyle={{ color: COLORS.text }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                <Cell fill={COLORS.income} />
                <Cell fill={COLORS.expense} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
        <Box flex={1}>
          <Typography variant="subtitle1" mb={1} color={COLORS.text}>
            Monthly Breakdown
          </Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            {pieCharts}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default SummaryChart;
