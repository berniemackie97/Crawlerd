// src/scripts/crawlUrl.ts
import { enqueueCrawl, crawlQueue, connection } from "../queue/crawl.js";

function parse(argv: string[]) {
  let site: string | undefined;
  let url: string | undefined;

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i] ?? ""; // guarantee a string
    if (a === "--site" && argv[i + 1] !== undefined) {
      site = argv[++i];
    } else if (!a.startsWith("-") && !url && a.length > 0) {
      url = a;
    }
  }
  return { site: site ?? "generic", url };
}

async function main() {
  const { site, url } = parse(process.argv);
  if (!url) {
    console.error("Usage: tsx src/scripts/crawlUrl.ts [--site <id>] <url>");
    process.exit(2);
  }

  const job = await enqueueCrawl({ site, url });
  console.log(
    JSON.stringify({ event: "enqueued", id: job.id, site, url }, null, 2),
  );

  await crawlQueue.close();
  await connection.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
