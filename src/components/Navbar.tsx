"use client";

import React from "react";
import Image from "next/image";
import { Tabs, Tab, Button } from "@mui/material";
import { TabOption } from "../types";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuth } from "@/context/AuthContext";
import { usePendingTransactionsQuery } from "@/hooks/usePendingTransactionsQuery";

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
}

const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  const isMobile = useIsMobile();
  const { data: pendingTransactions = [] } = usePendingTransactionsQuery();
  const { logout } = useAuth();

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
      {isMobile ? (
        <>
          <Tabs
            orientation="vertical"
            value={activeTab}
            onChange={(_, v) => onTabChange(v as TabOption)}
            textColor="inherit"
            indicatorColor="secondary"
            sx={{
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
            }}
          >
            <Tab
              label="Transactions"
              value={TabOption.Transactions}
              sx={getTabStyle(activeTab === TabOption.Transactions, isMobile)}
            />
            <Tab
              label={PendingTransactionsTabLabel(pendingTransactions.length)}
              value={TabOption.PendingTransactions}
              sx={getTabStyle(
                activeTab === TabOption.PendingTransactions,
                isMobile
              )}
              wrapped
              key={`pending-tab-${pendingTransactions.length}`}
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
              label="Imports"
              value={TabOption.Imports}
              sx={getTabStyle(activeTab === TabOption.Imports, isMobile)}
            />
            <Tab
              label="Summary"
              value={TabOption.Summary}
              sx={getTabStyle(activeTab === TabOption.Summary, isMobile)}
            />
            <Tab
              label="Trends"
              value={TabOption.Trends}
              sx={getTabStyle(activeTab === TabOption.Trends, isMobile)}
            />
            <Tab
              label="Settings"
              value={TabOption.Settings}
              sx={getTabStyle(activeTab === TabOption.Settings, isMobile)}
            />
          </Tabs>
          <div
            style={{
              width: "100%",
              height: 1,
              background: "var(--secondary)",
              margin: "2px 0 16px 0",
            }}
          />
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => logout()}
            sx={{
              width: "100%",
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 700,
            }}
          >
            Logout
          </Button>
        </>
      ) : (
        <>
          <Tabs
            orientation="horizontal"
            value={activeTab}
            onChange={(_, v) => onTabChange(v as TabOption)}
            textColor="inherit"
            indicatorColor="secondary"
            sx={{
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
            }}
          >
            <Tab
              label="Transactions"
              value={TabOption.Transactions}
              sx={getTabStyle(activeTab === TabOption.Transactions, isMobile)}
            />
            <Tab
              label={PendingTransactionsTabLabel(pendingTransactions.length)}
              value={TabOption.PendingTransactions}
              sx={getTabStyle(
                activeTab === TabOption.PendingTransactions,
                isMobile
              )}
              wrapped
              key={`pending-tab-${pendingTransactions.length}`}
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
              label="Imports"
              value={TabOption.Imports}
              sx={getTabStyle(activeTab === TabOption.Imports, isMobile)}
            />
            <Tab
              label="Summary"
              value={TabOption.Summary}
              sx={getTabStyle(activeTab === TabOption.Summary, isMobile)}
            />
            <Tab
              label="Trends"
              value={TabOption.Trends}
              sx={getTabStyle(activeTab === TabOption.Trends, isMobile)}
            />
            <Tab
              label="Settings"
              value={TabOption.Settings}
              sx={getTabStyle(activeTab === TabOption.Settings, isMobile)}
            />
          </Tabs>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginLeft: 16,
            }}
          >
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => logout()}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 700,
                minWidth: 100,
              }}
            >
              Logout
            </Button>
          </div>
        </>
      )}
    </nav>
  );
};

export default Navbar;
