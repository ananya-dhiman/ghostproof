import Link from "next/link";
import { Ghost, Boo, type GhostVariant } from "@/components/Ghost";
import { Marquee } from "@/components/Nav";

const HOW: { n: string; title: string; body: string; ghost: GhostVariant }[] = [
  { n: "01", title: "Rules first", body: "The company writes its rules before any bug is seen. One is mandatory: a stranger must never walk off with other people's money.", ghost: "shield" },
  { n: "02", title: "Submit a test", body: "A hacker sends the attack as a small runnable test. One verified human, one World ID check.", ghost: "shades" },
  { n: "03", title: "Replay on a copy", body: "Our checker runs it on a copy of the chain and measures the money moved. No AI decides this.", ghost: "detective" },
  { n: "04", title: "Paid on proof", body: "Rule broken? A base reward pays out automatically from a locked pool. Any bonus stays the company's call.", ghost: "bag" },
];

export default function Home() {
  return (
    <>
      <section className="container page" style={{ position: "relative", paddingTop: 64, paddingBottom: 72 }}>
        <div className="grid-2" style={{ alignItems: "center", gap: 40 }}>
          <div className="stack" style={{ gap: 24 }}>
            <span className="kicker">Bug bounties · paid on proof</span>
            <h1>
              Found a bug?
              <br />
              <span className="highlight">Don&apos;t get</span>
              <br />
              ghosted.
            </h1>
            <p style={{ fontSize: "1.2rem", maxWidth: 520 }}>
              Ghostproof replays your attack on a copy of the chain. If it breaks a rule the company wrote in
              advance, a <strong>guaranteed base reward</strong> is paid automatically. No waiting, no
              &ldquo;we&apos;ll get back to you&rdquo;.
            </p>
            <div className="row" style={{ gap: 16 }}>
              <Link href="/hacker" className="btn big accent">
                Submit a bug →
              </Link>
              <Link href="/company" className="btn big raised">
                I run a bounty
              </Link>
            </div>
          </div>

          <div className="hero-art" style={{ position: "relative", minHeight: 420 }}>
            <div className="card flat" style={{ padding: 0, transform: "rotate(2deg)", boxShadow: "var(--shadow-lg)" }}>
              <div style={{ background: "var(--ink)", color: "var(--base)", padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", paddingRight: 70 }}>
                <strong>REPORT rep_003</strong>
                <span className="mono">fork #7412388</span>
              </div>
              <div style={{ padding: 22 }} className="stack">
                <Line k="Rule broken" v="No theft" />
                <Line k="Severity" v={<span className="tag sev-critical">critical</span>} />
                <Line k="Money moved" v="1,000 USDC" />
                <Line k="Base paid" v={<span className="tag accent">50 USDC ✓</span>} />
                <div style={{ border: "3px dashed var(--ink)", padding: 12, background: "var(--raised)", fontWeight: 700 }}>
                  Paid automatically. Nobody had to say yes.
                </div>
              </div>
            </div>
            <div className="sticker-abs" style={{ top: -96, right: -30 }}>
              <Ghost variant="bag" size={130} rotate={12} float />
            </div>
            <div className="sticker-abs" style={{ bottom: -40, left: -30 }}>
              <Ghost variant="shades" size={120} rotate={-10} float style={{ animationDelay: "0.8s" }} />
            </div>
            <div className="sticker-abs" style={{ bottom: 70, left: 70 }}>
              <Boo text="Paid!" rotate={-8} />
            </div>
          </div>
        </div>
      </section>

      <Marquee
        items={[
          "No AI decides pay",
          "Rules written in advance",
          "Replayed on a copy of the chain",
          "Base reward paid automatically",
          "One human, one submission",
          "Public track record",
        ]}
      />

      <section className="container page">
        <div className="section-head">
          <h2>How it works</h2>
          <Boo text="it's not magic. it's maths." rotate={2} />
        </div>
        <div className="grid-2" style={{ gap: 28 }}>
          {HOW.map((s, i) => (
            <div key={s.n} className={`card lift ${i === 1 || i === 2 ? "accent" : ""}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
              <div className="stack" style={{ gap: 8 }}>
                <span className="mono" style={{ fontWeight: 700 }}>{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
              <Ghost variant={s.ghost} size={96} rotate={i % 2 ? 8 : -8} />
            </div>
          ))}
        </div>
      </section>

      <section className="container" style={{ paddingBottom: 40 }}>
        <div className="card accent cta-row">
          <Ghost variant="classic" size={90} rotate={-6} />
          <div className="stack" style={{ gap: 6 }}>
            <h3 style={{ color: "var(--base)" }}>Every outcome is public</h3>
            <p className="muted">Paid, bonus, or rejected: each report lands on a shared public record (Arkiv) so anyone can check a company&apos;s track record.</p>
          </div>
          <Link href="/record" className="btn">See the record</Link>
        </div>
      </section>
    </>
  );
}

function Line({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--ink)", paddingBottom: 8 }}>
      <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.06em" }}>{k}</span>
      <span style={{ fontFamily: "var(--font-display)" }}>{v}</span>
    </div>
  );
}
