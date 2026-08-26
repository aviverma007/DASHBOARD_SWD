import { useEffect, useRef } from "react";
import { useAuthStore } from "../store/authStore";

const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
/** Activity resets are throttled so a busy mousemove stream doesn't
 * clear/re-arm the timer hundreds of times a second. */
const RESET_THROTTLE_MS = 5_000;

export const IDLE_LOGOUT_FLAG = "swd_idle_logout";

/** Signs the user out after 30 minutes without any interaction
 * (mouse, keys, touch, scroll). A sessionStorage flag lets the login
 * page explain WHY they were signed out. Mount once, inside the
 * authenticated shell. */
export function useIdleLogout() {
  const logout = useAuthStore((s) => s.logout);
  const timerRef = useRef<number | null>(null);
  const lastResetRef = useRef(0);

  useEffect(() => {
    function arm() {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        sessionStorage.setItem(IDLE_LOGOUT_FLAG, "1");
        logout();
      }, IDLE_LIMIT_MS);
    }

    function onActivity() {
      const now = Date.now();
      if (now - lastResetRef.current < RESET_THROTTLE_MS) return;
      lastResetRef.current = now;
      arm();
    }

    const events: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    // Returning to the tab counts as activity too
    document.addEventListener("visibilitychange", onActivity);

    arm(); // start counting immediately

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onActivity);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [logout]);
}
