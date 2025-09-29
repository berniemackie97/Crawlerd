// src/scripts/enqueue.ts
import { enqueueCrawl, crawlQueue, connection } from "../queue/crawl.js";
import type { JobsOptions } from "bullmq";

type Argv = {
  site?: string;
  url?: string;
  meta?: string;
  delay?: string;
  attempts?: string;
  priority?: string;
};

function parseArgs(argv: string[]): Argv {
  const out: Argv = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === "--site" && v !== undefined) ((out.site = v), i++);
    else if (a === "--url" && v !== undefined) ((out.url = v), i++);
    else if (a === "--meta" && v !== undefined) ((out.meta = v), i++);
    else if (a === "--delay" && v !== undefined) ((out.delay = v), i++);
    else if (a === "--attempts" && v !== undefined) ((out.attempts = v), i++);
    else if (a === "--priority" && v !== undefined) ((out.priority = v), i++);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.site || !args.url) {
    console.error(
      "Usage: tsx src/scripts/enqueue.ts --site <id> --url <url> [--meta '{...}'] [--delay ms] [--attempts n] [--priority n]",
    );
    process.exit(2);
  }

  let meta: Record<string, unknown> | undefined;
  if (args.meta) {
    try {
      meta = JSON.parse(args.meta);
    } catch (e) {
      console.error("Invalid JSON for --meta:", e);
      process.exit(2);
    }
  }

  const delay = args.delay ? Number(args.delay) : undefined;
  const attempts = args.attempts ? Number(args.attempts) : 3;
  const priority = args.priority ? Number(args.priority) : undefined;

  // Build job data, omitting keys when undefined
  const site = args.site as string;
  const url = args.url as string;
  const jobData: { site: string; url: string; meta?: Record<string, unknown> } =
    {
      site,
      url,
    };
  if (meta !== undefined) jobData.meta = meta;

  // Build BullMQ options, omitting undefined keys
  const opts: JobsOptions = { attempts };
  if (delay !== undefined) opts.delay = delay;
  if (priority !== undefined) opts.priority = priority;

  const job = await enqueueCrawl(jobData, opts);

  console.log(
    JSON.stringify(
      {
        event: "enqueued",
        id: job.id,
        site,
        url,
        meta,
        delay,
        attempts,
        priority,
      },
      null,
      2,
    ),
  );

  await crawlQueue.close();
  await connection.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
