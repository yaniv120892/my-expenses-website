"use client";

import React from "react";
import Image from "next/image";
import { Tabs, Tab } from "@mui/material";

interface NavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
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
        onChange={(_, v) => onTabChange(v)}
        textColor="inherit"
        TabIndicatorProps={{ style: { background: "var(--secondary)" } }}
        sx={{ width: "100%" }}
      >
        <Tab
          label="Transactions"
          value="transactions"
          sx={{
            color:
              activeTab === "transactions"
                ? "var(--secondary)"
                : "var(--accent-red)",
            fontWeight: 700,
            borderRadius: 2,
            mb: 1,
            background:
              activeTab === "transactions"
                ? "var(--secondary-light)"
                : "transparent",
            transition: "background 0.2s, color 0.2s",
          }}
        />
        <Tab
          label="Summary"
          value="summary"
          sx={{
            color:
              activeTab === "summary"
                ? "var(--accent-red)"
                : "var(--secondary)",
            fontWeight: 700,
            borderRadius: 2,
            background:
              activeTab === "summary"
                ? "var(--accent-red-light)"
                : "transparent",
            transition: "background 0.2s, color 0.2s",
          }}
        />
      </Tabs>
    </nav>
  );
};

export default Navbar;
