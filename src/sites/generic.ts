// src/sites/generic.ts
import { withPage } from "../lib/browser.js";
import type { Page } from "playwright";

export type GenericResult = {
  requestedUrl: string;
  finalUrl: string;
  status: number | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1: string | null;
  h2: string[]; // first few H2s if present
  linkCount: number;
};

export async function scrapeGeneric(
  url: string,
  meta?: Record<string, unknown>,
): Promise<GenericResult> {
  return withPage(async (page) => {
    await preparePage(page, meta);

    const resp = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Soft settle without hanging forever
    try {
      await page.waitForLoadState("networkidle", { timeout: 5_000 });
    } catch {}

    const finalUrl = page.url();
    const status = resp ? resp.status() : null;

    const title = await page.title().catch(() => null);

    const metaDescription = await page
      .locator('meta[name="description"]')
      .first()
      .getAttribute("content")
      .catch(() => null);

    const canonical = await page
      .locator('link[rel="canonical"]')
      .first()
      .getAttribute("href")
      .catch(() => null);

    const h1 = await firstTextIfExists(page, "h1");
    const h2 = await firstNTexts(page, "h2", 5);

    const linkCount = await page.locator("a").count();

    return {
      requestedUrl: url,
      finalUrl,
      status,
      title: title ?? null,
      metaDescription,
      canonical,
      h1,
      h2,
      linkCount,
    };
  });
}

/* ------------------------------- utilities -------------------------------- */

async function preparePage(page: Page, meta?: Record<string, unknown>) {
  // Optional: allow caller to block heavy resources
  const block = (meta?.blockResources as string[]) ?? [
    "image",
    "media",
    "font",
  ];
  await page.route("**/*", (route) => {
    const t = route.request().resourceType();
    if (block.includes(t)) return route.abort();
    route.continue();
  });

  page.setDefaultNavigationTimeout(30_000);
  page.setDefaultTimeout(10_000);
}

async function firstTextIfExists(
  page: Page,
  selector: string,
): Promise<string | null> {
  const loc = page.locator(selector).first();
  const count = await loc.count();
  if (count === 0) return null;
  const text = await loc.textContent();
  return text?.trim() ?? null;
}

async function firstNTexts(
  page: Page,
  selector: string,
  n: number,
): Promise<string[]> {
  const loc = page.locator(selector);
  const count = Math.min(await loc.count(), n);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = await loc.nth(i).textContent();
    if (t && t.trim()) out.push(t.trim());
  }
  return out;
}
