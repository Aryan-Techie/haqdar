import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { TopStrip } from "@/components/TopStrip";
import { BottomNav } from "@/components/BottomNav";
import { OfflineNotice } from "@/components/OfflineNotice";
import { SignInSheetHost } from "@/components/SignInSheet";
import { NativeSetup } from "@/components/NativeSetup";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const notoSans = Noto_Sans({ variable: "--font-noto-sans", subsets: ["latin"], display: "swap" });
const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Haqdar",
  description: "Find the government benefits you are owed, by voice, in your language.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#E8742A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${notoSans.variable} ${notoDevanagari.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <TopStrip />
        <OfflineNotice />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4">{children}</main>
        <BottomNav />
        <SignInSheetHost />
        <ServiceWorkerRegister />
        <NativeSetup />
      </body>
    </html>
  );
}
