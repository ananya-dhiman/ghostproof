/**
 * The social card: what X, Slack, Discord and iMessage show when someone pastes
 * a link to the site. Generated at build time, so there is no image file to
 * keep in sync with the design.
 *
 * This renders through Satori, which supports only a subset of CSS: flexbox
 * only (no grid), every element with more than one child needs an explicit
 * `display: flex`, and CSS variables do not resolve — hence the literal colours
 * rather than var(--ink) and friends.
 *
 * The two fonts are vendored in _fonts/ rather than fetched: a build that
 * depends on fonts.gstatic.com being up is a build that fails at the worst
 * possible moment. Both are SIL Open Font License.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Ghostproof — found a bug? Don't get ghosted.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const YELLOW = "#ffe500";
const BLACK = "#0b0b0b";
const MUTED = "#cfc68e";

const fontDir = path.join(process.cwd(), "src/app/_fonts");
const display = readFileSync(path.join(fontDir, "ArchivoBlack.ttf"));
const body = readFileSync(path.join(fontDir, "SpaceGrotesk.ttf"));

/** The ghost body outline, lifted from components/Ghost.tsx. */
const GHOST_BODY =
  "M18 52 C18 26 34 10 55 10 C76 10 92 26 92 52 L92 104 Q85 96 78 104 Q71 112 64 104 Q57 96 50 104 Q43 112 36 104 Q29 96 22 104 L18 108 Z";

/**
 * Satori renders inline SVG unevenly, so each ghost goes in as a data URI on an
 * <img>. Same paths as the real stickers on the site.
 */
function ghost(accessory: "bag" | "shades"): string {
  const face =
    accessory === "shades"
      ? `<path d="M26 44 H84" stroke="${BLACK}" stroke-width="4"/>
         <rect x="28" y="42" width="22" height="14" rx="3" fill="${BLACK}"/>
         <rect x="60" y="42" width="22" height="14" rx="3" fill="${BLACK}"/>
         <path d="M32 46 L38 46" stroke="${YELLOW}" stroke-width="2.5" stroke-linecap="round"/>
         <path d="M64 46 L70 46" stroke="${YELLOW}" stroke-width="2.5" stroke-linecap="round"/>
         <path d="M46 68 Q55 74 66 66" stroke="${BLACK}" stroke-width="4" fill="none" stroke-linecap="round"/>`
      : `<ellipse cx="40" cy="48" rx="5.5" ry="8" fill="${BLACK}"/>
         <ellipse cx="70" cy="48" rx="5.5" ry="8" fill="${BLACK}"/>
         <circle cx="42" cy="45" r="1.8" fill="#fff"/>
         <circle cx="72" cy="45" r="1.8" fill="#fff"/>
         <path d="M48 64 Q55 71 62 64" stroke="${BLACK}" stroke-width="4" fill="none" stroke-linecap="round"/>
         <ellipse cx="34" cy="62" rx="6" ry="3.5" fill="${YELLOW}"/>
         <ellipse cx="76" cy="62" rx="6" ry="3.5" fill="${YELLOW}"/>`;

  const extra =
    accessory === "bag"
      ? `<path d="M84 78 Q76 94 82 108 Q94 116 108 108 Q114 94 104 78 Z" fill="${YELLOW}" stroke="${BLACK}" stroke-width="4" stroke-linejoin="round"/>
         <path d="M86 78 L102 78 L98 70 L90 70 Z" fill="${YELLOW}" stroke="${BLACK}" stroke-width="4" stroke-linejoin="round"/>
         <text x="94" y="104" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="20" fill="${BLACK}">$</text>`
      : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -10 140 142" width="140" height="142">
    <g stroke="#fff" stroke-width="14" stroke-linejoin="round" fill="#fff">
      <path d="${GHOST_BODY}"/>
      ${accessory === "bag" ? `<path d="M84 78 Q76 94 82 108 Q94 116 108 108 Q114 94 104 78 Z"/><path d="M86 78 L102 78 L98 70 L90 70 Z"/>` : ""}
    </g>
    <path d="${GHOST_BODY}" fill="#fff" stroke="${BLACK}" stroke-width="4.5" stroke-linejoin="round"/>
    ${face}
    ${extra}
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** One line of the report card: label on the left, measured value on the right. */
function Row({
  label,
  value,
  chip = false,
  last = false,
}: {
  label: string;
  value: string;
  chip?: boolean;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 0",
        borderBottom: last ? "none" : `2px solid rgba(255,229,0,0.25)`,
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: "Grotesk",
          fontSize: 17,
          letterSpacing: 1.4,
          color: MUTED,
        }}
      >
        {label}
      </div>
      {chip ? (
        <div
          style={{
            display: "flex",
            backgroundColor: YELLOW,
            color: BLACK,
            fontFamily: "Archivo",
            fontSize: 18,
            padding: "5px 12px",
          }}
        >
          {value}
        </div>
      ) : (
        <div style={{ display: "flex", fontFamily: "Archivo", fontSize: 20, color: YELLOW }}>
          {value}
        </div>
      )}
    </div>
  );
}

