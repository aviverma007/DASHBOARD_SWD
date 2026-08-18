import type { ReactNode } from "react";
import { useAuthStore } from "../../store/authStore";
import { LoginPage } from "./LoginPage";

export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
