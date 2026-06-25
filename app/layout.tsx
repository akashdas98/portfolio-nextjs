import type { Metadata } from "next";
import "./globals.css";


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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
