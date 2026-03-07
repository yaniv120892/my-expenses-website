import { createTheme } from "@mui/material/styles";

const sharedTypography = {
  fontFamily: '"Inter", Arial, Helvetica, sans-serif',
};

const sharedComponents = {
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: 18,
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        textTransform: "none" as const,
        fontWeight: 600,
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 18,
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: 18,
      },
    },
  },
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        fontFamily: '"Inter", Arial, Helvetica, sans-serif',
      },
    },
  },
};

export const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#7b61ff" },
    secondary: { main: "#7b61ff" },
    error: { main: "#ff647c" },
    success: { main: "#00c48c" },
    warning: { main: "#ffd600" },
    background: {
      default: "#f7f8fa",
      paper: "#ffffff",
    },
    text: {
      primary: "#000000",
      secondary: "#6c6c6c",
    },
  },
  typography: sharedTypography,
  components: sharedComponents,
});

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#7b61ff" },
    secondary: { main: "#7b61ff" },
    error: { main: "#ff647c" },
    success: { main: "#00c48c" },
    warning: { main: "#ffd600" },
    background: {
      default: "#181a20",
      paper: "#23263a",
    },
    text: {
      primary: "#ffffff",
      secondary: "#b0b0b0",
    },
  },
  typography: sharedTypography,
  components: sharedComponents,
});
