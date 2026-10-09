import type { ReactNode } from "react";
import { useAuthStore } from "../../store/authStore";
import { LoginPage } from "./LoginPage";
import { MobileLogin } from "../../mobile/MobileLogin";
import { useIsMobile } from "../../mobile/useIsMobile";

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mobile = useIsMobile();
  if (!isAuthenticated) return mobile ? <MobileLogin /> : <LoginPage />;
  return <>{children}</>;
}
