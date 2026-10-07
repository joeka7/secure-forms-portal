import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { template: `%s · ${APP_NAME}`, default: APP_NAME },
  description: "A secure, schema-driven internal forms portal.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#272147",
};

// Every page carries a per-request CSP nonce (see middleware.ts), so nothing is prerendered.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
