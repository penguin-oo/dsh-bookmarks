// Dev-only E2E: drive the running test instance (http://127.0.0.1:3738) with a
// headless Edge over CDP — open the persisted conversation, bookmark a reply
// with a note and tags, open the center panel, verify persistence over the
// RPC, and capture screenshots for the README. No model call is made.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.DSH_E2E_BASE ?? "http://127.0.0.1:3738";
// Both values are REQUIRED and intentionally have no defaults: never bake a
// real workspace or session title into the repository.
const WORKSPACE = process.env.DSH_E2E_WORKSPACE;
const SESSION_TITLE = process.env.DSH_E2E_SESSION_TITLE;
if (!WORKSPACE || !SESSION_TITLE) {
  console.error("DSH_E2E_WORKSPACE and DSH_E2E_SESSION_TITLE are required");
  process.exit(2);
}
const DEBUG_PORT = 9222;
const EDGE = process.env.DSH_E2E_BROWSER ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PROFILE_DIR = join(process.env.TEMP ?? ".", "dsh-e2e-edge-profile");
const OUT_DIR = join(process.cwd(), "docs");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (existsSync(PROFILE_DIR)) rmSync(PROFILE_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const edge = spawn(
  EDGE,
  [
    "--headless=new",
    "--disable-gpu",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE_DIR.replace(/\\/g, "/")}`,
    "--no-first-run",
    "--window-size=1440,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function main() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (response.ok) break;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${DEBUG_PORT}`,
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.log("[pageerror]", String(error).slice(0, 300)));
  page.on("console", (message) => {
    if (message.type() === "error") console.log("[console.error]", message.text().slice(0, 200));
  });

  console.log("navigating to", BASE);
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("button.dshbm_footerAction", { timeout: 90000 });
  console.log("plugin UI mounted (sidebar footer button present)");

  // Select the workspace first (fresh instances boot into the "choose a
  // workspace" empty state, and the sidebar lists sessions only after that).
  await page.evaluate(() => {
    const target = [...document.querySelectorAll("button")].find(
      (b) => (b.getAttribute("aria-label") ?? "").includes("选择工作区") || b.textContent.trim() === "选择工作区",
    );
    if (target) target.click();
  });
  await sleep(2500);
  let workspacePicked = false;
  for (let attempt = 0; attempt < 15 && !workspacePicked; attempt += 1) {
    workspacePicked = await page.evaluate((workspace) => {
      const rows = [...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === workspace);
      if (rows.length === 0) return false;
      const row = rows.find((b) => b.closest("[role=dialog],[role=menu],dialog,form") !== null) ?? rows[rows.length - 1];
      const rect = row.getBoundingClientRect();
      row.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: rect.x + 2, clientY: rect.y + 2 }));
      row.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: rect.x + 2, clientY: rect.y + 2 }));
      row.click();
      return true;
    }, WORKSPACE);
    if (!workspacePicked) await sleep(1000);
  }
  console.log("workspace picked:", workspacePicked);
  await sleep(4000);

  // Open the persisted conversation from the sidebar.
  let opened = false;
  for (let attempt = 0; attempt < 20 && !opened; attempt += 1) {
    opened = await page.evaluate((title) => {
      const clickables = document.querySelectorAll('button, [role="button"], a, [tabindex]');
      let row = [...clickables].find((el) => (el.textContent ?? "").includes(title));
      if (row === undefined) {
        // Fall back to the deepest generic element whose text matches.
        const all = [...document.querySelectorAll("*")];
        row = all
          .filter((el) => (el.textContent ?? "").trim().includes(title))
          .sort((a, b) => a.textContent.trim().length - b.textContent.trim().length)[0];
      }
      if (row === undefined) return false;
      const rect = row.getBoundingClientRect();
      row.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: rect.x + 2, clientY: rect.y + 2 }));
      row.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: rect.x + 2, clientY: rect.y + 2 }));
      row.click();
      return true;
    }, SESSION_TITLE);
    if (!opened) await sleep(1000);
  }
  if (!opened) {
    await page.screenshot({ path: join(OUT_DIR, "diagnostic-no-session.png") });
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 800));
    throw new Error(`session row "${SESSION_TITLE}" not found in sidebar; body: ${body}`);
  }
  console.log("session row clicked, waiting for conversation…");

  let found = false;
  for (let i = 0; i < 60; i += 1) {
    const present = await page.evaluate(() => document.querySelectorAll("button.dshbm_action").length > 0);
    if (present) {
      found = true;
      break;
    }
    await sleep(1500);
  }
  if (!found) {
    await page.screenshot({ path: join(OUT_DIR, "diagnostic-no-action.png") });
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 600));
    throw new Error(`bookmark buttons never appeared; body: ${body}`);
  }
  console.log("conversation rendered with bookmark buttons");

  // Screenshot 1: the action strip of a visible message (hover reveals it).
  const action = await page.$("button.dshbm_action");
  await action.hover();
  await sleep(600);
  await page.screenshot({ path: join(OUT_DIR, "screenshot-actions.png") });
  console.log("screenshot-actions saved");

  // Bookmark it and fill note + tags.
  await action.click();
  await page.waitForSelector("span.dshbm_editor textarea.dshbm_field", { timeout: 10000 });
  await page.type("span.dshbm_editor textarea.dshbm_field", "这条回复很棒，留档备查");
  await page.type("span.dshbm_editor input.dshbm_field", "测试, 收藏夹");
  await page.click("span.dshbm_editor button.dshbm_save");
  await sleep(1500);
  const active = await page.evaluate(
    () => document.querySelector("button.dshbm_action")?.getAttribute("data-active") !== null,
  );
  console.log("bookmark active after save:", active);
  await page.screenshot({ path: join(OUT_DIR, "screenshot-bookmarked.png") });

  // Open the center panel.
  await page.click("button.dshbm_footerAction");
  await page.waitForSelector("div.dshbm_panel", { timeout: 10000 });
  await sleep(1000);
  await page.screenshot({ path: join(OUT_DIR, "screenshot-center.png") });
  console.log("screenshot-center saved");

  // Verify persistence over the RPC.
  const response = await fetch(`${BASE}/api/bookmarks/list`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "client-request",
      rpcId: "e2e-verify-0001",
      method: "bookmarks/list",
      payload: { args: {} },
    }),
  });
  const payload = await response.json();
  const items = payload.result?.value?.value?.items ?? [];
  const target = items.find((item) => item.note === "这条回复很棒，留档备查");
  console.log("RPC verify — items:", items.length, target ? { tags: target.tags, snippetChars: target.snippet.length } : null);
  if (!target) throw new Error("RPC verification failed: note not found");

  // Leave the test bookmark in place (it also demos the center), but report it.
  console.log("E2E PASSED (one demo bookmark left in the store)");
  await browser.disconnect();
}

try {
  await main();
} catch (error) {
  console.error("E2E FAILED:", error.message);
  process.exitCode = 1;
} finally {
  edge.kill();
}
