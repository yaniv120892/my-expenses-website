"use client";

import React, { useState } from "react";
import Image from "next/image";
import Navbar from "../components/Navbar";
import SummaryChart from "@/components/SummaryChart";
import TransactionsTab from "./tabs/TransactionsTab";
import ScheduledTransactionsTab from "./tabs/ScheduledTransactionsTab";
import PendingTransactionsTab from "./tabs/PendingTransactionsTab";
import { Box, Fade } from "@mui/material";
import { TabOption } from "../types";
import { useIsMobile } from "../hooks/useIsMobile";

function getTabLabel(tab: TabOption) {
  if (tab === TabOption.Transactions) return "Transactions";
  if (tab === TabOption.PendingTransactions) return "Pending Transactions";
  if (tab === TabOption.ScheduledTransactions) return "Scheduled Transactions";
  if (tab === TabOption.Summary) return "Summary";
  return "";
}

function renderTabContent(tab: TabOption) {
  if (tab === TabOption.Summary) return <SummaryChart />;
  if (tab === TabOption.ScheduledTransactions)
    return <ScheduledTransactionsTab />;
  if (tab === TabOption.PendingTransactions) return <PendingTransactionsTab />;
  return <TransactionsTab />;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState(TabOption.Transactions);
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();

  function handleMobileNavOpen() {
    setMobileNavOpen(true);
  }

  function handleMobileNavClose() {
    setMobileNavOpen(false);
  }

  function handleTabChange(tab: TabOption) {
    setActiveTab(tab);
    setMobileNavOpen(false);
  }

  if (isMobile) {
    return (
      <div style={{ position: "relative" }}>
        <Box
          sx={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            height: 64,
            px: 2,
            background: "var(--background)",
            borderBottom: "2px solid var(--secondary)",
            position: "sticky",
            top: 0,
            zIndex: 20,
          }}
        >
          <Box
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
            onClick={handleMobileNavOpen}
          >
            <Image
              src="/my-expenses-logo.png"
              alt="My Expenses Logo"
              width={40}
              height={40}
              priority
              style={{
                marginRight: 12,
                borderRadius: 8,
                boxShadow: "0 2px 8px var(--accent-red-light)",
              }}
            />
            <span
              style={{
                fontWeight: 700,
                fontSize: 18,
                color: "var(--secondary)",
              }}
            >
              {getTabLabel(activeTab)}
            </span>
          </Box>
        </Box>
        <Fade in={isMobileNavOpen} unmountOnExit>
          <Box
            sx={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              zIndex: 30,
              display: "flex",
            }}
          >
            <Box
              sx={{
                width: 240,
                maxWidth: "80vw",
                height: "100vh",
                background: "var(--background)",
                boxShadow: 6,
                p: 0,
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Navbar activeTab={activeTab} onTabChange={handleTabChange} />
            </Box>
            <Box
              sx={{
                flex: 1,
                height: "100vh",
                background: "rgba(0,0,0,0.3)",
              }}
              onClick={handleMobileNavClose}
            />
          </Box>
        </Fade>
        <Box sx={{ p: 2 }}>{renderTabContent(activeTab)}</Box>
      </div>
    );
  }

  return (
    <div>
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box sx={{ width: "100%", position: "sticky", top: 0, zIndex: 10 }}>
          <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
        </Box>
        <Box sx={{ flex: 1, pt: 0, pr: 3, pb: 3, pl: 3 }}>
          {renderTabContent(activeTab)}
        </Box>
      </Box>
    </div>
  );
}
