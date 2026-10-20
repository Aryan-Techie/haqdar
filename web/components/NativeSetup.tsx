"use client";

import { useEffect } from "react";
import { setupNative } from "@/lib/native";

/** Registers Capacitor shell behaviour (back button, external links). Renders nothing and does nothing outside the shell. */
export function NativeSetup() {
  useEffect(() => {
    setupNative();
  }, []);
  return null;
}
