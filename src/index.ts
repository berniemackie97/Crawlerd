// src/index.ts
import { scrapeExample } from "./sites/example.js";
import { closeBrowser } from "./lib/browser.js";

async function main() {
  const url = process.env.URL ?? "https://example.com/";
  const result = await scrapeExample(url);
  console.log(JSON.stringify(result, null, 2));
  await closeBrowser();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