function Chip({ filled, children }: { filled?: boolean; children: string }) {
  return (
    <div
      style={{
        display: "flex",
        border: `3px solid ${YELLOW}`,
        backgroundColor: filled ? YELLOW : "transparent",
        color: filled ? BLACK : YELLOW,
        fontFamily: "Archivo",
        fontSize: 15,
        letterSpacing: 1,
        padding: "8px 14px",
      }}
    >
      {children}
    </div>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          backgroundColor: BLACK,
          // Satori ignores radial-gradient + background-size, so the dot grid
          // is a tiled SVG tile instead.
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><circle cx='3' cy='3' r='1.6' fill='%23ffe500' fill-opacity='0.17'/></svg>")`,
          backgroundSize: "26px 26px",
          padding: "44px 52px",
          fontFamily: "Grotesk",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          {/* ---------------- left: the pitch ---------------- */}
          <div style={{ display: "flex", flexDirection: "column", width: 600 }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                backgroundColor: YELLOW,
                color: BLACK,
                fontFamily: "Archivo",
                fontSize: 16,
                letterSpacing: 1.6,
                padding: "7px 13px",
              }}
            >
              BUG BOUNTIES · PAID ON PROOF
            </div>

            <div
              style={{
                display: "flex",
                fontFamily: "Archivo",
                fontSize: 60,
                color: YELLOW,
                marginTop: 24,
              }}
            >
              FOUND A BUG?
            </div>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                fontFamily: "Archivo",
                fontSize: 60,
                color: BLACK,
                backgroundColor: YELLOW,
                padding: "2px 10px",
                marginTop: 8,
              }}
            >
              DON&apos;T GET
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Archivo",
                fontSize: 60,
                color: YELLOW,
                marginTop: 8,
              }}
            >
              GHOSTED.
            </div>

            <div
              style={{
                display: "flex",
                width: 540,
                marginTop: 22,
                fontSize: 21,
                lineHeight: 1.45,
                color: "#efe9c8",
              }}
            >
              Ghostproof replays your attack on a copy of the chain. Break a rule the company
              wrote in advance, and a guaranteed base reward is paid automatically.
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <Chip filled>ETHGLOBAL 2026</Chip>
              <Chip>CLASSIC TRACK</Chip>
              <Chip>ETHEREUM SEPOLIA</Chip>
            </div>
          </div>

          {/* ---------------- right: a real measured result ---------------- */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 440,
              border: `4px solid ${YELLOW}`,
              backgroundColor: "#121212",
              boxShadow: `10px 10px 0 ${YELLOW}`,
              padding: "20px 22px",
            }}
          >
            {/* Title and fork stack rather than sit side by side: the top-right
                corner belongs to the money-bag sticker. */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                paddingBottom: 12,
                borderBottom: `3px solid ${YELLOW}`,
              }}
            >
              <div style={{ display: "flex", fontFamily: "Archivo", fontSize: 21, color: YELLOW }}>
                REPORT rep_003
              </div>
              <div style={{ display: "flex", marginTop: 3, fontSize: 14, color: MUTED }}>
                fork #7412308
              </div>
            </div>

            <Row label="RULE BROKEN" value="No theft" />
            <Row label="SEVERITY" value="CRITICAL" chip />
            <Row label="MONEY MOVED" value="1,000 USDC" />
            <Row label="BASE PAID" value="50 USDC" chip last />

            <div
              style={{
                display: "flex",
                marginTop: 14,
                border: `2px dashed ${YELLOW}`,
                color: YELLOW,
                fontSize: 15,
                padding: "9px 12px",
              }}
            >
              Paid automatically. Nobody had to say yes.
            </div>
          </div>
        </div>

        {/* ---------------- footer ---------------- */}
        <div
          style={{
            display: "flex",
            fontSize: 14,
            letterSpacing: 1.3,
            color: "#8a855f",
          }}
        >
          GHOSTPROOF · ETHGLOBAL 2026 · SEPOLIA TESTNET · TEST USDC HAS NO REAL VALUE
        </div>

        {/* ---------------- stickers ---------------- */}
        <img
          src={ghost("bag")}
          width={118}
          height={120}
          style={{ position: "absolute", top: 2, right: 22, transform: "rotate(9deg)" }}
          alt=""
        />
        {/* Peeks over the card's left border, next to the dashed note. */}
        <img
          src={ghost("shades")}
          width={100}
          height={102}
          style={{ position: "absolute", top: 326, left: 662, transform: "rotate(-8deg)" }}
          alt=""
        />
        <div
          style={{
            position: "absolute",
            bottom: 74,
            right: 96,
            display: "flex",
            backgroundColor: "#fff",
            color: BLACK,
            border: `3px solid ${BLACK}`,
            fontFamily: "Archivo",
            fontSize: 22,
            padding: "6px 14px",
            transform: "rotate(-7deg)",
          }}
        >
          PAID!
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Archivo", data: display, weight: 400, style: "normal" },
        { name: "Grotesk", data: body, weight: 400, style: "normal" },
      ],
    },
  );
}
