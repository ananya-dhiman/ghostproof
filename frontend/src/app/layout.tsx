import type { Metadata } from "next";
import { Archivo_Black, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";

const display = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo-black" });
const body = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space-mono" });

const TITLE = "Ghostproof — bug bounties that pay on proof";
const DESCRIPTION =
  "Submit an attack as a test. We replay it on a copy of the chain. If it breaks a rule the company wrote in advance, a base reward is paid automatically.";

// Needed for the social card: og:image has to be an absolute URL, so Next has
// to know where the site lives. Vercel sets the production domain itself; the
// env var is the override for a custom domain.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  // The image itself comes from app/opengraph-image.tsx — Next wires it up and
  // fills in the url/width/height automatically.
  openGraph: {
    type: "website",
    siteName: "Ghostproof",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <Nav />
          <main>{children}</main>
          <footer className="footer">
            <div className="container row" style={{ justifyContent: "space-between" }}>
              <span>
                <strong>GHOSTPROOF</strong> · Ethereum Sepolia testnet · test USDC has no real value
              </span>
              <span className="muted">
                No trackers. Open source (MIT).
              </span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
