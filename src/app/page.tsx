"use client";

import React, { useState } from "react";
import Navbar from "../components/Navbar";
import SummaryChart from "@/components/SummaryChart";
import TransactionsTab from "./tabs/TransactionsTab";
import ScheduledTransactionsTab from "./tabs/ScheduledTransactionsTab";
import PendingTransactionsTab from "./tabs/PendingTransactionsTab";
import { Box } from "@mui/material";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<
    | "transactions"
    | "summary"
    | "scheduled-transactions"
    | "pending-transactions"
  >("transactions");

  return (
    <div>
      <Box
        sx={{
          minHeight: "100vh",
          py: 4,
          display: "flex",
          flexDirection: "row",
        }}
      >
        <Navbar
          activeTab={activeTab}
          onTabChange={(tab) =>
            setActiveTab(
              tab as
                | "transactions"
                | "summary"
                | "scheduled-transactions"
                | "pending-transactions"
            )
          }
        />
        <Box sx={{ flex: 1, pl: 3 }}>
          {activeTab === "summary" ? (
            <SummaryChart />
          ) : activeTab === "scheduled-transactions" ? (
            <ScheduledTransactionsTab />
          ) : activeTab === "pending-transactions" ? (
            <PendingTransactionsTab />
          ) : (
            <TransactionsTab />
          )}
        </Box>
      </Box>
    </div>
  );
}
