import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { authApi, AuthError } from "../../services/authApi";
import { LoginPage } from "./LoginPage";
import { MobileLogin } from "../../mobile/MobileLogin";
import { useIsMobile } from "../../mobile/useIsMobile";

interface RequireAuthProps {
  children: ReactNode;
}

/** Re-reads the signed-in user's name, role and tab rights from the login
 *  service on every app load, so an admin's changes (rights, disable, reset)
 *  take effect without waiting for a sign-out. If the service is unreachable
 *  the saved session keeps working; if it rejects the session, sign out. */
function useSessionRefresh() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!token) { logout(); return; }   // session from before the login service: sign in again
    authApi.me(token)
      .then((r) => setUser(r.user))
      .catch((e) => { if (e instanceof AuthError && (e.status === 401 || e.status === 403)) logout(); });
  }, [token, isAuthenticated, setUser, logout]);
}

export function RequireAuth({ children }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mustChange = useAuthStore((s) => s.mustChange);
  const mobile = useIsMobile();
  const loc = useLocation();
  useSessionRefresh();
  if (!isAuthenticated) return mobile ? <MobileLogin /> : <LoginPage />;
  // a reset password must be replaced before anything else opens
  if (mustChange && loc.pathname !== "/change-password") return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}
