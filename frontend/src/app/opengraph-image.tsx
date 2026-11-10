/**
 * The social card: what X, Slack, Discord and iMessage show when someone pastes
 * a link to the site. Generated at build time, so there is no image file to
 * keep in sync with the design.
 *
 * This renders through Satori, which supports only a subset of CSS: flexbox
 * only (no grid), every element with more than one child needs an explicit
 * `display: flex`, and CSS variables do not resolve — hence the literal colours
 * rather than var(--ink) and friends.
 */
import { ImageResponse } from "next/og";

export const alt = "Ghostproof — bug bounties that pay on proof";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const YELLOW = "#ffe500";
const BLACK = "#0b0b0b";

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
          backgroundColor: BLACK,
          padding: 64,
          border: `16px solid ${YELLOW}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 900,
              color: YELLOW,
              letterSpacing: -2,
              lineHeight: 1.05,
            }}
          >
            GHOSTPROOF
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 40,
              color: YELLOW,
              lineHeight: 1.3,
            }}
          >
            Bug bounties that pay on proof.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: YELLOW,
            color: BLACK,
            padding: "28px 32px",
            fontSize: 30,
            lineHeight: 1.35,
          }}
        >
          <div style={{ display: "flex" }}>
            Submit an attack as a test. We replay it on a copy of the chain.
          </div>
          <div style={{ display: "flex", marginTop: 8 }}>
            Break a rule the company wrote first, and the base reward pays itself.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
