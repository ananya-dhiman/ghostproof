export const usd = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`;

export const short = (s: string | undefined | null, head = 6, tail = 4) =>
  !s ? "—" : s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

export const timeAgo = (unixSeconds: number) => {
  const d = Math.max(0, Date.now() / 1000 - unixSeconds);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  return `${Math.floor(d / 86400)} d ago`;
};

export const STATUS_LABEL = {
  "base-paid": "Base paid",
  "bonus-added": "Bonus added",
  rejected: "Rejected",
} as const;
