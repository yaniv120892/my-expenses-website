export const COLORS = {
  income: "#2ecc40",
  expense: "#e74c3c",
  text: "var(--text-color)",
  background: "var(--background)",
  purple: "#7c3aed",
};

export function getChartColors(mode: "light" | "dark") {
  return {
    income: "#2ecc40",
    expense: "#e74c3c",
    text: mode === "dark" ? "#ffffff" : "#000000",
    background: mode === "dark" ? "#181a20" : "#f7f8fa",
    purple: "#7c3aed",
  };
}
