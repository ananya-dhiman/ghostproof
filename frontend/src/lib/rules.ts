// The company's rules, written BEFORE any bug is seen. Mirrors contracts/src/rules/Rules.sol
// (Person A). The UI only shows these; they are not edited here.
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
    id: "accounting-intact",
    name: "Books must balance",
    plain: "The vault's recorded total must always equal the money it really holds.",
    severity: "medium",
    mandatory: false,
  },
];

export const ruleName = (id: string | null) => RULES.find((r) => r.id === id)?.name ?? id ?? "None";

export const BOUNTY = { id: "vault-01", name: "Demo Vault", company: "Acme Vaults (demo)" };

/** Demo numbers from PLAN.md, used until the pool contract is live. */
export const DEMO_POOL = { balance: 2000, limit: 50, monthlyCap: 500, medium: 50, high: 50, critical: 50, suggestedCriticalBonus: 500 };
