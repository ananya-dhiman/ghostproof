"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ghost } from "./Ghost";
import { ConnectButton } from "./ConnectButton";

const LINKS = [
  { href: "/hacker", label: "Submit a bug" },
  { href: "/company", label: "Company" },
  { href: "/record", label: "Public record" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand" aria-label="Ghostproof home">
          <span className="brand-mark">
            <Ghost size={30} />
          </span>
          Ghostproof
        </Link>
        <nav className="nav-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`nav-link ${path?.startsWith(l.href) ? "active" : ""}`}>
              {l.label}
            </Link>
          ))}
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}

export function Marquee({ items }: { items: string[] }) {
  const row = (
    <span>
      {items.map((t, i) => (
        <span key={i}>
          {t} <span aria-hidden>👻</span>
        </span>
      ))}
    </span>
  );
  return (
    <div className="marquee" aria-label={items.join(". ")}>
      <div className="marquee-track" aria-hidden>
        {row}
        {row}
      </div>
    </div>
  );
}
