// src/sites/hn.site.ts
import { registerSite } from "./registry.js";
import { withPage } from "../lib/browser.js";
import { ensureAllowedOrThrow } from "../lib/robots.js";
import type { Page, Locator } from "playwright";

export type HnItem = {
  id: number | null;
  page: number;           // which page this item came from (1..N)
  rank: number | null;    // rank as shown on that page (1..30)
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
  pages: number;          // pages fetched
  count: number;          // total items across pages
  items: HnItem[];
};

export async function scrapeHn(
  url: string,
  meta?: Record<string, unknown>
): Promise<HnResult> {
  const limitPerPage =
    typeof meta?.["limit"] === "number"
      ? Math.max(1, Math.min(100, meta["limit"] as number))
      : 30;

  const pages =
    typeof meta?.["pages"] === "number"
      ? Math.max(1, Math.min(10, Math.floor(meta["pages"] as number)))
      : 1;

  return withPage(async (page) => {
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(30_000);

    const items: HnItem[] = [];

    for (let p = 1; p <= pages; p++) {
      const pageUrl = pageUrlFor(url, p);
      await ensureAllowedOrThrow(pageUrl);
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      try { await page.waitForLoadState("networkidle", { timeout: 3_000 }); } catch {}

      const rows = page.locator("tr.athing");
      const n = Math.min(await rows.count(), limitPerPage);

      for (let i = 0; i < n; i++) {
        const row = rows.nth(i);
        const idAttr = await row.getAttribute("id");
        const id = idAttr ? Number(idAttr) : null;

        const titleLink = row.locator("span.titleline a").first();
        const title = (await titleLink.textContent().catch(() => null))?.trim() ?? null;
        const href = await titleLink.getAttribute("href");

        // Absent on internal posts → don't wait for it
        const site = await textIfExists(row.locator("span.sitestr").first());

        // subtext usually in the next <tr>
        const sub = row.locator(
          'xpath=following-sibling::tr[1]//td[contains(@class,"subtext") or @class="subtext"]'
        );

        const scoreText = (await textIfExists(sub.locator("span.score"))) ?? "";
        const points = parseFirstInt(scoreText);

        const author = (await textIfExists(sub.locator("a.hnuser"))) ?? null;
        const age = (await textIfExists(sub.locator("span.age"))) ?? null;

        // comments is typically the last <a> in subtext (may say "discuss")
        let comments: number | null = null;
        try {
          const linksInSub = sub.locator("a");
          const linkCount = await linksInSub.count();
          if (linkCount > 0) {
            const lastText = (await linksInSub.nth(linkCount - 1).textContent().catch(() => null))?.trim() ?? "";
            const c = parseFirstInt(lastText);
            comments = Number.isFinite(c) ? c : null;
          }
        } catch { comments = null; }

        // rank may be missing on some rows
        const rankText = (await textIfExists(row.locator("span.rank"))) ?? "";
        const rank = parseFirstInt(rankText);

        items.push({
          id,
          page: p,
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
    }

    return { url, pages, count: items.length, items };
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

function pageUrlFor(base: string, page: number): string {
  if (page <= 1) return base;
  const u = new URL(base);
  u.searchParams.set("p", String(page));
  return u.toString();
}

registerSite("hn", (url, meta) => scrapeHn(url, meta));
