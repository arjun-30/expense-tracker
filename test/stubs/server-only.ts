// Next.js resolves "server-only" via its own build-time alias; vitest has no
// such alias, so it's aliased here (see vitest.config.ts) to let tests import
// server code (rbac.ts, permissions.ts, etc.) without a resolution error.
export {};
