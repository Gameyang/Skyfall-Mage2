import { chromium } from "@playwright/test";

const url = process.env.SKYFALL_COMBAT_URL ?? "http://127.0.0.1:5173";

try {
  await waitForServer(url);
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector('.gpu-badge[data-status="ready"]');
  await page.waitForSelector(".enemy-marker");
  const enemy = await page.locator(".enemy-marker").first().boundingBox();

  if (!enemy) {
    throw new Error("Expected an enemy marker before combat verification");
  }

  await page.mouse.move(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(4_200);
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelectorAll(".enemy-marker").length === 0, null, { timeout: 15_000 });
  const dropCount = await page.locator(".item-drop-marker").count();
  await browser.close();

  if (dropCount < 1) {
    throw new Error(`Expected at least one item drop after combat, got ${dropCount}`);
  }

  if (errors.length) {
    throw new Error(`Browser errors:\n${errors.join("\n")}`);
  }

  console.log("BROWSER_COMBAT_OK");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}

async function waitForServer(targetUrl) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(targetUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // keep waiting
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${targetUrl}`);
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}
