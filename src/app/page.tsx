"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Navbar from "../components/Navbar";
import SummaryChart from "@/components/SummaryChart";
import TransactionsTab from "./tabs/TransactionsTab";
import ScheduledTransactionsTab from "./tabs/ScheduledTransactionsTab";
import PendingTransactionsTab from "./tabs/PendingTransactionsTab";
import SettingsTab from "./tabs/SettingsTab";
import TrendsTab from "./tabs/TrendsTab";
import { Box, Fade } from "@mui/material";
import { TabOption } from "../types";
import { useIsMobile } from "../hooks/useIsMobile";
import ProtectedRoute from "../components/ProtectedRoute";

function getTabLabel(tab: TabOption) {
  if (tab === TabOption.Transactions) return "Transactions";
  if (tab === TabOption.PendingTransactions) return "Pending Transactions";
  if (tab === TabOption.ScheduledTransactions) return "Scheduled Transactions";
  if (tab === TabOption.Summary) return "Summary";
  if (tab === TabOption.Settings) return "Settings";
  if (tab === TabOption.Trends) return "Trends";
  return "";
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState(TabOption.Transactions);
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  function renderTabContent(tab: TabOption) {
    switch (tab) {
      case TabOption.Summary: {
        return <SummaryChart />;
      }
      case TabOption.ScheduledTransactions: {
        return <ScheduledTransactionsTab />;
      }
      case TabOption.PendingTransactions: {
        return (
          <PendingTransactionsTab
          />
        );
      }
      case TabOption.Settings: {
        return <SettingsTab />;
      }
      case TabOption.Trends: {
        return <TrendsTab />;
      }
      case TabOption.Transactions:
      default: {
        return <TransactionsTab />;
      }
    }
  }

  if (!isMounted) {
    return null;
  }

  if (isMobile) {
    return (
      <ProtectedRoute>
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
                  width: 260,
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
                <Navbar
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                />
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
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div>
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box sx={{ width: "100%", position: "sticky", top: 0, zIndex: 10 }}>
            <Navbar
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </Box>
          <Box sx={{ flex: 1, pt: 0, pr: 3, pb: 3, pl: 3 }}>
            {renderTabContent(activeTab)}
          </Box>
        </Box>
      </div>
    </ProtectedRoute>
  );
}
