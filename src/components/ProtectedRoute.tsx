import React from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

function useProtectedRoute() {
  const { isAuthenticated, isVerified } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (!isVerified) {
      router.replace("/verify");
    }
  }, [isAuthenticated, isVerified, router]);
}

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  useProtectedRoute();
  const { isAuthenticated, isVerified } = useAuth();
  if (!isAuthenticated || !isVerified) {
    return null;
  }
  return <>{children}</>;
}
