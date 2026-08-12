import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PublicAnimations } from "@/components/PublicAnimations";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});


export const metadata: Metadata = {
  metadataBase: new URL("https://freebirdakash.vercel.app"),
  title: {
    default: "Akash Das — Senior Software Engineer",
    template: "%s — Akash Das",
  },
  description:
    "Senior software engineer delivering clean, reliable websites and web applications from requirements through production support.",
  openGraph: {
    title: "Akash Das — Senior Software Engineer",
    description:
      "Clean, reliable web products built end to end.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        {children}
        <PublicAnimations />
      </body>
    </html>
  );
}
