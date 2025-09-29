// src/lib/env.ts
// Loads .env once for the whole app. Import this at the top of any entrypoint.
import "dotenv/config";

// Small helpers (optional to use elsewhere)
export function env(name: string): string | undefined {
  return process.env[name];
}
export function envNum(name: string, fallback?: number): number | undefined {
  const v = process.env[name];
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}
export function envBool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}
