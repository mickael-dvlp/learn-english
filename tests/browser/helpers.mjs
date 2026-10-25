/**
 * Browser checks with the Chrome installed on the computer (puppeteer-core, no browser download).
 * The app must be running: `npm run dev`, or `npm run build` then `npx next start -p 3001`.
 *
 *   npm run test:browser                          against http://localhost:3000
 *   npm run test:browser -- http://localhost:3001
 */
import puppeteer from "puppeteer-core";

export const BASE = process.argv[2] ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let problems = 0;
export function check(ok, message) {
  console.log(ok ? "  ✓" : "  ✗", message);
  if (!ok) problems++;
}

export async function launch() {
  return puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
}

/** A fresh page (empty storage) at a phone's size; console errors are collected. */
export async function phonePage(browser, errors) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
  page.on("console", (message) => message.type() === "error" && errors.push(message.text().slice(0, 200)));
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 200)));
  return { context, page };
}

export async function go(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
  await wait(300);
}

/** Clicks the first element matching `selector` whose text contains `text`. */
export async function clickText(page, selector, text) {
  const handle = await page.evaluateHandle(
    (sel, wanted) => [...document.querySelectorAll(sel)].find((element) => element.innerText.includes(wanted)),
    selector,
    text,
  );
  const element = handle.asElement();
  if (!element) throw new Error(`introuvable : ${selector} « ${text} »`);
  await element.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await wait(150);
  await element.click();
  await wait(400);
}

export const storage = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);

export const setStorage = (page, key, value) => page.evaluate((k, v) => localStorage.setItem(k, JSON.stringify(v)), key, value);

export const text = (page, selector = "main") => page.$eval(selector, (element) => element.innerText);

export function summary(errors) {
  console.log(`\n${problems ? `${problems} problème(s)` : "✓ tout est bon"} · erreurs de la console : ${errors.length ? JSON.stringify(errors) : "aucune"}`);
  return problems === 0 && errors.length === 0;
}
