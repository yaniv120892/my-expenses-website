"use client";

import React from "react";
import Image from "next/image";
import { Tabs, Tab } from "@mui/material";
import { TabOption } from "../types";

function getTabStyle(isSelected: boolean) {
  return {
    color: "var(--secondary)",
    fontWeight: 700,
    borderRadius: 2,
    mb: 1,
    background: isSelected ? "var(--secondary-light)" : "transparent",
    transition: "background 0.2s, color 0.2s",
  };
}

interface NavbarProps {
  activeTab: TabOption;
  onTabChange: (tab: TabOption) => void;
}

const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav
      style={{
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
      }}
    >
      <Image
        src="/my-expenses-logo.png"
        alt="My Expenses Logo"
        width={80}
        height={80}
        priority
        style={{
          marginBottom: 32,
          borderRadius: 16,
          boxShadow: "0 2px 8px var(--accent-red-light)",
        }}
      />
      <Tabs
        orientation="vertical"
        value={activeTab}
        onChange={(_, v) => onTabChange(v as TabOption)}
        textColor="inherit"
        indicatorColor="secondary"
        sx={{
          width: "100%",
          "& .MuiTabs-indicator": {
            background: "var(--secondary)",
          },
        }}
      >
        <Tab
          label="Transactions"
          value={TabOption.Transactions}
          sx={getTabStyle(activeTab === TabOption.Transactions)}
        />
        <Tab
          label="Pending Transactions"
          value={TabOption.PendingTransactions}
          sx={getTabStyle(activeTab === TabOption.PendingTransactions)}
        />
        <Tab
          label="Scheduled Transactions"
          value={TabOption.ScheduledTransactions}
          sx={getTabStyle(activeTab === TabOption.ScheduledTransactions)}
        />
        <Tab
          label="Summary"
          value={TabOption.Summary}
          sx={getTabStyle(activeTab === TabOption.Summary)}
        />
      </Tabs>
    </nav>
  );
};

export default Navbar;
