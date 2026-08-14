// Linux Do driver (stage 1): verify login, dump categories, read promotion rules.
import puppeteer from "puppeteer-core";

const DEBUG_PORT = 9235;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.connect({
  browserURL: `http://127.0.0.1:${DEBUG_PORT}`,
  defaultViewport: { width: 1440, height: 900 },
});
const pages = await browser.pages();
const page = pages.find((p) => p.url().includes("linux.do")) ?? (await browser.newPage());

// 1. Homepage: login state + categories.
await page.goto("https://linux.do/", { waitUntil: "domcontentloaded", timeout: 90000 });
await sleep(8000);
const home = await page.evaluate(() => {
  const text = document.body.innerText.replace(/\s+/g, " ").slice(0, 1500);
  return {
    url: location.href,
    title: document.title,
    loggedInHints: {
      hasUserMenu: !!document.querySelector(".current-user, [class*=current-user], .user-menu"),
      hasAvatarButton: !!document.querySelector("#toggle-current-user, .header-dropdown-toggle"),
      loginLink: [...document.querySelectorAll("a")].some((a) => (a.textContent ?? "").trim() === "登录" || a.href.includes("/login")),
    },
    bodyText: text,
  };
});
console.log("HOME:", JSON.stringify(home, null, 1));

// 2. Promotion rules thread.
await page.goto("https://linux.do/t/topic/1776670", { waitUntil: "domcontentloaded", timeout: 90000 });
await sleep(10000);
const thread = await page.evaluate(() => {
  const posts = [...document.querySelectorAll(".cooked")].map((p) => p.innerText.replace(/\s+/g, " ").trim());
  return {
    url: location.href,
    title: document.title,
    firstPost: (posts[0] ?? "").slice(0, 2500),
    recentPosts: posts.slice(-4).map((p) => p.slice(0, 400)),
  };
});
console.log("THREAD:", JSON.stringify(thread, null, 1));
console.log("BROWSER_KEEP_OPEN");
await browser.disconnect();
