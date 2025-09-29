import {
  chromium,
  devices,
  type Browser,
  type BrowserContext,
  type Page,
  type LaunchOptions,
} from "playwright";

let browserPromise: Promise<Browser> | null = null;

function makeLaunchOptions(): LaunchOptions {
  const headless = process.env.HEADFUL ? false : true;

  const server =
    process.env.PLAYWRIGHT_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.HTTPS_PROXY;

  const proxy = server
    ? {
        server,
        ...(process.env.PROXY_USERNAME
          ? { username: process.env.PROXY_USERNAME }
          : {}),
        ...(process.env.PROXY_PASSWORD
          ? { password: process.env.PROXY_PASSWORD }
          : {}),
      }
    : undefined;

  const opts: LaunchOptions = { headless };
  if (proxy) opts.proxy = proxy; // omit key entirely unless defined
  return opts;
}

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch(makeLaunchOptions());
  }
  return browserPromise;
}

export async function newContext(
  overrides: Parameters<Browser["newContext"]>[0] = {},
): Promise<BrowserContext> {
  const browser = await getBrowser();
  const device = devices["Desktop Chrome"];

  return browser.newContext({
    ...device, // sensible UA/viewport defaults
    viewport: { width: 1366, height: 900 },
    locale: process.env.LOCALE || "en-US",
    timezoneId: process.env.TZ || "America/New_York",
    userAgent: process.env.UA || device.userAgent,
    ignoreHTTPSErrors: true,
    ...overrides,
  });
}

export async function withPage<T>(
  fn: (page: Page, context: BrowserContext) => Promise<T>,
): Promise<T> {
  const context = await newContext();
  const page = await context.newPage();
  try {
    return await fn(page, context);
  } finally {
    await context.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    browserPromise = null;
    await b.close();
  }
}

// tidy shutdown during local dev
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    closeBrowser().finally(() => process.exit());
  });
}
