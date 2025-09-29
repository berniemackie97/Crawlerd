// src/scripts/newSite.ts
// Scaffolds a site plugin that auto-registers with the registry.
// Usage:
//   pnpm exec tsx src/scripts/newSite.ts <site-id>
//   pnpm exec tsx src/scripts/newSite.ts <site-id> --force
//
// After generating, restart the worker: pnpm run worker

import { promises as fs } from "node:fs";
import { join } from "node:path";

type Args = { id?: string; force?: boolean };

function parse(argv: string[]): Args {
  let id: string | undefined;
  let force = false;

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (!a) continue;
    if (a === "--force") {
      force = true;
      continue;
    }
    if (!a.startsWith("-") && !id) id = a;
  }

  const out: Args = {};
  if (id !== undefined) out.id = id; // omit if undefined
  if (force) out.force = true; // omit when false
  return out;
}

function toPascal(id: string): string {
  return id
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

function template(id: string): string {
  const P = toPascal(id);
  return `// src/sites/${id}.site.ts (generated)
// Replace the generic call with custom Playwright logic when ready.
import { registerSite } from "./registry.js";
import { scrapeGeneric } from "./generic.js";

export async function scrape${P}(url: string, meta?: Record<string, unknown>) {
  // TODO: implement site-specific scraping with Playwright.
  // For now, delegate to the generic scraper so this plugin works immediately.
  return scrapeGeneric(url, meta);
}

registerSite("${id}", (url, meta) => scrape${P}(url, meta));
`;
}

async function main() {
  const { id, force } = parse(process.argv);
  if (!id) {
    console.error("Usage: tsx src/scripts/newSite.ts <site-id> [--force]");
    process.exit(2);
  }
  const dest = join(process.cwd(), "src", "sites", `${id}.site.ts`);
  try {
    await fs.stat(dest);
    if (!force) {
      console.error(
        `Refusing to overwrite existing file: ${dest} (use --force to override)`,
      );
      process.exit(2);
    }
  } catch {
    /* file does not exist, good */
  }

  await fs.writeFile(dest, template(id), "utf8");
  console.log(
    JSON.stringify({ event: "created", file: dest, site: id }, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
