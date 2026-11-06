// Ghost stickers — hand-drawn SVG, no external assets.
// Each ghost has a white "sticker" outline + hard black drop shadow (see .ghost-sticker in globals.css).

import type { CSSProperties } from "react";

export type GhostVariant =
  | "classic" // happy little ghost
  | "shades" // the hacker: sunglasses
  | "shield" // holding a shield with a tick — "proof"
  | "bag" // carrying a money bag — "paid"
  | "detective" // magnifying glass — "checking"
  | "sleepy" // closed eyes + zzz — empty states
  | "spooked"; // wide eyes — rejected / errors

const BODY =
  "M18 52 C18 26 34 10 55 10 C76 10 92 26 92 52 L92 104 Q85 96 78 104 Q71 112 64 104 Q57 96 50 104 Q43 112 36 104 Q29 96 22 104 L18 108 Z";

interface Props {
  variant?: GhostVariant;
  size?: number;
  rotate?: number;
  float?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function Ghost({ variant = "classic", size = 110, rotate = 0, float = false, className = "", style, title }: Props) {
  return (
    <span
      className={`ghost-sticker ${float ? "ghost-float" : ""} ${className}`}
      style={{ transform: `rotate(${rotate}deg)`, width: size, height: size * 1.1, ...style }}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      <svg viewBox="-12 -8 134 136" width={size} height={size * 1.1}>
        {/* sticker border */}
        <g stroke="#fff" strokeWidth="14" strokeLinejoin="round" fill="#fff">
          <path d={BODY} />
          <Accessory variant={variant} outline />
        </g>
        {/* body */}
        <path d={BODY} fill="#fff" stroke="#0b0b0b" strokeWidth="4.5" strokeLinejoin="round" />
        {/* little shine */}
        <path d="M32 40 Q34 26 46 20" stroke="#0b0b0b" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.18" />
        <Face variant={variant} />
        <Accessory variant={variant} />
      </svg>
    </span>
  );
}

function Face({ variant }: { variant: GhostVariant }) {
  const ink = "#0b0b0b";
  const cheeks = (
    <>
      <ellipse cx="34" cy="62" rx="6" ry="3.5" fill="#ffe500" />
      <ellipse cx="76" cy="62" rx="6" ry="3.5" fill="#ffe500" />
    </>
  );
  switch (variant) {
    case "shades":
      return (
        <>
          <path d="M26 44 H84" stroke={ink} strokeWidth="4" />
          <rect x="28" y="42" width="22" height="14" rx="3" fill={ink} />
          <rect x="60" y="42" width="22" height="14" rx="3" fill={ink} />
          <path d="M32 46 L38 46" stroke="#ffe500" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M64 46 L70 46" stroke="#ffe500" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M46 68 Q55 74 66 66" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      );
    case "sleepy":
      return (
        <>
          <path d="M33 50 Q39 55 45 50" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M65 50 Q71 55 77 50" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="55" cy="68" rx="4" ry="3" fill={ink} />
          {cheeks}
          <text x="88" y="18" fontFamily="Arial Black, sans-serif" fontSize="16" fill={ink}>z</text>
          <text x="100" y="4" fontFamily="Arial Black, sans-serif" fontSize="12" fill={ink}>z</text>
        </>
      );
    case "spooked":
      return (
        <>
          <circle cx="40" cy="48" r="10" fill="#fff" stroke={ink} strokeWidth="4" />
          <circle cx="70" cy="48" r="10" fill="#fff" stroke={ink} strokeWidth="4" />
          <circle cx="40" cy="49" r="4" fill={ink} />
          <circle cx="70" cy="49" r="4" fill={ink} />
          <ellipse cx="55" cy="74" rx="7" ry="9" fill={ink} />
        </>
      );
    default:
      return (
        <>
          <ellipse cx="40" cy="48" rx="5.5" ry="8" fill={ink} />
          <ellipse cx="70" cy="48" rx="5.5" ry="8" fill={ink} />
          <circle cx="42" cy="45" r="1.8" fill="#fff" />
          <circle cx="72" cy="45" r="1.8" fill="#fff" />
          <path d="M48 64 Q55 71 62 64" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
          {cheeks}
        </>
      );
  }
}

function Accessory({ variant, outline = false }: { variant: GhostVariant; outline?: boolean }) {
  const ink = outline ? "#fff" : "#0b0b0b";
  const sw = outline ? undefined : 4;
  const fillY = outline ? "#fff" : "#ffe500";
  switch (variant) {
    case "shield":
      return (
        <g>
          <path d="M78 66 L104 72 L104 90 Q104 106 91 114 Q78 106 78 90 Z" fill={fillY} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
          {!outline && <path d="M84 89 L90 96 L99 82" stroke="#0b0b0b" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        </g>
      );
    case "bag":
      return (
        <g>
          <path d="M84 78 Q76 94 82 108 Q94 116 108 108 Q114 94 104 78 Z" fill={fillY} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M86 78 L102 78 L98 70 L90 70 Z" fill={fillY} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
          {!outline && (
            <text x="94" y="104" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontSize="20" fill="#0b0b0b">$</text>
          )}
        </g>
      );
    case "detective":
      return (
        <g>
          <path d="M96 100 L112 118" stroke={ink} strokeWidth={outline ? undefined : 7} strokeLinecap="round" />
          <circle cx="88" cy="88" r="15" fill={outline ? "#fff" : "#fffbe0"} stroke={ink} strokeWidth={sw} />
          {!outline && <path d="M80 82 Q84 77 90 77" stroke="#0b0b0b" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.4" />}
        </g>
      );
    default:
      return null;
  }
}

/** Speech-bubble sticker, e.g. <Boo text="BOO!" /> */
export function Boo({ text = "BOO!", rotate = -6, style }: { text?: string; rotate?: number; style?: CSSProperties }) {
  return (
    <span className="speech" style={{ transform: `rotate(${rotate}deg)`, ...style }}>
      {text}
    </span>
  );
}
