"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface AuthContextType {
  isAuthenticated: boolean;
  isVerified: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  verifyCode: (code: string, email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function getStoredToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("authToken");
  }
  return null;
}

function setStoredToken(token: string) {
  localStorage.setItem("authToken", token);
}

function clearStoredToken() {
  localStorage.removeItem("authToken");
}

function getStoredIsVerified() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("isVerified") === "true";
  }
  return false;
}

function setStoredIsVerified(isVerified: boolean) {
  localStorage.setItem("isVerified", String(isVerified));
}

function clearStoredIsVerified() {
  localStorage.removeItem("isVerified");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isVerified, setIsVerified] = useState(getStoredIsVerified());
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

  function logout() {
    setToken(null);
    setIsVerified(false);
    clearStoredToken();
    clearStoredIsVerified();
    router.push("/login");
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
      {children}
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
