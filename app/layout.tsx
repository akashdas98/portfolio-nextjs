import type { Metadata, Viewport } from "next";
import { PublicAnimations } from "@/components/PublicAnimations";
import "./globals.css";

const developmentFreshnessScript = `
window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});
`;

export const metadata: Metadata = {
  metadataBase: new URL("https://freebirdakash.vercel.app"),
  applicationName: "Akash Das",
  title: {
    default: "Akash Das — Senior Software Engineer",
    template: "%s — Akash Das",
  },
  description:
    "Senior software engineer delivering clean, reliable websites and web applications from requirements through production support.",
  authors: [{ name: "Akash Das" }],
  creator: "Akash Das",
  publisher: "Akash Das",
  category: "technology",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Akash Das",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    title: "Akash Das — Senior Software Engineer",
    description:
      "Clean, reliable web products built end to end.",
    url: "/",
    siteName: "Akash Das",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Akash Das — Senior Software Engineer",
    description: "Clean, reliable web products built end to end.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#0a0d10",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <footer className="site-footer">
          <div className="shell footer-inner">
            <p>Akash Das · Senior Software Engineer</p>
            <p>Built with Next.js. Designed with restraint.</p>
          </div>
        </footer>
        <PublicAnimations />
        {process.env.NODE_ENV === "development" ? (
          <script
            dangerouslySetInnerHTML={{ __html: developmentFreshnessScript }}
          />
        ) : null}
      </body>
    </html>
  );
}
