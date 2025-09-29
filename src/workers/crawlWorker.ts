// src/workers/crawlWorker.ts
import "../lib/env.js";
import { Worker, type Processor } from "bullmq";
import { connection } from "../queue/crawl.js";
import { getScraper, listSites } from "../sites/registry.js";
import { closeBrowser } from "../lib/browser.js";
import { appendJsonl } from "../lib/sink.js";

type CrawlJobData = import("../queue/crawl.js").CrawlJobData;

const concurrency = Number(process.env.CONCURRENCY ?? 2);

const processor: Processor<CrawlJobData, unknown> = async (job) => {
  const { site, url, meta } = job.data;

  let resolvedSite = site;
  let scraper = getScraper(site);

  if (!scraper) {
    const generic = getScraper("generic");
    if (generic) {
      resolvedSite = "generic";
      scraper = generic;
      console.warn(
        JSON.stringify({
          event: "fallback",
          requestedSite: site,
          resolvedSite,
          url,
        }),
      );
    } else {
      const known = listSites();
      throw new Error(
        `Unknown site '${site}'. Known sites: ${known.length ? known.join(", ") : "(none)"}`,
      );
    }
  }

  const result = await scraper(url, meta);

  const record = {
    ts: new Date().toISOString(),
    event: "result",
    jobId: job.id,
    requestedSite: site,
    site: resolvedSite,
    url,
    ok: true as const,
    result,
  };

  // Write to JSONL (doesn't block success if it fails)
  try {
    await appendJsonl(record);
  } catch (e) {
    console.error(JSON.stringify({ event: "sink-error", message: String(e) }));
  }

  console.log(JSON.stringify(record));
  return result;
};

const worker = new Worker<CrawlJobData>("crawl", processor, {
  connection,
  concurrency,
});

worker.on("failed", async (job, err) => {
  const rec = {
    ts: new Date().toISOString(),
    event: "failed",
    jobId: job?.id,
    requestedSite: job?.data.site,
    url: job?.data.url,
    ok: false as const,
    error: String(err?.message || err),
  };
  // Try to persist failure as well
  try {
    await appendJsonl(rec);
  } catch {}
  console.error(JSON.stringify(rec));
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

async function shutdown() {
  await worker.close();
  await closeBrowser();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
