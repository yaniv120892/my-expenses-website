"use client";

import { useAuth } from "@/context/AuthContext";
import React, { useState, Suspense } from "react";
import { handleApiError } from "../../utils/api";
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation";

function getEmailFromUrl(searchParams: ReadonlyURLSearchParams | null) {
  if (!searchParams) {
    return "";
  }
  const emailParam = searchParams.get("email");
  return emailParam || "";
}

function VerifyPageContent() {
  const { verifyCode } = useAuth();
  const searchParams = useSearchParams();
  const email = getEmailFromUrl(searchParams);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await verifyCode(code, email);
    } catch (err) {
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
          type="text"
          placeholder="Enter code from email"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <input
          type="email"
          value={email}
          disabled
          style={{ background: "#f5f5f5" }}
        />
        <button type="submit" className="button-primary" disabled={loading}>
          {loading ? "Verifying..." : "Verify"}
        </button>
        {error && <div style={{ color: "#e74c3c", marginTop: 8 }}>{error}</div>}
      </form>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyPageContent />
    </Suspense>
  );
}
