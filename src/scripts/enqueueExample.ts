// src/scripts/enqueueExample.ts
import { enqueueCrawl, crawlQueue, connection } from "../queue/crawl.js";

async function main() {
  const url = process.env.URL ?? "https://example.com/";
  const job = await enqueueCrawl({ site: "example", url });
  console.log(JSON.stringify({ event: "enqueued", id: job.id, url }));

  // Tidy exit: close BullMQ objects in this process
  await crawlQueue.close();
  await connection.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
