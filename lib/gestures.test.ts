import { describe, expect, it } from "vitest";

import {
  LONG_PRESS_MS,
  LONG_PRESS_SLOP,
  SWIPE_MIN_TRAVEL,
  beginPress,
  cancelPress,
  classifySwipe,
  endPress,
  isPressDue,
  isSwipeCommand,
  markPressFired,
  menuPlacement,
  movePress,
  resolveIntent,
  type Pt,
} from "./gestures";

const at = (x: number, y: number, t: number): Pt => ({ x, y, t });
const rest = (zone: "part" | "frame" | "blank" | "handle" | "chrome" = "part", t = 0) =>
  beginPress(1, zone, at(100, 100, t));

describe("long-press", () => {
  it("is due at exactly the threshold and not a millisecond before", () => {
    const p = rest();
    expect(isPressDue(p, LONG_PRESS_MS - 1)).toBe(false);
    expect(isPressDue(p, LONG_PRESS_MS)).toBe(true);
  });

  it("tolerates the slop exactly and dies one pixel past it", () => {
    const p = rest();
    expect(movePress(p, at(100 + LONG_PRESS_SLOP, 100, 100)).canceled).toBe(false);
    expect(movePress(p, at(100 + LONG_PRESS_SLOP + 0.01, 100, 100)).canceled).toBe(true);
  });

  it("measures distance from the origin, so a wandering path within the circle stays armed", () => {
    let p = rest();
    for (const step of [at(109, 100, 50), at(100, 109, 100), at(91, 100, 150)]) p = movePress(p, step);
    expect(p.canceled).toBe(false);
    expect(isPressDue(p, LONG_PRESS_MS)).toBe(true);
  });

  it("reports a quick release as a tap and a starved-timer hold as a long-press", () => {
    const p = rest();
    expect(endPress(p, 300)).toBe("tap");
    expect(endPress(p, 500)).toBe("longPress");
  });

  it("never reports twice, and never after a cancel", () => {
    const p = markPressFired(rest());
    expect(endPress(p, 600)).toBe("none");
    const q = cancelPress(rest());
    expect(isPressDue(q, 900)).toBe(false);
    expect(endPress(q, 900)).toBe("moved");
  });
});

describe("swipe", () => {
  it("classifies a quick horizontal flick", () => {
    const g = classifySwipe(at(0, 0, 0), at(60, 4, 120));
    expect(g).toMatchObject({ dir: "right", along: 60 });
    expect(isSwipeCommand(g)).toBe(true);
  });

  it("rejects the diagonal and the near-diagonal", () => {
    expect(classifySwipe(at(0, 0, 0), at(40, 40, 100))).toBeNull();
    expect(classifySwipe(at(0, 0, 0), at(50, 40, 100))).toBeNull(); // off ratio 0.8
  });

  it("needs the minimum travel, boundaries included", () => {
    expect(classifySwipe(at(0, 0, 0), at(SWIPE_MIN_TRAVEL - 1, 0, 100))).toBeNull();
    expect(classifySwipe(at(0, 0, 0), at(SWIPE_MIN_TRAVEL, 0, 100))).not.toBeNull();
  });

  it("gives up on slow drags: past the window there is no guess, inside it velocity rules", () => {
    expect(classifySwipe(at(0, 0, 0), at(100, 0, 500))).toBeNull();
    const slow = classifySwipe(at(0, 0, 0), at(40, 0, 380));
    expect(slow).not.toBeNull();
    expect(isSwipeCommand(slow)).toBe(false);
  });

  it("accepts a glide at exactly the command velocity and at exactly the off-axis limit", () => {
    expect(isSwipeCommand(classifySwipe(at(0, 0, 0), at(30, 0, 100)))).toBe(true); // 0.3 px/ms
    expect(classifySwipe(at(0, 0, 0), at(100, 55, 100))).not.toBeNull(); // ratio 0.55
  });

  it("reads direction from the finger, so a left swipe is a left swipe", () => {
    expect(classifySwipe(at(0, 0, 0), at(-60, -2, 100))?.dir).toBe("left");
    expect(classifySwipe(at(0, 0, 0), at(0, -60, 100))?.dir).toBe("up");
    expect(classifySwipe(at(0, 0, 0), at(2, 60, 100))?.dir).toBe("down");
  });
});

describe("resolveIntent", () => {
  const T = { pointerType: "touch", touches: 1, selectMode: false, navMode: false };
  it.each([
    ["blank", { ...T, zone: "blank" as const }],
    ["part", { ...T, zone: "part" as const }],
    ["frame", { ...T, zone: "frame" as const }],
  ])("a lone finger on %s is at least usable", (_zone, c) => {
    expect(["pan", "drag", "moveFrame", "marquee"].includes(resolveIntent(c))).toBe(true);
  });

  it("keeps today's behavior: blank pans, parts drag, frames pan until multi-select", () => {
    expect(resolveIntent({ ...T, zone: "blank" })).toBe("pan");
    expect(resolveIntent({ ...T, zone: "part" })).toBe("drag");
    expect(resolveIntent({ ...T, zone: "frame" })).toBe("pan");
  });

  it("multi-select turns blank into a marquee and frames into movers", () => {
    const s = { ...T, selectMode: true };
    expect(resolveIntent({ ...s, zone: "blank" })).toBe("marquee");
    expect(resolveIntent({ ...s, zone: "frame" })).toBe("moveFrame");
    expect(resolveIntent({ ...s, zone: "part" })).toBe("drag");
  });

  it("navigation mode hands everything but the blank canvas to the swipe", () => {
    const n = { ...T, navMode: true };
    expect(resolveIntent({ ...n, zone: "blank" })).toBe("pan");
    expect(resolveIntent({ ...n, zone: "part" })).toBe("swipeNav");
    expect(resolveIntent({ ...n, zone: "frame" })).toBe("swipeNav");
  });

  it("the second finger always wins the pinch", () => {
    expect(resolveIntent({ ...T, zone: "part", touches: 2 })).toBe("pinch");
    expect(resolveIntent({ ...T, zone: "blank", touches: 2 })).toBe("pinch");
  });

  it("handles, chrome and mice are none of its business", () => {
    expect(resolveIntent({ ...T, zone: "handle" })).toBe("none");
    expect(resolveIntent({ ...T, zone: "chrome" })).toBe("none");
    expect(resolveIntent({ ...T, zone: "part", pointerType: "mouse" })).toBe("none");
    expect(resolveIntent({ ...T, zone: "blank", pointerType: "mouse", touches: 0 })).toBe("none");
  });
});

describe("menuPlacement", () => {
  const menu = { w: 200, h: 260 };
  const screen = { w: 390, h: 700 };
  const anchor = (left: number, top: number) => ({ left, top, width: 44, height: 44 });

  it("prefers sitting under the anchor", () => {
    expect(menuPlacement(anchor(60, 100), screen, menu)).toEqual({ left: 60, top: 150, placed: "below" });
  });

  it("flips above near the bottom edge", () => {
    const p = menuPlacement(anchor(60, 600), screen, menu);
    expect(p.placed).toBe("above");
    expect(p.top).toBe(600 - 260 - 6);
  });

  it("clamps into the viewport at the left and right edges", () => {
    expect(menuPlacement(anchor(-20, 100), screen, menu).left).toBe(8);
    expect(menuPlacement(anchor(380, 100), screen, menu).left).toBe(390 - 200 - 8);
  });

  it("squeezes to the top when neither side has room", () => {
    const tight = menuPlacement(anchor(60, 120), screen, { w: 200, h: 690 });
    expect(tight).toEqual({ left: 60, top: 8, placed: "fit" });
  });
});
