"use client";

import { useAuth } from "@/context/AuthContext";
import React, { useState, Suspense } from "react";
import { handleApiError } from "../../utils/api";
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation";
import { Button, TextField, Box, Typography } from "@mui/material";

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
    <Box sx={{ maxWidth: 400, margin: "80px auto", padding: 3 }}>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <TextField
          type="text"
          label="Verification Code"
          placeholder="Enter code from email"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          fullWidth
        />
        <TextField
          type="email"
          label="Email"
          value={email}
          disabled
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={loading}
          fullWidth
        >
          {loading ? "Verifying..." : "Verify"}
        </Button>
        {error && (
          <Typography color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </form>
    </Box>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyPageContent />
    </Suspense>
  );
}
