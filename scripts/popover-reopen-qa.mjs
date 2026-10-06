import {openBankMore,revealBankFilter} from './qa-bank-filter-helpers.mjs';
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const browser = await chromium.launch({ headless:true, executablePath:process.env.PLAYWRIGHT_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) throw new Error(`QA check ${checks}: ${message}`); };

try {
  for (const width of [1440, 1280, 600]) {
    const page = await browser.newPage({ viewport:{ width, height:900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("http://fe-civil.local/", route => route.fulfill({ status:200, contentType:"text/html", body:html }));
    await page.goto("http://fe-civil.local/", { waitUntil:"domcontentloaded" });
    if (width < 821) await page.locator('.mobile-bar [data-action="toggle-mobile-sidebar"]').click();
    await page.getByRole("button", { name:"Question Bank", exact:true }).click();
    const summary = page.locator(".bank-advanced-filters > summary");
    const details = page.locator(".bank-advanced-filters");
    const body = page.locator(".bank-advanced-filter-body");

    const checkOpenPanel = async label => {
      await page.waitForTimeout(230);
      const result = await body.evaluate(node => {
        const style = getComputedStyle(node), rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(Math.min(innerWidth - 10, rect.left + 20), Math.min(innerHeight - 10, rect.top + 20));
        return { open:node.parentElement.open, opacity:Number(style.opacity), visibility:style.visibility, pointerEvents:style.pointerEvents, hitInside:node === hit || node.contains(hit), animations:node.getAnimations().map(animation => ({ playState:animation.playState, fill:animation.effect?.getTiming?.().fill })) };
      });
      check(result.open, `${label}: details is open`);
      check(result.opacity > .95, `${label}: panel is opaque, received ${JSON.stringify(result)}`);
      check(result.visibility === "visible" && result.pointerEvents !== "none" && result.hitInside, `${label}: panel is interactive, received ${JSON.stringify(result)}`);
    };
    const cycle = async label => {
      await summary.click();
      await checkOpenPanel(`${label} first open`);
      await summary.click();
      await page.waitForFunction(() => !document.querySelector(".bank-advanced-filters")?.open);
      await summary.click();
      await checkOpenPanel(`${label} reopen`);
      await summary.click();
      await page.waitForFunction(() => !document.querySelector(".bank-advanced-filters")?.open);
    };

    await cycle(`${width}px no filters`);
    if (width < 821) await summary.click();
    await page.selectOption("#bank-topic", "Statics");
    if (width < 821 && await details.evaluate(node => node.open)) {
      await summary.click();
      await page.waitForFunction(() => !document.querySelector(".bank-advanced-filters")?.open);
    }
    await cycle(`${width}px active Topic`);
    await page.locator('.bank-list tbody input[type="checkbox"]').first().check();
    await page.waitForTimeout(350);
    for (const menuClass of ["bank-selection-menu", "bank-tools-menu"]) {
      const menu = page.locator(`.${menuClass}`), trigger = menu.locator(":scope > summary"), panel = menu.locator(":scope > .bank-toolbar-menu-panel");
      for (let round = 1; round <= 2; round += 1) {
        await trigger.click();
        await page.waitForTimeout(230);
        const opacity = await panel.evaluate(node => Number(getComputedStyle(node).opacity));
        check(await menu.evaluate(node => node.open) && opacity > .95, `${width}px ${menuClass} round ${round} opens visibly (opacity ${opacity})`);
        await trigger.click();
        await menu.evaluate(async node => { if (!node.open) return; await new Promise(resolve => { const timer = setTimeout(resolve, 1000); node.addEventListener("toggle", () => { if (!node.open) { clearTimeout(timer); resolve(); } }, { once:true }); }); });
        check(!(await menu.evaluate(node => node.open)), `${width}px ${menuClass} round ${round} closes`);
      }
    }
    const sources = page.locator('.bank-sources-dropdown'), sourcesTrigger = sources.locator(':scope > .shared-filter-trigger');
    for (let round=1;round<=2;round++) {
      await revealBankFilter(page,'.bank-sources-dropdown > .shared-filter-trigger');await sourcesTrigger.click();await page.waitForTimeout(230);
      check(await sources.locator('.shared-filter-popover').evaluate(n=>!n.hidden&&Number(getComputedStyle(n).opacity)>.95),`${width}px Sources round ${round} opens visibly`);
      await page.keyboard.press('Escape');await page.waitForTimeout(200);
      check(!(await sources.locator('.shared-filter-popover').isVisible()),`${width}px Sources round ${round} closes`);
    }
    for (let round=1;round<=2;round++) {
      await revealBankFilter(page,'.bank-sources-dropdown > .shared-filter-trigger');await sourcesTrigger.click();await page.waitForTimeout(230);
      const membership=sources.locator('.bank-sources-membership');
      if(!await membership.evaluate(n=>n.open))await membership.locator('> summary').click();
      check(await membership.locator('[data-source-options="bank:includedIn"]').isVisible(),`${width}px membership round ${round} expands visibly`);
      await membership.locator('> summary').click();
      check(!await membership.locator('[data-source-options="bank:includedIn"]').isVisible(),`${width}px membership round ${round} collapses`);
      await page.keyboard.press('Escape');await page.waitForTimeout(200);
    }
    check(errors.length === 0, `${width}px no page errors: ${errors.join("; ")}`);
    await page.close();
  }
  const standalone = await browser.newPage({ viewport:{ width:1440, height:900 } });
  await standalone.goto(pathToFileURL(path.join(root, "index.html")).href, { waitUntil:"domcontentloaded" });
  await standalone.getByRole("button", { name:"Question Bank", exact:true }).click();
  const standaloneSummary = standalone.locator(".bank-advanced-filters > summary");
  await standaloneSummary.click();
  await standaloneSummary.click();
  await standalone.waitForFunction(() => !document.querySelector(".bank-advanced-filters")?.open);
  await standaloneSummary.click();
  await standalone.waitForTimeout(230);
  check(await standalone.locator(".bank-advanced-filter-body").evaluate(node => node.parentElement.open && Number(getComputedStyle(node).opacity) > .95), "direct standalone file reopens More filters visibly");
  await standalone.screenshot({ path:"/private/tmp/fe-more-filters-reopened.png" });
  await standalone.close();
  console.log(`PASS: ${checks} popover re-open QA checks`);
} finally {
  await browser.close();
}
