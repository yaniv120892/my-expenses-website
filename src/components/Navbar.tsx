"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { Tabs, Tab } from "@mui/material";
import { TabOption, Transaction } from "../types";
import { useIsMobile } from "@/hooks/useIsMobile";

function getTabStyle(isSelected: boolean, isMobile: boolean) {
  return {
    color: "var(--secondary)",
    fontWeight: 700,
    borderRadius: 2,
    mb: 0,
    fontSize: isMobile ? 13 : 16,
    background: isSelected ? "var(--secondary-light)" : "transparent",
    transition: "background 0.2s, color 0.2s",
    minHeight: isMobile ? 36 : 48,
    minWidth: 120,
    padding: isMobile ? "8px 15px" : "8px 20px",
  };
}

function PendingTransactionsTabLabel(pendingCount: number) {
  if (pendingCount > 0) {
    return (
      <span style={{ position: "relative", display: "inline-block" }}>
        Pending Transactions
        <span
          style={{
            position: "absolute",
            top: -8,
            right: -18,
            minWidth: 18,
            height: 18,
            background: "#e74c3c",
            color: "#fff",
            borderRadius: 9,
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 5px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            zIndex: 1,
          }}
        >
          {pendingCount}
        </span>
      </span>
    );
  }
  return "Pending Transactions";
}

interface NavbarProps {
  activeTab: TabOption;
  onTabChange: (tab: TabOption) => void;
  pendingTransactions: Transaction[];
  fetchPendingTransactions: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  pendingTransactions,
  fetchPendingTransactions,
}) => {
  const isMobile = useIsMobile();
  const pendingCount = pendingTransactions.length;

  useEffect(() => {
    fetchPendingTransactions();
  }, []);

  return (
    <nav
      style={
        isMobile
          ? {
              minWidth: 220,
              maxWidth: 260,
              padding: "2rem 1rem 1rem 1rem",
              borderRight: "2px solid var(--secondary)",
              background: "var(--background)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              height: "100vh",
              position: "sticky",
              top: 0,
              zIndex: 10,
              boxShadow: "0 2px 16px 0 rgba(123,97,255,0.08)",
            }
          : {
              width: "100%",
              minWidth: 0,
              maxWidth: "100vw",
              padding: "0.5rem 0.5rem 0 0.5rem",
              borderRight: "none",
              borderBottom: "2px solid var(--secondary)",
              background: "var(--background)",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              height: 64,
              position: "sticky",
              top: 0,
              zIndex: 10,
              boxShadow: "0 2px 16px 0 rgba(123,97,255,0.08)",
              overflowX: "auto",
            }
      }
    >
      <Image
        src="/my-expenses-logo.png"
        alt="My Expenses Logo"
        width={isMobile ? 40 : 80}
        height={isMobile ? 40 : 80}
        priority
        style={
          isMobile
            ? {
                marginBottom: 32,
                borderRadius: 16,
                boxShadow: "0 2px 8px var(--accent-red-light)",
              }
            : {
                marginRight: 16,
                borderRadius: 8,
                boxShadow: "0 2px 8px var(--accent-red-light)",
              }
        }
      />
      <Tabs
        orientation={isMobile ? "vertical" : "horizontal"}
        value={activeTab}
        onChange={(_, v) => onTabChange(v as TabOption)}
        textColor="inherit"
        indicatorColor="secondary"
        sx={
          isMobile
            ? {
                height: "100%",
                width: "auto",
                flexDirection: "column",
                minWidth: 36,
                ml: 0,
                flex: 1,
                "& .MuiTabs-indicator": {
                  background: "var(--secondary)",
                  width: 3,
                  right: 0,
                  left: "unset",
                  top: 0,
                  bottom: 0,
                },
              }
            : {
                width: "100%",
                minHeight: 36,
                ml: 2,
                flex: 1,
                flexDirection: "row",
                gap: 8,
                "& .MuiTabs-indicator": {
                  background: "var(--secondary)",
                  height: 3,
                },
              }
        }
      >
        <Tab
          label="Transactions"
          value={TabOption.Transactions}
          sx={getTabStyle(activeTab === TabOption.Transactions, isMobile)}
        />
        <Tab
          label={PendingTransactionsTabLabel(pendingCount)}
          value={TabOption.PendingTransactions}
          sx={getTabStyle(
            activeTab === TabOption.PendingTransactions,
            isMobile
          )}
          wrapped
          key={`pending-tab-${pendingCount}`}
        />
        <Tab
          label="Scheduled Transactions"
          value={TabOption.ScheduledTransactions}
          sx={getTabStyle(
            activeTab === TabOption.ScheduledTransactions,
            isMobile
          )}
        />
        <Tab
          label="Summary"
          value={TabOption.Summary}
          sx={getTabStyle(activeTab === TabOption.Summary, isMobile)}
        />
      </Tabs>
    </nav>
  );
};

export default Navbar;
