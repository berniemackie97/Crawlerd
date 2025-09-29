// src/scripts/showResults.ts
// Prints the last N lines from the JSONL sink (pretty-printed).
// Usage: pnpm exec tsx src/scripts/showResults.ts [--n 5]
// Set RESULTS_PATH to override the file (default: data/results.jsonl)

import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";

function parseArgs(argv: string[]) {
  let n = 5;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i] ?? "";
    const v = argv[i + 1];
    if ((a === "--n" || a === "--limit") && v && !Number.isNaN(Number(v))) {
      n = Number(v);
      i++;
    }
  }
  return { n };
}

async function main() {
  const path = process.env.RESULTS_PATH ?? "data/results.jsonl";
  const { n } = parseArgs(process.argv);

  if (!existsSync(path)) {
    console.error(`No results file yet at: ${path}`);
    process.exit(2);
  }

  const text = await fs.readFile(path, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const tail = lines.slice(-n);

  if (tail.length === 0) {
    console.log("(results file is empty)");
    return;
  }

  for (const line of tail) {
    try {
      const obj = JSON.parse(line);
      console.log(JSON.stringify(obj, null, 2));
    } catch {
      console.log(line); // if a line is not valid JSON, print raw
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
