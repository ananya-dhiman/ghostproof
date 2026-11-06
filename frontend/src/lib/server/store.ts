// In-memory server state for the demo (resets on restart).
// TODO: if time allows, move "used nullifiers" into the backend/Arkiv so it survives restarts.

interface Store {
  verified: Set<string>; // nullifiers that passed World ID
  used: Set<string>; // nullifiers that already submitted
}

const g = globalThis as unknown as { __ghostproof?: Store };
export const store: Store = (g.__ghostproof ??= { verified: new Set(), used: new Set() });
