"use client";

import React from "react";
import { Paper } from "@mui/material";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from "recharts";

type Props = {
  totalIncome: number;
  totalExpense: number;
};

export default function SummaryChart({ totalIncome, totalExpense }: Props) {
  const data = [
    { name: "Income", value: totalIncome },
    { name: "Expense", value: totalExpense },
  ];
  const COLORS = ["#4caf50", "#f44336"];
  const hasData = data.some((d) => d.value > 0);
  console.log("SummaryChart data", data);

  return (
    <Paper sx={{ p: 2 }}>
      {hasData ? (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          No data to display
        </div>
      )}
    </Paper>
  );
}
