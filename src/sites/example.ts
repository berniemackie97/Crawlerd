import { withPage } from "../lib/browser.js";

export type ExampleResult = {
  url: string;
  title: string;
  h1: string | null;
  linkCount: number;
};

export async function scrapeExample(
  url: string = "https://example.com/",
): Promise<ExampleResult> {
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const title = await page.title();
    const h1 = (await page.locator("h1").first().textContent())?.trim() ?? null;
    const linkCount = await page.locator("a").count();

    return { url, title, h1, linkCount };
  });
}
