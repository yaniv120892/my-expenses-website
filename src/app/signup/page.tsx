"use client";

import { useAuth } from "@/context/AuthContext";
import React, { useState } from "react";
import { handleApiError } from "../../utils/api";
import { Button, TextField, Box, Typography, Link } from "@mui/material";

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
    <Box sx={{ maxWidth: 400, margin: "80px auto", padding: 3 }}>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <TextField
          type="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
        />
        <TextField
          type="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
          inputProps={{ minLength: 8 }}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={loading}
          fullWidth
          sx={{ mt: 1 }}
        >
          {loading ? "Signing up..." : "Sign Up"}
        </Button>
        <Link href="/login" sx={{ mt: 1, color: "primary.main" }}>
          Already have an account? Login
        </Link>
        {error && (
          <Typography color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </form>
    </Box>
  );
}
