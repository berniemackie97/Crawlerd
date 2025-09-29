// src/lib/robots.ts
// Minimal robots.txt fetcher + evaluator with caching.
// Respects the standard "longest-match wins" rule (Allow beats Disallow on ties).
// Toggle via .env: RESPECT_ROBOTS=1 (default 1), ROBOTS_AGENT=<name>

import { URL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { env, envBool } from "./env.js";

type Rules = { allow: string[]; disallow: string[] };
type Robots = { byAgent: Map<string, Rules>; fetchedAt: number };

const cache = new Map<string /*origin*/, Robots>();
const TTL_MS = 10 * 60 * 1000; // 10 min

function agentName(): string {
  return env("ROBOTS_AGENT") ?? "CrawlerdBot";
}

function originFrom(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.host}`;
}

function robotsUrlFor(origin: string): string {
  // Per standard, robots lives at the origin root
  return origin.replace(/\/+$/, "") + "/robots.txt";
}

function isFresh(r: Robots): boolean {
  return Date.now() - r.fetchedAt < TTL_MS;
}

export async function ensureAllowedOrThrow(targetUrl: string): Promise<void> {
  if (!envBool("RESPECT_ROBOTS", true)) return; // toggle off

  const ok = await isAllowed(targetUrl, agentName());
  if (!ok) {
    throw new Error(
      `Blocked by robots.txt for agent '${agentName()}': ${targetUrl}`,
    );
  }
}

export async function isAllowed(
  targetUrl: string,
  ua: string,
): Promise<boolean> {
  const u = new URL(targetUrl);
  const origin = originFrom(targetUrl);

  const robots = await getRobots(origin);
  const uaKey = pickAgentKey(robots, ua);

  const rules = robots.byAgent.get(uaKey);
  if (!rules) return true; // No rules ⇒ allow

  const path = u.pathname + (u.search || "");
  return evaluate(rules, path);
}

/* ------------------------------ fetch & parse ------------------------------ */

async function getRobots(origin: string): Promise<Robots> {
  const cached = cache.get(origin);
  if (cached && isFresh(cached)) return cached;

  const url = robotsUrlFor(origin);
  let text = "";
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch {
    // Missing/inaccessible robots ⇒ treat as empty (allow all)
    const empty: Robots = { byAgent: new Map(), fetchedAt: Date.now() };
    cache.set(origin, empty);
    return empty;
  }

  const parsed = parseRobots(text);
  const robots: Robots = { byAgent: parsed, fetchedAt: Date.now() };
  cache.set(origin, robots);
  return robots;
}

function parseRobots(text: string): Map<string, Rules> {
  const map = new Map<string, Rules>();
  const lines = text.split(/\r?\n/);

  // Track the current agent block(s). Multiple consecutive `User-agent:` lines share rules.
  let currentAgents: string[] = [];
  let lastKey: "user-agent" | "allow" | "disallow" | null = null;

  const ensureAgent = (agentRaw: string): string => {
    const agent = agentRaw.toLowerCase();
    if (!map.has(agent)) map.set(agent, { allow: [], disallow: [] });
    return agent;
  };

  for (const raw of lines) {
    const line = raw.replace(/#.*/, "").trim(); // strip comments + trim
    if (!line) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue; // skip malformed lines

    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      const agent = ensureAgent(val);
      if (lastKey === "user-agent") {
        // Consecutive user-agent lines extend the current group
        currentAgents.push(agent);
      } else {
        // New section
        currentAgents = [agent];
      }
      lastKey = "user-agent";
    } else if (key === "allow" || key === "disallow") {
      if (currentAgents.length === 0) {
        // If rules appear before any User-agent, attach them to "*"
        currentAgents = [ensureAgent("*")];
      }
      for (const a of currentAgents) {
        const rules = map.get(a)!;
        rules[key].push(val);
      }
      lastKey = key;
    }
    // Ignore unknown directives
  }

  // Ensure a fallback entry exists
  if (!map.has("*")) map.set("*", { allow: [], disallow: [] });

  return map;
}

/* --------------------------------- policy --------------------------------- */

function pickAgentKey(robots: Robots, ua: string): string {
  const low = ua.toLowerCase();
  if (robots.byAgent.has(low)) return low;
  return "*";
}

function evaluate(rules: Rules, pathWithQuery: string): boolean {
  // Longest path match wins; if equal, Allow wins (Google spec).
  let bestAllow = -1;
  for (const a of rules.allow) {
    const len = matchLen(a, pathWithQuery);
    if (len > bestAllow) bestAllow = len;
  }
  let bestDis = -1;
  for (const d of rules.disallow) {
    const len = matchLen(d, pathWithQuery);
    if (len > bestDis) bestDis = len;
  }
  if (bestAllow === -1 && bestDis === -1) return true;
  if (bestAllow >= bestDis) return true;
  return false;
}

// Simple prefix match supporting "*" wildcard (matches any run of chars)
// and "$" end-anchor.
function matchLen(pattern: string, path: string): number {
  if (pattern === "") return 0;
  // Convert to RegExp once per call; for our volumes this is fine.
  const esc = pattern
    .replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&")
    .replace(/\\\*/g, ".*");
  const anchored = esc.endsWith("\\$") ? esc.slice(0, -2) + "$" : esc;
  const re = new RegExp("^" + anchored);
  const m = re.exec(path);
  return m ? m[0].length : -1;
}
