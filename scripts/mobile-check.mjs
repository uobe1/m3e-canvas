/* Mobile verification for m3e-canvas: drives the running dev server with emulated touch,
 * dispatches real touch events over CDP, and reports what the phone build does. */
import { chromium, devices } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3100";
/* run: CHROME=/path/to/chrome-linux/chrome node scripts/mobile-check.mjs, against `next dev -p 3100` */
const SHOTS = process.env.SHOTS || "/tmp/shots";
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, cond, info = "") => {
  results.push([cond ? "PASS" : "FAIL", name, info]);
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${info ? `  — ${info}` : ""}`);
  return !!cond;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  /* a mirrored Chromium build: the official CDN runs at ~20KB/s from here */
  executablePath: process.env.CHROME || "/root/pw-chromium/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ ...devices["iPhone 14 Pro"], locale: "en-US" });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("m3e:ui", JSON.stringify({ lang: "en" }));
  } catch {}
});
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text().slice(0, 160)}`);
});
page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 160)}`));
const cdp = await ctx.newCDPSession(page);

const point = (type, x, y, timestamp) =>
  cdp.send("Input.dispatchTouchEvent", {
    type,
    /* CDP round-trips cost ~90ms each, so a swipe gets its clock handed to it: without an
     * explicit timestamp the browser sees a gesture a second long, which is a slow pull */
    ...(timestamp ? { timestamp } : {}),
    touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
  });
async function tapAt(x, y) {
  await point("touchStart", x, y);
  await wait(30);
  await point("touchEnd", x, y);
  await wait(80);
}
async function holdAt(x, y, ms = 560) {
  await point("touchStart", x, y);
  await wait(ms);
  const during = await page.locator('[role="menu"]').count();
  await point("touchEnd", x, y);
  await wait(160);
  return { during, after: await page.locator('[role="menu"]').count() };
}
async function swipeAcross(x0, y0, dx, dy, ms = 170) {
  const steps = 4;
  const t0 = Date.now() / 1000;
  await point("touchStart", x0, y0, t0);
  for (let i = 1; i <= steps; i++) {
    const at = t0 + (ms * i) / steps / 1000;
    const last = i === steps;
    await point(last ? "touchEnd" : "touchMove", x0 + (dx * i) / steps, y0 + (dy * i) / steps, last ? at : at);
  }
  await wait(200);
}
async function tapCenter(sel, n = 0) {
  const box = await page
    .locator(sel)
    .nth(n)
    .boundingBox()
    .catch(() => null);
  if (!box) return false;
  await tapAt(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}
const doc = () => page.evaluate(() => JSON.parse(localStorage.getItem("m3e:doc") || "{}"));
const itemCount = async () =>
  (await doc()).groups?.reduce((a, g) => a + (g.items?.length || 0), 0) ?? -1;
const shot = async (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });

await page.goto(BASE, { waitUntil: "load" });
await page.waitForSelector('button[title="Parts"]', { timeout: 25000 });
await page.evaluate(() => {
  window.__ev = [];
  const label = (t) =>
    t?.closest?.('[role="menu"]') ? "menu" : t?.closest?.("[data-node]") ? "part" : t?.closest?.("[data-frame]") ? "frame" : t?.closest?.("button") ? "button" : t?.tagName || "?";
  for (const type of ["pointerdown", "pointerup", "click", "pointercancel"])
    window.addEventListener(type, (e) => window.__ev.push(`${type}/${e.pointerType}/${label(e.target)}@${Math.round(e.timeStamp)}`), true);
  window.addEventListener("pointermove", () => { window.__ev.push("move"); }, true);
});
await wait(600);

/* 1 — what the phone thinks it is */
const caps = await page.evaluate(() => ({
  coarse: matchMedia("(pointer: coarse)").matches,
  mobile: matchMedia("(max-width: 840px), (pointer: coarse) and (max-width: 1024px)").matches,
  dpr: devicePixelRatio,
}));
check("touch input detected", caps.coarse, JSON.stringify(caps));
check("phone layout active", caps.mobile);
await shot("01-canvas");

/* 2 — the dock holds the six tools */
const dockTitles = ["Parts", "Layers", "Choose screen", "Preview", "Swipe setup", "Multi-select"];
const dockFound = [];
for (const title of dockTitles)
  if (await page.locator(`button[title="${title}"]`).count()) dockFound.push(title);
check("dock has its six keys", dockFound.length === 6, dockFound.join(", "));

/* 3 — long press a part: the menu a right-click would open */
const partBox = await page.locator("[data-node]").first().boundingBox();
let menuRows = [];
if (partBox) {
  const px = partBox.x + partBox.width / 2;
  const py = partBox.y + partBox.height / 2;
  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return "nothing there";
    const node = el.closest("[data-node]");
    return `${el.tagName}${node ? ` data-node=${node.getAttribute("data-node")}` : ` (not a part: ${el.closest("[data-frame]") ? "screen" : "canvas"})`}`;
  }, [px, py]);
  const held = await holdAt(px, py);
  const trail = await page.evaluate(() => window.__ev.splice(0));
  const menu = page.locator('[role="menu"]');
  const up = held.after > 0;
  if (up || held.during) menuRows = await menu.locator('[role="menuitem"]').allTextContents();
  check("long-press on a part opens the menu", up, `${menuRows.join(" / ")} | pressed ${hit} at ${Math.round(px)},${Math.round(py)} | hold=${held.during}/${held.after} | events ${trail.join(", ")}`);
  await shot("02-menu-part");
  const before = await itemCount();
  const dup = menu.locator('[role="menuitem"]', { hasText: "Duplicate" });
  if (await dup.count()) {
    const b = await dup.first().boundingBox();
    await tapAt(b.x + b.width / 2, b.y + b.height / 2);
    await wait(500);
  }
  const after = await itemCount();
  check("menu action duplicates the part", after === before + 1, `${before} -> ${after}`);
  check("menu closes after the action", (await page.locator('[role="menu"]').count()) === 0);
} else check("a part is on the canvas", false, "no [data-node]");

/* 4 — long press the blank canvas and a screen */
const spots = await page.evaluate(() => {
  const inR = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  const nodes = [...document.querySelectorAll("[data-node]")].map((e) => e.getBoundingClientRect());
  const frames = [...document.querySelectorAll("[data-frame]")].map((e) => e.getBoundingClientRect());
  let blank = null;
  let screen = null;
  for (let y = 110; y < innerHeight - 170 && (!blank || !screen); y += 8) {
    for (let x = 6; x < innerWidth - 6; x += 8) {
      const onNode = nodes.some((r) => inR(r, x, y));
      const onFrame = frames.some((r) => inR(r, x, y));
      if (!blank && !onNode && !onFrame) blank = { x, y };
      if (!screen && onFrame && !onNode) screen = { x, y };
    }
  }
  return { blank, screen };
});
for (const [key, label] of [["blank", "long-press on blank canvas"], ["screen", "long-press on a screen"]]) {
  const s = spots[key];
  if (!s) {
    check(`${label} (skipped: no free point)`, true, "no spot to press");
    continue;
  }
  await holdAt(s.x, s.y);
  const menu = page.locator('[role="menu"]');
  const up = await menu.count();
  const rows = up ? await menu.locator('[role="menuitem"]').allTextContents() : [];
  check(label, up > 0, rows.join(" / "));
  await shot(`03-menu-${key}`);
  if (up) {
    await tapAt(4, 120);
    await wait(200);
    check(`${key} menu closes on the scrim`, (await page.locator('[role="menu"]').count()) === 0);
  }
}

/* 5 — the sheets the dock opens */
const closeSheet = async () => {
  const c = page.locator('button[aria-label="Close"]');
  if (await c.count()) {
    const b = await c.first().boundingBox();
    if (b) await tapAt(b.x + b.width / 2, b.y + b.height / 2);
    await wait(500);
  }
};
for (const [title, what] of [["Parts", "parts"], ["Layers", "layers"], ["Choose screen", "screens"], ["Multi-select", "select mode"]]) {
  if (title === "Multi-select") continue;
  await tapCenter(`button[title="${title}"]`);
  await wait(550);
  const open = (await page.locator('button[aria-label="Close"]').count()) > 0;
  if (!check(`${what} sheet opens`, open)) await shot(`04-${what}-MISSING`);
  else await shot(`04-sheet-${what}`);
  await closeSheet();
}

/* 6 — adding a part from the sheet keeps the sheet up for the next one */
const beforeAdd = await itemCount();
await tapCenter('button[title="Parts"]');
await wait(500);
const tileTexts = await page.locator("button").allTextContents();
const tile = page.locator("button").filter({ hasText: /button/i }).first();
if (await tile.count()) {
  const b = await tile.boundingBox();
  await tapAt(b.x + b.width / 2, b.y + b.height / 2);
  await wait(700);
  const afterAdd = await itemCount();
  check("tapping a tile adds the part", afterAdd > beforeAdd, `${beforeAdd} -> ${afterAdd}`);
  check("the parts sheet stays open to add more", (await page.locator('button[aria-label="Close"]').count()) > 0);
  await shot("05-parts-added");
} else check("a Button tile is in the parts sheet", false, `first tiles: ${tileTexts.filter((t) => t.trim()).slice(0, 14).join(" | ").slice(0, 300)}`);
await closeSheet();

/* 7 — tapping a part opens its inspector sheet */
const partBox2 = await page.locator("[data-node]").first().boundingBox();
if (partBox2) {
  await tapAt(partBox2.x + partBox2.width / 2, partBox2.y + partBox2.height / 2);
  await wait(450);
  const bar = (await page.locator("button").filter({ hasText: /Edit/ }).count()) > 0;
  check("tapping a part selects it", bar);
  if (bar) {
    await tapCenter('button:has-text("Edit")');
    await wait(600);
    check("the part inspector opens", (await page.locator('button[aria-label="Close"]').count()) > 0);
    await shot("06-inspector");
    await closeSheet();
  }
}

/* 8 — swipe setup: the gesture writes Frame.swipe */
await tapCenter('button[title="Choose screen"]');
await wait(500);
const addScreen = page.locator("button", { hasText: /Add screen/i }).first();
if (await addScreen.count()) {
  const b = await addScreen.boundingBox();
  if (b) await tapAt(b.x + b.width / 2, b.y + b.height / 2);
  await wait(600);
}
await closeSheet();
let frames = (await doc()).frames || [];
check("a second screen was added", frames.length >= 2, frames.map((f) => f.id).join(","));
/* fit lives in the more menu on a phone */
await tapCenter('button[title="More"]');
await wait(400);
const fitRow = page.locator('[role="menuitem"]').filter({ hasText: /Fit/ }).first();
const foundFit = (await fitRow.count()) > 0;
if (foundFit) {
  const b = await fitRow.boundingBox();
  await tapAt(b.x + b.width / 2, b.y + b.height / 2);
  await wait(500);
}
const stillOpen = await page.locator('[role="menu"]').count();
const stillText = stillOpen ? (await page.locator('[role="menu"]').first().innerText()).slice(0, 80) : "";
check("the more menu can fit the canvas", stillOpen === 0, foundFit ? `left open: ${stillText}` : "no Fit row in the more menu");

/* the prompt sheet, opened from the top pill */
await tapCenter('button[title="Prompt"]');
await wait(600);
if (check("the prompt sheet opens", (await page.locator('button[aria-label="Close"]').count()) > 0)) {
  await shot("07b-prompt-sheet");
  const copyRow = await page.locator('button[role="button"], button').filter({ hasText: /Prompt|Copy/i }).count();
  check("the prompt sheet carries the prompt", copyRow > 0, `${copyRow} rows`);
  await closeSheet();
}

await tapCenter('button[title="Swipe setup"]');
await wait(450);
const hint = (await page.locator("text=/Swipe across a screen/i").count()) > 0;
check("swipe setup shows its hint", hint);
const edge = await page.locator('button[title^="Swipe to open"]').count();
check("swipe setup puts edge buttons on the screen", edge >= 2, `${edge} buttons`);
await shot("07-navmode");

const f0 = await page.locator("[data-screen]").first().boundingBox();
if (f0) {
  /* straight up through the middle column: at this zoom the four edge buttons leave little room
   * sideways, but the centre of the screen is clear of every one of them */
  const x0 = f0.x + f0.width / 2;
  const y0 = f0.y + f0.height * 0.55;
  const dy = -Math.min(60, f0.height * 0.18);
  await page.evaluate(() => { window.__ev.splice(0); });
  const ta = await page.evaluate(
    ([x, yy]) => {
      const el = document.elementFromPoint(x, yy);
      return `${el?.tagName} touch-action=${el ? getComputedStyle(el).touchAction : "-"}`;
    },
    [x0, y0],
  );
  await swipeAcross(x0, y0, 0, dy, 120);
  await wait(500);
  const raw = await page.evaluate(() => window.__ev.splice(0));
  const moves = raw.filter((s) => s === "move").length;
  const trail = raw.filter((s) => s !== "move").map((s) => s.replace(/\/part$|\/frame$|\/menu$|\/button$/, "")).join(", ");
  const sheet = (await page.locator('button[aria-label="Close"]').count()) > 0;
  await shot("08-swipe-attempt");
  if (check("swiping up a screen opens the link sheet", sheet, `from ${Math.round(x0)},${Math.round(y0)} over ${Math.round(dy)}px in 110ms | ${ta} | ${moves} moves | events ${trail.slice(0, 160)}`)) {
    await shot("08-swipe-sheet");
    const chip = page.locator("button", { hasText: new RegExp(frames[1]?.name || "screen", "i") }).last();
    if (await chip.count()) {
      const b = await chip.boundingBox();
      await tapAt(b.x + b.width / 2, b.y + b.height / 2);
      await wait(600);
    }
    const sw = (await doc()).frames?.[0]?.swipe || {};
    check("the swipe wrote Frame.swipe", Object.keys(sw).length > 0, JSON.stringify(sw));
    await closeSheet();
  }
}

/* 8b — the tap route to the same sheet: an edge button of the screen */
const edgeBtn = page.locator('button[title^="Swipe to open"]').first();
if (await edgeBtn.count()) {
  const b = await edgeBtn.boundingBox();
  await tapAt(b.x + b.width / 2, b.y + b.height / 2);
  await wait(550);
  const s2 = (await page.locator('button[aria-label="Close"]').count()) > 0;
  check("an edge button opens the link sheet", s2, (await edgeBtn.getAttribute("title")) || "");
  if (s2) {
    await shot("08b-swipe-sheet-edge");
    const chip = page.locator("button").filter({ hasText: /Screen 2|Home/ }).last();
    if (await chip.count()) {
      const cb = await chip.boundingBox();
      await tapAt(cb.x + cb.width / 2, cb.y + cb.height / 2);
      await wait(700);
    }
    const sw2 = (await doc()).frames?.[0]?.swipe || {};
    check("the edge button wrote Frame.swipe", Object.keys(sw2).length > 0, JSON.stringify(sw2));
    await closeSheet();
  }
}

/* 8c — a swipe that begins on an edge button is still a swipe, not a swallowed tap */
const lb = page.locator('button[title^="Swipe to open"]').first();
if (await lb.count()) {
  const b = await lb.boundingBox();
  await swipeAcross(b.x + b.width / 2, b.y + b.height / 2, 70, 0, 110);
  await wait(500);
  const s3 = (await page.locator('button[aria-label="Close"]').count()) > 0;
  check("a swipe starting on an edge button still counts", s3, `button at ${Math.round(b.x)},${Math.round(b.y)}`);
  if (s3) {
    await shot("08c-swipe-from-button");
    await closeSheet();
  }
}

/* 9 — preview runs from the dock */
await tapCenter('button[title="Preview"]');
await wait(1400);
const previewUp = (await page.locator('button[title="Close"]').count()) > 0;
check("preview opens from the dock", previewUp);
await shot("09-preview");
await page.keyboard.press("Escape");
await wait(600);

/* 10 — multi-select: tap to add, drag a marquee */
await tapCenter('button[title="Multi-select"]');
await wait(400);
const pbox = await page.locator("[data-node]").first().boundingBox();
if (pbox) {
  await tapAt(pbox.x + pbox.width / 2, pbox.y + pbox.height / 2);
  await wait(450);
}
const marquee = await page.evaluate(() => {
  const fr = document.querySelector("[data-frame]")?.getBoundingClientRect();
  if (!fr) return null;
  return { x: fr.left + 2, y: fr.bottom + 6 };
});
if (marquee) {
  await swipeAcross(marquee.x, marquee.y, 120, 120, 260);
  await wait(400);
}
check("multi-select keeps the chrome usable", (await page.locator('button[title="Multi-select"]').count()) > 0);
await shot("10-selectmode");

/* 11 — the toolbar's overflow menu */
await tapCenter('button[title="More"]');
await wait(450);
const moreRows = await page.locator('[role="menuitem"], [role="menu"] button').count();
check("the more menu opens", moreRows > 3, `${moreRows} rows`);
await shot("11-more-menu");
await page.keyboard.press("Escape");
await wait(400);

/* 12 — nothing scrolls sideways at any phone width */
for (const w of [360, 393, 412]) {
  await page.setViewportSize({ width: w, height: 852 });
  await wait(600);
  const o = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    bw: document.body.scrollWidth,
  }));
  const dock = await page.locator('button[title="Parts"]').boundingBox();
  const fits = !!dock && dock.x >= 0 && dock.x + dock.width <= o.cw + 1;
  check(`no sideways scroll at ${w}px`, o.sw <= o.cw + 1 && o.bw <= o.cw + 1, `${o.sw}/${o.cw}`);
  check(`the dock fits at ${w}px`, fits, dock ? `${Math.round(dock.x)}..${Math.round(dock.x + dock.width)}` : "no dock");
  await shot(`12-overflow-${w}`);
}

/* 13 — the desktop is untouched: no 44dp inflation, panels where they were */
const dctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "en-US" });
const desk = await dctx.newPage();
await desk.goto(BASE, { waitUntil: "load" });
await desk.waitForSelector('button[title="Undo"], button[aria-label="Undo"]', { timeout: 25000 });
await wait(900);
const deskCaps = await desk.evaluate(() => ({
  coarse: matchMedia("(pointer: coarse)").matches,
  dock: !!document.querySelector('button[title="Layers"]')?.closest("div") && !!document.querySelector('button[title="Choose screen"]'),
}));
const undoBox = await desk.locator('button[aria-label="Undo"]').first().boundingBox();
check("desktop reports a fine pointer", !deskCaps.coarse);
check("desktop keeps its side panels and zoom pill", !(await desk.locator('button[title="Parts"]').count()) || (await desk.locator('[data-node]').count()) > 0);
check("desktop icon buttons stay at their design size", !!undoBox && undoBox.height <= 40, undoBox ? `${Math.round(undoBox.width)}x${Math.round(undoBox.height)}` : "no undo button");
await desk.screenshot({ path: `${SHOTS}/13-desktop.png` });
const deskPart = await desk.locator("[data-node]").first().boundingBox();
if (deskPart) {
  await desk.mouse.click(deskPart.x + deskPart.width / 2, deskPart.y + deskPart.height / 2);
  await wait(700);
  await desk.screenshot({ path: `${SHOTS}/14-desktop-inspector.png` });
  check("desktop click still selects a part", (await desk.locator("#part-panel-design, #frame-panel-design").count()) > 0);
}
await desk.close();

check("the phone build logs no console errors", errors.length === 0, errors.slice(0, 3).join(" || "));
await browser.close();
const failed = results.filter((r) => r[0] === "FAIL");console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
