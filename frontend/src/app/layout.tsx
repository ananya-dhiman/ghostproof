import type { Metadata } from "next";
import { Archivo_Black, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";

const display = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo-black" });
const body = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space-mono" });

export const metadata: Metadata = {
  title: "Ghostproof — bug bounties that pay on proof",
  description:
    "Submit an attack as a test. We replay it on a copy of the chain. If it breaks a rule the company wrote in advance, a base reward is paid automatically.",
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
              <span className="muted" style={{ color: "#d8d29a" }}>
                No trackers. Open source (MIT).
              </span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
