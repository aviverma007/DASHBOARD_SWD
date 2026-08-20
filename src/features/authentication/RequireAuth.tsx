import type { ReactNode } from "react";
import { useAuthStore } from "../../store/authStore";
import { LoginPage } from "./LoginPage";

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <LoginPage />;
  return <>{children}</>;
}
