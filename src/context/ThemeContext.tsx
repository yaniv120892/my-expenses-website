"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { lightTheme, darkTheme } from "@/theme/theme";

type ColorMode = "light" | "dark" | "system";

interface ThemeContextType {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  resolvedMode: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType>({
  colorMode: "system",
  setColorMode: () => {},
  resolvedMode: "light",
});

export function useColorMode() {
  return useContext(ThemeContext);
}

function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

const STORAGE_KEY = "color-mode";

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>("system");
  const [systemPreference, setSystemPreference] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ColorMode | null;
    if (stored && ["light", "dark", "system"].includes(stored)) {
      setColorModeState(stored);
    }
    setSystemPreference(getSystemPreference());

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? "dark" : "light");
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const setColorMode = (mode: ColorMode) => {
    setColorModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  };

  const resolvedMode = colorMode === "system" ? systemPreference : colorMode;
  const theme = useMemo(
    () => (resolvedMode === "dark" ? darkTheme : lightTheme),
    [resolvedMode]
  );

  // Sync CSS custom properties with MUI theme so var(--*) usages stay in sync
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedMode === "dark") {
      root.style.setProperty("--background", "#181a20");
      root.style.setProperty("--card-bg", "#23263a");
      root.style.setProperty("--foreground", "#fff");
      root.style.setProperty("--text-color", "#fff");
      root.style.setProperty("--text-secondary", "#b0b0b0");
      root.style.setProperty("--primary", "#e0e0e0");
      root.style.setProperty("--secondary", "#9b85ff");
      root.style.setProperty("--secondary-light", "#2d2b45");
      root.style.setProperty("--accent-red-light", "#3a1a24");
      root.style.setProperty(
        "--card-shadow",
        "0 4px 24px rgba(0,0,0,0.25)"
      );
    } else {
      root.style.setProperty("--background", "#f7f8fa");
      root.style.setProperty("--card-bg", "#ffffff");
      root.style.setProperty("--foreground", "#000");
      root.style.setProperty("--text-color", "#000");
      root.style.setProperty("--text-secondary", "#6c6c6c");
      root.style.setProperty("--primary", "#070707");
      root.style.setProperty("--secondary", "#7b61ff");
      root.style.setProperty("--secondary-light", "#f3edff");
      root.style.setProperty("--accent-red-light", "#ffe6ec");
      root.style.setProperty(
        "--card-shadow",
        "0 2px 8px rgba(58,90,255,0.1)"
      );
    }
  }, [resolvedMode]);

  const contextValue = useMemo(
    () => ({ colorMode, setColorMode, resolvedMode }),
    [colorMode, resolvedMode]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
