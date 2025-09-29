// src/lib/sink.ts
// Ultra-simple JSONL sink for crawl results.
// Set RESULTS_PATH to override (default: data/results.jsonl).

import { promises as fs } from "node:fs";
import { dirname } from "node:path";

function resultsPath(): string {
  return process.env.RESULTS_PATH ?? "data/results.jsonl";
}

export async function appendJsonl(record: unknown): Promise<void> {
  const path = resultsPath();
  await fs.mkdir(dirname(path), { recursive: true });
  const line = JSON.stringify(record) + "\n";
  await fs.appendFile(path, line, "utf8");
}
