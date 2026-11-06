/**
 * Re-export of the frozen shared interfaces so backend code imports from one
 * place. Do not define new cross-team shapes here — they belong in
 * /shared/types.ts, and changing one means telling Person A and Person C.
 */
export type * from "../../shared/types.js";
