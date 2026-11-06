# Ghostproof backend (Person B)

Node/TypeScript checker + API. See `../PLAN.md` → "Person B" for the full brief and
`../shared/types.ts` for the JSON shapes you produce and consume.

Owns: the fork runner, the AI evidence report, the payout call, the Arkiv writes, and the
HTTP endpoints (`POST /submit`, `GET /report/:id`, `GET /records`). Work only in this folder.
