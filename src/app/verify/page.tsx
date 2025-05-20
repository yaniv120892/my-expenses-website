"use client";

import { useAuth } from "@/context/AuthContext";
import React, { useState } from "react";

export default function VerifyPage() {
  const { verifyCode } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await verifyCode(code);
    } catch (err) {
      console.error(err);
      setError("Verification failed");
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
          type="text"
          placeholder="Enter code from email"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <button type="submit" className="button-primary" disabled={loading}>
          {loading ? "Verifying..." : "Verify"}
        </button>
        {error && <div style={{ color: "#e74c3c", marginTop: 8 }}>{error}</div>}
      </form>
    </div>
  );
}
