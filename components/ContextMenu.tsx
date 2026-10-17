"use client";

/* The menu a held finger calls up: the desktop gets this from right-click and the keyboard,
 * the phone gets it from the long-press; the rows are decided by the Editor, this only hangs
 * the menu where the finger sat and takes it away again. */

import { useRef } from "react";
import { Palette } from "@/lib/tokens";
import { menuPlacement } from "@/lib/gestures";
import { Icon } from "./M3Node";

export type MenuRow = {
  key: string;
  icon: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
};

export function ContextMenu({
  p,
  x,
  y,
  rows,
  onClose,
}: {
  p: Palette;
  /** where the finger was held, in viewport px */
  x: number;
  y: number;
  rows: MenuRow[];
  onClose: () => void;
}) {
  const menuW = 240;
  const menuH = rows.length * 48 + 12;
  /* the finger that held long enough to open this menu lets go with a click of its own, and the
   * menu is placed right under it: only a touch that arrives after the menu is up may act. */
  const armed = useRef(false);
  const pos = menuPlacement(
    { left: x - 22, top: y - 22, width: 44, height: 44 },
    { w: window.innerWidth, h: window.innerHeight },
    { w: menuW, h: menuH },
  );
  return (
    <>
      <div
        aria-hidden
        onPointerDown={onClose}
        onContextMenu={(e) => e.preventDefault()}
        style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.32)" }}
      />
      <div
        role="menu"
        aria-orientation="vertical"
        onPointerDownCapture={() => {
          armed.current = true;
        }}
        onClickCapture={(e) => {
          if (armed.current) return;
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{
          position: "fixed",
          left: pos.left,
          top: pos.top,
          width: menuW,
          maxHeight: window.innerHeight - 16,
          overflowY: "auto",
          zIndex: 71,
          padding: 6,
          borderRadius: 20,
          background: p.surfaceContainerHigh,
          boxShadow: "0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10)",
        }}
      >
        {rows.map((r) => (
          <button
            key={r.key}
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              onClose();
              r.onClick();
            }}
            className="m3-press"
            style={{
              width: "100%",
              height: 48,
              padding: "0 12px",
              borderRadius: 12,
              border: "none",
              background: "transparent",
              color: r.danger ? p.error : p.onSurface,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
              textAlign: "left",
            }}
          >
            <Icon name={r.icon} size={22} />
            {r.label}
          </button>
        ))}
      </div>
    </>
  );
}
