import React from "react";
import { Box, Typography } from "@mui/material";
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
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: 140,
              width: 140,
            }}
          >
            <svg width="140" height="140">
              <circle cx="70" cy="70" r="60" fill="#f0f0f0" />
            </svg>
          </Box>
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
      </Box>
    </Box>
  );
};

export default IncomeExpensePieChart;
