import type { CapacitorConfig } from "@capacitor/cli";

/** SWD Analytics — Android wrapper.
 *
 * LIVE-SERVER mode: the app is a thin shell that loads the dashboard
 * straight from the office server, so every `npm run build` deploy
 * reaches phones instantly — the APK never needs rebuilding for
 * dashboard changes. Phones must be on office Wi-Fi / VPN.
 *
 * To ship a self-contained APK instead (works without the web server,
 * data still needs the APIs), comment out `server` and run
 * `npm run build && npx cap sync android` before building the APK. */
const config: CapacitorConfig = {
  appId: "com.smartworld.dashboard",
  appName: "SmartDB",
  webDir: "dist",
  server: {
    url: "http://192.168.66.28:3000",
    cleartext: true,          // internal HTTP server
  },
  android: {
    allowMixedContent: true,  // page on :3000 calls APIs on :5002
  },
};

export default config;
