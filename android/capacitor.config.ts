import type { CapacitorConfig } from "@capacitor/cli";

const url = process.env.HAQDAR_APP_URL || "http://10.0.2.2:3000";

const config: CapacitorConfig = {
  appId: "in.haqdar.app",
  appName: "Haqdar",
  webDir: "www",
  server: {
    url,
    cleartext: url.startsWith("http://"),
  },
  android: {
    // Mixed content stays blocked; the PWA and API share one origin.
    allowMixedContent: false,
    // Android 15+ draws edge-to-edge; this pads the WebView below the status bar.
    adjustMarginsForEdgeToEdge: "force",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: "#E8742A",
      showSpinner: false,
      androidScaleType: "CENTER_INSIDE",
    },
    StatusBar: {
      style: "DARK", // light icons on a dark bar
      backgroundColor: "#1D1814",
      overlaysWebView: false,
    },
  },
};

export default config;
