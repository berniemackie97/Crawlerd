// src/sites/_template.ts
// HOW TO USE:
// 1) Duplicate this file to `src/sites/<yoursite>.ts`.
// 2) Rename types + function below from MySite → YourSite.
// 3) Implement `scrapeYourSite()` using Playwright `page` APIs.
// 4) In a later step we'll wire your new site into the worker switch.

import { withPage } from "../lib/browser.js";
import type { Page } from "playwright";

export type MySiteResult = {
  url: string;
  title: string | null;
  // add more typed fields you actually care about
  // e.g. items: Array<{ name: string; price: number; href: string }>
};

export async function scrapeMySite(url: string): Promise<MySiteResult> {
  return withPage(async (page) => {
    await preparePage(page);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

    const title = await page.title();

    // EXAMPLE SELECTOR UTILS (use or delete)
    const h1 = await firstText(page, "h1");

    return {
      url,
      title,
      // swap this out with the real data you need:
      // items: await extractItems(page),
    };
  });
}

/* -------------------------- tiny helper utilities -------------------------- */

async function preparePage(page: Page) {
  // Speed-up idea: block heavy resources. Comment out if site breaks.
  await page.route("**/*", (route) => {
    const t = route.request().resourceType();
    if (t === "image" || t === "media" || t === "font") return route.abort();
    route.continue();
  });
  // Set a sane default navigation timeout per page:
  page.setDefaultNavigationTimeout(30_000);
  page.setDefaultTimeout(15_000);
}

async function firstText(page: Page, selector: string): Promise<string | null> {
  const text = await page.locator(selector).first().textContent();
  return text?.trim() ?? null;
}

// Example pattern for lists. Adapt as needed.
/*
async function extractItems(page: Page) {
  const rows = page.locator(".result-row");
  const count = await rows.count();
  const items = [];
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    items.push({
      name: (await row.locator(".name").textContent())?.trim() ?? "",
      price: Number((await row.locator(".price").textContent())?.replace(/[^0-9.]/g, "") ?? 0),
      href: await row.locator("a").first().getAttribute("href"),
    });
  }
  return items;
}
*/
