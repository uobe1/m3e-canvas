---
name: run-m3e-canvas
description: Build, launch, and drive m3e-canvas (a Next.js browser canvas editor) — dev server, headless-Chromium phone and desktop verification, long-press/swipe/marquee gestures, screenshots, and the typecheck/test/build gates. Use when asked to run, start, screenshot, smoke-test, or verify this app.
---

# Run m3e-canvas

It is a static-export Next.js app (no backend): a dev server plus a browser.
The only way to really drive it is a headless Chromium with **touch** events,
so the harness is `scripts/mobile-check.mjs` — it opens the running app in an
iPhone-sized context, dispatches CDP touch for long-press / swipe / marquee,
asserts 44 checks, writes screenshots, and finishes with a desktop-context
regression pass. The dev server must be up first.

## Run (agent path)

**1. Check for a live server, and start one only if there is none:**

```bash
curl -sS -o /dev/null -w "http=%{http_code}\n" --max-time 5 http://localhost:3100/
```

If that fails, launch it **as a background task** (it never exits on its own):

```bash
cd /root/m3e-canvas && npm run dev -- -H 0.0.0.0 --port 3100 > /tmp/m3e-dev.log 2>&1
```

Wait for `✓ Ready in 3.5s` in the log. One server per project directory: a
second `next dev` prints `Another next dev server is already running`, names
the live `PID` and `.next/dev/logs/next-development.log`, and exits. A plain
trailing `&` in a one-shot shell is not reliable here — the process is gone by
the time the next command runs.

**2. Wait until it answers** — the first request after a code change can take
40s while Turbopack compiles, so warm it rather than racing it:

```bash
curl -sS -o /dev/null -w "http=%{http_code}\n" --max-time 90 http://localhost:3100/
```

**3. Drive it.** Needs a Chromium binary (see *Browser* below):

```bash
cd /root/m3e-canvas && CHROME=/root/pw-chromium/chrome-linux/chrome timeout 500 node scripts/mobile-check.mjs
```

Prints one `PASS`/`FAIL` line per check and `44/44 checks passed`; exits 1 on
any failure or crash. Env: `BASE` (default `http://localhost:3100`), `CHROME`
(default `/root/pw-chromium/chrome-linux/chrome`), `SHOTS` (default
`/tmp/shots`). **Look at the screenshots** — a green run with a broken layout
is still broken:

```bash
ls /tmp/shots
```

**4. Gates** (what CI runs):

```bash
cd /root/m3e-canvas && npm run typecheck && npm test && npm run build
```

`npm test` is ~30s, 814 tests. `npm run build` is ~70s and emits `out/`.

## Browser (one-time setup — do NOT use `npx playwright install`)

`@playwright/test` is a devDependency, but the browser download is unusable
here: the official CDN serves this machine at ~20KB/s (170MB ≈ 40+ min) and
rejects `Range`, so it cannot be parallelised or resumed. npmmirror serves the
same builds at ~10MB/s. Playwright's rev does not have to match — launch with
`executablePath`.

```bash
mkdir -p /root/pw-chromium && cd /root/pw-chromium
curl -sSL -o chromium.zip https://cdn.npmmirror.com/binaries/playwright/builds/chromium/1243/chromium-linux-arm64.zip
python3 -c "import zipfile,os,stat; z=zipfile.ZipFile('chromium.zip'); z.extractall('.'); [os.chmod(n,0o755) for n in z.namelist() if n.endswith('chrome')]"
/root/pw-chromium/chrome-linux/chrome --version   # Chromium 153.0.8010.12
```

There is no `unzip` on this box — hence python. To pick a newer revision, list
what the mirror carries and use the plain `chromium-linux-arm64.zip` name (the
`-debian13-` names the official installer wants are not mirrored):

```bash
curl -sS "https://registry.npmmirror.com/-/binary/playwright/builds/chromium/?format=json" | tail -c 200
```

## Human path

`npm run dev -- -H 0.0.0.0 --port 3100` and open http://localhost:3100 (bare
`npm run dev` picks 3000) — or, for a phone view, DevTools device emulation
(the layout switches at `(max-width: 840px)`; touch gestures need a real
touch-capable emulation, and long-press cannot be felt without one).

## Gotchas

- **A code change invalidates the page for ~40s** while Turbopack recompiles;
  Playwright's `goto` then times out at 30s. Warm with `curl` first.
- **CDP touch round-trips cost ~60–90ms per event.** A "110ms swipe" written
  with `await` between events really takes ~700ms, which is over the app's
  `SWIPE_MAX_DURATION` (420ms) and is read as a slow pan. The driver passes an
  explicit `timestamp` to `Input.dispatchTouchEvent` and keeps swipes to 4
  events — copy that, don't hand-roll a loop.
- **The phantom click.** A touch that ends over an element synthesises a
  `click`, so a long-press menu / swipe sheet can be opened and closed by the
  same finger. `ContextMenu` and `BottomSheet` guard it by only honouring
  clicks after they have seen a `pointerdown`. Tests must not "fix" this by
  tapping twice.
- **`data-frame` is a zero-size wrapper** (its children are absolutely
  positioned), so `getBoundingClientRect()` on it is useless for hit-testing.
  Use `[data-screen]` (the screen body) and `[data-node]` (a part).
- **A marquee must start on `.m3-canvas` itself.** The letterbox around the
  phone is a `<main>`, not the canvas; a drag begun there does nothing. The
  driver scans for a point where `elementFromPoint(...).closest(".m3-canvas")`
  is truthy and no frame/part covers it.
- **Swipe setup and multi-select fight over the same drag**: with swipe setup
  on, a blank-canvas drag is a pan, not a marquee (this is the arbitration
  table in `lib/gestures.ts`, not a bug). Turn it off before testing marquee.
- **Icon-font ligatures leak into `innerText`**: a menu row reads
  `"delete_sweepDelete"`. Match with `/Delete/`, never `/^Delete/`.
- **Process tools are crippled here**: `ps` dies with `无法获取系统启动时间`
  and `fuser` with `无法打开 /proc/net/tcp: 权限不够`, so a backgrounded server
  cannot be found by port. Launch it as a tracked background task, and get PIDs
  from Next's own "Another next dev server is already running … PID: N" line.
- **`lib/pickers.test.ts` has a ~1.4s timing test** that fails if you run
  `npm test` while the browser driver is competing for CPU. Re-run alone.
- Concurrent `npx playwright install` runs contend on
  `~/.cache/ms-playwright/__dirlock` and one dies with "An active lockfile is
  found" — remove that directory only when no installer is alive.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Another next dev server is already running` | Only one per directory. The message names the live PID — reuse that server (`curl` it), or `kill <PID>` and restart. |
| `page.goto: Timeout 30000ms exceeded` on localhost | Recompiling. `curl --max-time 90` the URL, then retry. |
| Chromium won't launch as root | Needs `--no-sandbox --disable-dev-shm-usage` (the driver passes both). |
| `Failed to install browsers … active lockfile` | Another installer holds `~/.cache/ms-playwright/__dirlock`; use the mirror + `CHROME=` instead. |
| Every check after the first failure also fails | The Next dev overlay (red "1 Issue" pill) is covering the viewport and eating taps — fix the console error it reports, don't add more waits. A React duplicate-`key` warning is enough to raise it. |
| `npm test` fails on a carousel timing test | Something else was using CPU. Re-run `npm test` alone. |

## Verify

Fresh shell: the four steps under *Run (agent path)*, in order, with no
improvisation. `44/44 checks passed` and three green gates is the target.
