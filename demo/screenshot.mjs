// Renders demo/index.html headlessly and saves screenshots, including the
// "pending undo" and "details open" states of the first card.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const page = await (await chromium.launch({ executablePath: process.env.CHROME_PATH })).newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 2 });
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
await page.goto("file://" + fileURLToPath(new URL("./index.html", import.meta.url)));
await page.waitForTimeout(1800);
await page.screenshot({ path: fileURLToPath(new URL("./overview.png", import.meta.url)), fullPage: true });

const first = page.locator("#light grocy-chore-card").first();
await first.locator(".row").nth(0).locator(".main").click();
await first.locator(".row").nth(2).locator(".check").click();
await page.waitForTimeout(1200);
await first.screenshot({ path: fileURLToPath(new URL("./interaction.png", import.meta.url)) });
await page.waitForTimeout(2500);
await first.screenshot({ path: fileURLToPath(new URL("./after.png", import.meta.url)) });
process.exit(0);
