"use client";

import React, { useState } from "react";
import Navbar from "../components/Navbar";
import SummaryChart from "@/components/SummaryChart";
import TransactionsTab from "./tabs/TransactionsTab";
import ScheduledTransactionsTab from "./tabs/ScheduledTransactionsTab";
import PendingTransactionsTab from "./tabs/PendingTransactionsTab";
import { Box } from "@mui/material";
import { TabOption } from "../types";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabOption>(TabOption.Transactions);

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
          onTabChange={(tab) => setActiveTab(tab as TabOption)}
        />
        <Box sx={{ flex: 1, pl: 3 }}>
          {activeTab === TabOption.Summary ? (
            <SummaryChart />
          ) : activeTab === TabOption.ScheduledTransactions ? (
            <ScheduledTransactionsTab />
          ) : activeTab === TabOption.PendingTransactions ? (
            <PendingTransactionsTab />
          ) : (
            <TransactionsTab />
          )}
        </Box>
      </Box>
    </div>
  );
}
