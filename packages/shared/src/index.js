// Runtime exports for @todo/shared.
//
// Why this is a .js file (and types live in index.d.ts):
// Node 20's ESM loader refuses to load `.ts` files at runtime; a previous
// version of this package set `main` to a TypeScript source file, which
// worked in dev (Vite / tsx handle .ts natively) but broke in the production
// container with ERR_UNKNOWN_FILE_EXTENSION. The current shape — JS for
// runtime + .d.ts for types — works everywhere with no build step.

export const TODO_TITLE_MAX = 200;
