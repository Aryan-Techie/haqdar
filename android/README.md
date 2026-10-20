# Haqdar Android (Capacitor shell)

A thin Capacitor 7 shell (app id `in.haqdar.app`, name "Haqdar") that loads the live PWA through `server.url`. No web assets are bundled (`www/` is a placeholder). Voice uses native speech recognition and text-to-speech.

## Prerequisites
- Node 20+, Android SDK (platform 35, build-tools 35+), an emulator or device.
- **JDK 21 for Gradle.** Capacitor 7 and its plugins compile with Java 21. Android Studio's bundled JDK works: `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`.
- `export ANDROID_HOME=~/Library/Android/sdk` (also `ANDROID_SDK_ROOT`).

## Env vars
- `HAQDAR_APP_URL`: URL the shell loads, read at `cap sync` time. Default `http://10.0.2.2:3000` (the emulator's alias for the host). Cleartext is enabled in the config only for `http://` URLs.

## Build and run (debug)
```
cd android && npm install
npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
Debug APK: `android/android/app/build/outputs/apk/debug/app-debug.apk`.
Start the servers first: `cd api && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000` and `cd web && API_URL=http://localhost:8000 npm run dev -- -H 0.0.0.0 -p 3000`. Then `adb shell monkey -p in.haqdar.app -c android.intent.category.LAUNCHER 1`.

`npm run icons` regenerates launcher icons and splash from `web/public/icons/icon-512.png` (uses sharp from `web/node_modules`).

## Production URL
`HAQDAR_APP_URL=https://app.example.in npx cap sync android`, then build. Cleartext traffic is only allowed by the debug manifest overlay (`app/src/debug/AndroidManifest.xml`); release builds are HTTPS-only.

## How the web app talks to native
`@capacitor/*` packages are NOT in `web/package.json`. Capacitor's injected bridge exposes the installed plugins on `window.Capacitor`, and `web/lib/native.ts` calls them through it (`nativePlugin("SpeechRecognition")`, etc.), so the web bundle carries no plugin code. `getVoiceProvider()` returns the `native` adapter (`web/lib/voice/native.ts`, dynamically imported) when `window.Capacitor.isNativePlatform()` is true. `setupNative()` (mounted in `layout.tsx`) wires the back button (history back, exit at home) and opens other-origin links in the system browser. Status bar colour (#1D1814, light icons) and splash (brand orange) come from `capacitor.config.ts` and the theme.

## Not done (release)
Signing key and keystore, `assembleRelease`/AAB, Play Console listing, production HTTPS origin, optional TWA build of the same origin, notifications.

## Known limits
- Capacitor 8 plugins need `@capacitor/core` 8; this project is on 7 (text-to-speech pinned to 6.1.0, the last release for 7).
- Speech recognition needs Google's speech service on the device; Hindi needs the language pack.
- The emulator mic is silent unless routed from the host, so "did not hear anything" is expected there.
- The shell needs the network; the PWA's offline page is the fallback.
