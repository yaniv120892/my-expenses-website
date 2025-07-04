"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Chat from "../components/chat/Chat";
import { Alert, Snackbar } from "@mui/material";
import api from "../services/api";
import {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  getStoredIsVerified,
  setStoredIsVerified,
  clearStoredIsVerified,
} from "../services/authService";

interface AuthContextType {
  isAuthenticated: boolean;
  isVerified: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  verifyCode: (code: string, email: string) => Promise<void>;
  logout: (message?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isVerified, setIsVerified] = useState(getStoredIsVerified());
  const [notification, setNotification] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);
  const router = useRouter();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    if (token) {
      setStoredToken(token);
    } else {
      clearStoredToken();
    }
  }, [token]);

  useEffect(() => {
    if (isVerified) {
      setStoredIsVerified(isVerified);
    } else {
      clearStoredIsVerified();
    }
  }, [isVerified]);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common["Authorization"];
    }
  }, [token]);

  function logout(message?: string) {
    setToken(null);
    setIsVerified(false);
    clearStoredToken();
    clearStoredIsVerified();

    if (message) {
      setNotification({ message, type: "error" });
    }

    router.push("/login");
  }

  function handleAuthError(response: Response) {
    if (response.status === 401) {
      const code = response.headers.get("error-code");
      let message = "Your session has expired. Please log in again.";

      switch (code) {
        case "SESSION_EXPIRED":
          message = "Your session has expired. Please log in again.";
          break;
        case "USER_NOT_VERIFIED":
          message = "Your account needs verification. Please check your email.";
          break;
        case "USER_NOT_FOUND":
          message = "Account not found. Please register or try again.";
          break;
        case "AUTH_REQUIRED":
          message = "Authentication required. Please log in.";
          break;
      }

      logout(message);
      return true;
    }
    return false;
  }

  async function login(email: string, password: string) {
    const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (response.ok) {
      const data = await response.json();
      setToken(data.token);
      setIsVerified(true);
      router.push("/");
      return;
    }

    if (handleAuthError(response)) {
      return;
    }

    if (response.status === 400) {
      const errorData = await response.json();
      throw new Error(errorData.error);
    }

    throw new Error("Failed to log in");
  }

  async function signup(email: string, password: string) {
    const response = await fetch(`${apiBaseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username: email, password }),
    });
    if (response.ok) {
      setIsVerified(false);
      router.push("/verify?email=" + email);
      return;
    }

    if (response.status === 400) {
      const errorData = await response.json();
      throw new Error(errorData.error);
    }

    throw new Error("Failed to sign up");
  }

  async function verifyCode(code: string, email: string) {
    const response = await fetch(`${apiBaseUrl}/api/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, email }),
    });
    if (response.ok) {
      const data = await response.json();
      setToken(data.token);
      setIsVerified(true);
      router.push("/");
      return;
    }

    if (response.status === 400) {
      const errorData = await response.json();
      throw new Error(errorData.error);
    }

    throw new Error("Failed to verify code");
  }

  const isAuthenticated = !!token && isVerified;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isVerified,
        token,
        login,
        signup,
        verifyCode,
        logout,
      }}
    >
      <>
        {children}
        {isAuthenticated && <Chat />}
      </>
      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={notification?.type}>{notification?.message}</Alert>
      </Snackbar>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
