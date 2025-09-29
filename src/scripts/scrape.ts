// src/scripts/scrape.ts
// Usage:
//   pnpm exec tsx src/scripts/scrape.ts https://google.com/
//   pnpm exec tsx src/scripts/scrape.ts --site example https://example.com/
//   pnpm exec tsx src/scripts/scrape.ts --site generic --meta '{"blockResources":["font"]}' https://news.ycombinator.com/

import "../lib/env.js";
import { getScraper, listSites } from "../sites/registry.js";
import { closeBrowser } from "../lib/browser.js";

type Argv = { site?: string; url?: string; meta?: string };

function parseArgs(argv: string[]): Argv {
  const out: Argv = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i] ?? ""; // guarantee string
    const next = argv[i + 1];

    if (a === "--site" && typeof next === "string") {
      out.site = next;
      i++;
    } else if (a === "--meta" && typeof next === "string") {
      out.meta = next;
      i++;
    } else if (!a.startsWith("-") && !out.url && a.length > 0) {
      out.url = a;
    }
  }
  return out;
}

async function main() {
  const { site = "generic", url, meta } = parseArgs(process.argv);
  if (!url) {
    console.error(
      "Usage: tsx src/scripts/scrape.ts [--site <id>] [--meta '{...}'] <url>",
    );
    process.exit(2);
  }

  const scraper = getScraper(site);
  if (!scraper) {
    const known = listSites();
    console.error(
      `Unknown site '${site}'. Known: ${known.length ? known.join(", ") : "(none)"}`,
    );
    process.exit(2);
  }

  let metaObj: Record<string, unknown> | undefined;
  if (meta) {
    try {
      metaObj = JSON.parse(meta);
    } catch (e) {
      console.error("Invalid JSON for --meta:", e);
      process.exit(2);
    }
  }

  const result = await scraper(url, metaObj);
  console.log(JSON.stringify(result, null, 2));
  await closeBrowser();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
