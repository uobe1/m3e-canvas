import { SwipeDir } from "./tokens";

/** A press must be held this long, without wandering, to count as a long-press.
 *  Android's native threshold is 500ms; we land a hair under it so the menu feels eager
 *  but a deliberate hold is still required. */
export const LONG_PRESS_MS = 480;
/** How far the finger may stray (CSS px, measured from the ORIGIN, never accumulated per
 *  move) before the hold becomes a drag and the long-press dies. */
export const LONG_PRESS_SLOP = 10;
/** Shortest travel that can be a swipe command (CSS px). */
export const SWIPE_MIN_TRAVEL = 28;
/** A swipe may lean at most this much off its main axis (perpendicular / along). */
export const SWIPE_MAX_OFFAXIS = 0.55;
/** Slower than this and it was a pan or a drag, not a swipe (CSS px / ms). */
export const SWIPE_MIN_VELOCITY = 0.3;
/** A swipe must also be a quick flick: no slower than this overall window (ms). */
export const SWIPE_MAX_DURATION = 420;

export type Pt = { x: number; y: number; t: number };

/** Where a press began: it decides which menu it opens and which subsystem may steal it. */
export type PressZone = "part" | "frame" | "blank" | "handle" | "chrome";

export type Press = {
  id: number;
  zone: PressZone;
  itemId: string | null;
  frameId: string | null;
  origin: Pt;
  last: Pt;
  /** wandered too far, a second finger landed, or another subsystem took over */
  canceled: boolean;
  /** the long-press was already reported; a release must not report it twice */
  fired: boolean;
};

export function beginPress(
  pointerId: number,
  zone: PressZone,
  at: Pt,
  ids: { itemId?: string | null; frameId?: string | null } = {},
): Press {
  return {
    id: pointerId,
    zone,
    itemId: ids.itemId ?? null,
    frameId: ids.frameId ?? null,
    origin: at,
    last: at,
    canceled: false,
    fired: false,
  };
}

export function movePress(p: Press, at: Pt): Press {
  const strayed = Math.hypot(at.x - p.origin.x, at.y - p.origin.y) > LONG_PRESS_SLOP;
  return { ...p, last: at, canceled: p.canceled || strayed };
}

export function cancelPress(p: Press): Press {
  return { ...p, canceled: true };
}

export function isPressDue(p: Press, now: number): boolean {
  return !p.canceled && !p.fired && now - p.origin.t >= LONG_PRESS_MS;
}

/** What a release means. "longPress" covers a timer that was starved of the main thread:
 *  the hold was long enough, so fire the menu on release instead of dropping it. */
export function endPress(p: Press, now: number): "longPress" | "tap" | "moved" | "none" {
  if (p.fired) return "none";
  if (p.canceled) return "moved";
  return isPressDue(p, now) ? "longPress" : "tap";
}

export function markPressFired(p: Press): Press {
  return { ...p, fired: true };
}

export type SwipeGuess = { dir: SwipeDir; along: number; off: number; velocity: number; duration: number };

/** These thresholds are deliberately stricter than Preview's in-screen swipe navigation
 *  (8px travel, 0.25 progress, 0.0012 velocity): there a finger commits a page it can see
 *  coming; here one loose swipe would silently rewrite navigation, and on a phone panning
 *  the canvas overlaps a horizontal swipe exactly -- only strong evidence tells them apart. */
export function classifySwipe(from: Pt, to: Pt): SwipeGuess | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const duration = to.t - from.t;
  if (duration <= 0 || duration > SWIPE_MAX_DURATION) return null;
  if (ax === ay) return null; // perfectly diagonal: no main axis to speak of
  const along = Math.max(ax, ay);
  const off = Math.min(ax, ay);
  if (along < SWIPE_MIN_TRAVEL) return null;
  if (off / along > SWIPE_MAX_OFFAXIS) return null;
  const dir: SwipeDir = ax > ay ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  return { dir, along, off, duration, velocity: along / duration };
}

export function isSwipeCommand(g: SwipeGuess | null): boolean {
  return !!g && g.velocity >= SWIPE_MIN_VELOCITY;
}

/** The single source of truth for who owns a one-finger touch. "none" means this function
 *  has no opinion: a mouse (or a stylus) keeps walking the desktop code paths untouched. */
export type Intent = "pan" | "drag" | "marquee" | "moveFrame" | "swipeNav" | "pinch" | "none";

export function resolveIntent(c: {
  pointerType: string;
  zone: PressZone;
  touches: number;
  selectMode: boolean;
  navMode: boolean;
}): Intent {
  if (c.pointerType !== "touch") return "none";
  if (c.touches >= 2) return "pinch";
  if (c.zone === "handle" || c.zone === "chrome") return "none";
  if (c.navMode) return c.zone === "blank" ? "pan" : "swipeNav";
  if (c.zone === "part") return "drag";
  if (c.zone === "frame") return c.selectMode ? "moveFrame" : "pan";
  return c.selectMode ? "marquee" : "pan";
}

export type Box = { left: number; top: number; width: number; height: number };
export type Size = { w: number; h: number };

/** Place a context menu under its anchor, flipping above when the bottom edge is near and
 *  clamping inside the viewport when either side is. */
export function menuPlacement(anchor: Box, viewport: Size, menu: Size): { left: number; top: number; placed: "below" | "above" | "fit" } {
  const MARGIN = 8;
  const GAP = 6;
  const left = Math.min(Math.max(anchor.left, MARGIN), Math.max(MARGIN, viewport.w - menu.w - MARGIN));
  const below = anchor.top + anchor.height + GAP;
  if (below + menu.h <= viewport.h - MARGIN) return { left, top: below, placed: "below" };
  const above = anchor.top - menu.h - GAP;
  if (above >= MARGIN) return { left, top: above, placed: "above" };
  return { left, top: MARGIN, placed: "fit" };
}
