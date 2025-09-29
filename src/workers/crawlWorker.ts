// src/workers/crawlWorker.ts
import { Worker, type Processor } from "bullmq";
import { connection } from "../queue/crawl.js";
import { getScraper, listSites } from "../sites/registry.js";
import { closeBrowser } from "../lib/browser.js";

type CrawlJobData = import("../queue/crawl.js").CrawlJobData;

const concurrency = Number(process.env.CONCURRENCY ?? 2);

const processor: Processor<CrawlJobData, unknown> = async (job) => {
  const { site, url, meta } = job.data;

  const scraper = getScraper(site);
  if (!scraper) {
    const known = listSites();
    throw new Error(
      `Unknown site '${site}'. Known sites: ${known.length ? known.join(", ") : "(none)"}`,
    );
  }

  const result = await scraper(url, meta);
  console.log(JSON.stringify({ jobId: job.id, site, url, ok: true, result }));
  return result;
};

const worker = new Worker<CrawlJobData>("crawl", processor, {
  connection,
  concurrency,
});

// Observability
worker.on("failed", (job, err) => {
  console.error(
    JSON.stringify({
      jobId: job?.id,
      site: job?.data.site,
      url: job?.data.url,
      ok: false,
      error: String(err?.message || err),
    }),
  );
});

worker.on("ready", () => {
  console.log(
    JSON.stringify({
      event: "worker-ready",
      queue: "crawl",
      concurrency,
      pid: process.pid,
    }),
  );
});

// Graceful shutdown
async function shutdown() {
  await worker.close();
  await closeBrowser();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
