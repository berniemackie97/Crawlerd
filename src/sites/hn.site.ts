// src/sites/hn.site.ts
import { registerSite } from "./registry.js";
import { withPage } from "../lib/browser.js";
import { ensureAllowedOrThrow } from "../lib/robots.js";
import type { Page, Locator } from "playwright";

export type HnItem = {
  id: number | null;
  rank: number | null;
  title: string | null;
  url: string | null;
  site: string | null;
  points: number | null;
  author: string | null;
  age: string | null;      // e.g., "5 hours ago"
  comments: number | null; // null if "discuss"
};

export type HnResult = {
  url: string;
  count: number;
  items: HnItem[];
};

export async function scrapeHn(
  url: string,
  meta?: Record<string, unknown>
): Promise<HnResult> {
  const limit =
    typeof meta?.["limit"] === "number"
      ? Math.max(1, Math.min(100, meta["limit"] as number))
      : 30;

  return withPage(async (page) => {
    await ensureAllowedOrThrow(url);
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(30_000);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    try {
      await page.waitForLoadState("networkidle", { timeout: 3_000 });
    } catch {}

    const rows = page.locator("tr.athing");
    const n = Math.min(await rows.count(), limit);
    const items: HnItem[] = [];

    for (let i = 0; i < n; i++) {
      const row = rows.nth(i);
      const idAttr = await row.getAttribute("id");
      const id = idAttr ? Number(idAttr) : null;

      const titleLink = row.locator("span.titleline a").first();
      const title = (await titleLink.textContent().catch(() => null))?.trim() ?? null;
      const href = await titleLink.getAttribute("href");

      // site string is absent on internal posts → don't wait for it
      const site = await textIfExists(row.locator("span.sitestr").first());

      // subtext lives in the next sibling <tr>, but some rows (e.g., jobs) differ
      const sub = row.locator('xpath=following-sibling::tr[1]//td[contains(@class,"subtext") or @class="subtext"]');

      const scoreText = (await textIfExists(sub.locator("span.score"))) ?? "";
      const points = parseFirstInt(scoreText);

      const author = (await textIfExists(sub.locator("a.hnuser"))) ?? null;
      const age = (await textIfExists(sub.locator("span.age"))) ?? null;

      // comments link is typically the last <a> in subtext (may say "discuss")
      let comments: number | null = null;
      try {
        const linksInSub = sub.locator("a");
        const linkCount = await linksInSub.count();
        if (linkCount > 0) {
          const lastText = (await linksInSub.nth(linkCount - 1).textContent().catch(() => null))?.trim() ?? "";
          const c = parseFirstInt(lastText);
          comments = Number.isFinite(c) ? c : null;
        }
      } catch {
        comments = null;
      }

      // rank can also be missing on some rows; don’t wait for it
      const rankText = (await textIfExists(row.locator("span.rank"))) ?? "";
      const rank = parseFirstInt(rankText);

      items.push({
        id,
        rank,
        title,
        url: href ?? null,
        site,
        points,
        author,
        age,
        comments,
      });
    }

    return { url, count: items.length, items };
  });
}

function parseFirstInt(text: string): number | null {
  const m = /-?\d+/.exec(text);
  return m ? Number(m[0]) : null;
}

async function textIfExists(loc: Locator): Promise<string | null> {
  const count = await loc.count();
  if (count === 0) return null;
  const t = await loc.first().textContent().catch(() => null);
  return t?.trim() ?? null;
}

registerSite("hn", (url, meta) => scrapeHn(url, meta));
