# SWD Analytics — Mobile App

Two ways onto a phone, both already wired into this repo. Phones must be
on office Wi-Fi (or VPN) to reach 192.168.66.28 — same as laptops.

## 1. Install from the browser (zero setup, works today)

Open `http://192.168.66.28:3000` in **Chrome on Android** →
⋮ menu → **Add to Home screen** → Install.
The dashboard opens full-screen with its own navy SWD icon
(`public/manifest.webmanifest` + `pwa-192/512.png` provide this).
On **iPhone**: Safari → Share → Add to Home Screen.

Updates automatically with every `npm run build` deploy. Note: because
the server is plain HTTP, there is no offline cache — the install is a
full-screen shortcut, which is all an always-online dashboard needs.

## 2. Real Android app (APK) — Capacitor

The `android/` folder is a complete Android Studio project.
`capacitor.config.ts` runs it in **live-server mode**: the app loads
the dashboard from `http://192.168.66.28:3000`, so the APK never needs
rebuilding when the dashboard changes.

### Build the APK (on your machine, one time)

Requirements: Android Studio (bundles the SDK + JDK).

```powershell
cd C:\DASHBOARD_SWD
git pull
npm install            # brings in @capacitor/*
npx cap sync android
npx cap open android   # opens Android Studio
```

In Android Studio: **Build → Build App Bundles / APK → Build APK**.
The APK lands at
`android\app\build\outputs\apk\debug\app-debug.apk`.

Or without opening the IDE (after installing Android Studio once):

```powershell
cd C:\DASHBOARD_SWD\android
.\gradlew assembleDebug
```

### Distribute

Share `app-debug.apk` over WhatsApp/intranet/MDM; users tap it and
allow "install from unknown sources". No Play Store needed for an
internal app. For a signed release build (`assembleRelease`), generate
a keystore in Android Studio first.

### Switching to a bundled (offline-shell) APK

Comment out the `server` block in `capacitor.config.ts`, then
`npm run build && npx cap sync android` and rebuild the APK. The UI
then ships inside the app and only the data calls hit the network.
