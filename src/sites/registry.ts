// src/sites/registry.ts
export type ScrapeFn = (
  url: string,
  meta?: Record<string, unknown>,
) => Promise<unknown>;

const registry = new Map<string, ScrapeFn>();

export function registerSite(id: string, fn: ScrapeFn) {
  if (!id || typeof id !== "string")
    throw new Error("site id must be a string");
  registry.set(id, fn);
}

export function getScraper(id: string): ScrapeFn | undefined {
  return registry.get(id);
}

export function listSites(): string[] {
  return [...registry.keys()].sort();
}

/* -------------------------- built-in registrations -------------------------- */

import { scrapeExample } from "./example.js";
registerSite("example", (url, meta) => scrapeExample(url));

// 👇 NEW: generic, works for unknown sites
import { scrapeGeneric } from "./generic.js";
registerSite("generic", (url, meta) => scrapeGeneric(url, meta));

// --- Auto-load any site modules named *.site.ts or *.site.js in this folder ---
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export async function autoloadSites(): Promise<void> {
  const herePath = __dirname; // fine under NodeNext when output is CJS
  const files = await readdir(herePath);
  for (const name of files) {
    if (!/\.site\.(ts|js)$/i.test(name)) continue;
    const full = join(herePath, name);
    // Side-effect import: each site module should call registerSite(...) on import
    await import(pathToFileURL(full).href);
  }
}
