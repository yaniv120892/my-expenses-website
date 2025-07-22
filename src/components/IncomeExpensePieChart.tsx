import React from "react";
import { Box, Typography, Skeleton } from "@mui/material";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import type { TooltipProps } from "recharts";
import { COLORS } from "@/utils/constants";
import { formatNumber } from "@/utils/format";

const PIE_COLORS = [COLORS.income, COLORS.expense];

interface PieTooltipPayload {
  name: string;
  value: number;
}

const CompactTooltip: React.FC<
  Pick<TooltipProps<number, string>, "active" | "payload">
> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const { name, value } = payload[0] as PieTooltipPayload;
  return (
    <div
      style={{
        background: "var(--background)",
        color: "var(--text-color)",
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 6,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        minWidth: 0,
        pointerEvents: "auto",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontWeight: 500 }}>{name}:</span> ₪
      {value.toLocaleString("he-IL")}
    </div>
  );
};

interface Props {
  income: number;
  expense: number;
  loading?: boolean;
  error?: string | null;
  title?: string;
}

const IncomeExpensePieChart: React.FC<Props> = ({
  income,
  expense,
  loading,
  error,
  title,
}) => {
  const pieData = [
    { name: "Income", value: income },
    { name: "Expense", value: expense },
  ];

  const total = income - expense;

  return (
    <Box sx={{ mb: 3, maxWidth: 400 }}>
      {title && (
        <Box sx={{ mb: 1, fontWeight: 700, color: "var(--text-color)" }}>
          {title}
        </Box>
      )}
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
        }}
      >
        {loading ? (
          <>
            <Skeleton
              variant="circular"
              width={140}
              height={140}
              sx={{ bgcolor: "var(--secondary)" }}
            />
            <Box
              display="flex"
              flexDirection="column"
              alignItems="flex-start"
              minWidth={120}
              gap={1}
            >
              <Skeleton
                variant="text"
                width={80}
                height={18}
                sx={{ bgcolor: "var(--secondary)" }}
              />
              <Skeleton
                variant="text"
                width={80}
                height={18}
                sx={{ bgcolor: "var(--secondary)" }}
              />
              <Skeleton
                variant="text"
                width={80}
                height={18}
                sx={{ bgcolor: "var(--secondary)" }}
              />
            </Box>
          </>
        ) : error ? (
          <Box color="#e74c3c">Failed to load summary</Box>
        ) : (
          <PieChart width={140} height={140} style={{ margin: "0 auto" }}>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={60}
              innerRadius={36}
              stroke="#fff"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
            >
              {pieData.map((entry, idx) => (
                <Cell
                  key={entry.name}
                  fill={PIE_COLORS[idx % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CompactTooltip />} />
          </PieChart>
        )}
        {!loading && !error && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="flex-start"
            minWidth={120}
          >
            <Typography fontWeight={400} color={COLORS.text} fontSize={12}>
              Income: ₪{formatNumber(income)}
            </Typography>
            <Typography fontWeight={400} color={COLORS.text} fontSize={12}>
              Expenses: ₪{formatNumber(expense)}
            </Typography>
            <Typography
              fontWeight={700}
              color={total >= 0 ? COLORS.income : COLORS.expense}
              fontSize={14}
            >
              Total: ₪{formatNumber(Math.abs(Math.round(total)))}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default IncomeExpensePieChart;
