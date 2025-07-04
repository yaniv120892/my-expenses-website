"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AuthProvider } from "../context/AuthContext";


const DEFAULT_STALE_TIME = 60000;
const DEFAULT_RETRY = 1;

export default function RootLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: process.env.NEXT_PUBLIC_QUERY_STALE_TIME
              ? parseInt(process.env.NEXT_PUBLIC_QUERY_STALE_TIME)
              : DEFAULT_STALE_TIME,
            retry: process.env.NEXT_PUBLIC_QUERY_RETRY
              ? parseInt(process.env.NEXT_PUBLIC_QUERY_RETRY)
              : DEFAULT_RETRY,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
      {process.env.NEXT_PUBLIC_SHOW_REACT_QUERY_DEVTOOLS === "true" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
