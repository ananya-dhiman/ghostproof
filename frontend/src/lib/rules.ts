// The company's rules, written BEFORE any bug is seen. Mirrors contracts/src/rules/Rules.sol
// (Person A) and backend/fixtures/rules.json (Person B). The UI only shows these.
import type { SeverityName } from "@shared/types";

export interface Rule {
  id: string;
  name: string;
  plain: string;
  severity: SeverityName;
  mandatory: boolean;
}

export const RULES: Rule[] = [
  {
    id: "no-theft",
    name: "No theft",
    plain: "A fresh account with no permissions must never end up holding other people's money.",
    severity: "critical",
    mandatory: true,
  },
  {
    id: "fee-accounting",
    name: "Books must balance",
    plain: "The vault's recorded balances must always add up to the tokens it really holds.",
    severity: "medium",
    mandatory: false,
  },
];

export const ruleName = (id: string | null | undefined) => RULES.find((r) => r.id === id)?.name ?? id ?? "None";

export const BOUNTY = { id: "vault-01", name: "Demo Vault", company: "Acme Vaults (demo)" };

/** The deployed numbers (Person A's STATUS.md). Shown only if the chain can't be read. */
export const DEMO_POOL = {
  balance: 2000,
  limit: 50,
  monthlyCap: 1000,
  medium: 50,
  high: 200,
  critical: 500,
};
