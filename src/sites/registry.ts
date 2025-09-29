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
