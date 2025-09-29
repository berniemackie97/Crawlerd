// src/queue/crawl.ts
import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

export type CrawlJobData = {
  site: string; // open-ended site id
  url: string; // target URL
  meta?: Record<string, unknown>; // optional per-job knobs (cookies, query, etc.)
};

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// BullMQ is happiest when ioredis doesn't do per-command retries or ready checks.
export const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const crawlQueue = new Queue<CrawlJobData>("crawl", { connection });

export async function enqueueCrawl(data: CrawlJobData, opts: JobsOptions = {}) {
  return crawlQueue.add("crawl", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
    ...opts,
  });
}
