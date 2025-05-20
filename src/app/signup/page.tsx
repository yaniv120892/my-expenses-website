"use client";

import { useAuth } from "@/context/AuthContext";
import React, { useState } from "react";
import { handleApiError } from "../../utils/api";

export default function SignupPage() {
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signup(email, password);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: 24 }}>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          className="button-primary"
          disabled={loading}
          style={{
            marginTop: 8,
            alignItems: "center",
            display: "flex",
            justifyContent: "center",
          }}
        >
          {loading ? "Signing up..." : "Sign Up"}
        </button>
        <a href="/login" style={{ marginTop: 8, color: "var(--secondary)" }}>
          Already have an account? Login
        </a>
        {error && <div style={{ color: "#e74c3c", marginTop: 8 }}>{error}</div>}
      </form>
    </div>
  );
}
