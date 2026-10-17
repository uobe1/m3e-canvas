"use client";

/* The phone's bottom dock: the six things an author reaches for between taps of the canvas.
 * Six 44dp icons -- 320dp with its gaps -- is the most a 360dp screen can hold without the
 * row touching a thumb's blind corner; anything rarer lives in the toolbar's "more" menu. */

import { Palette } from "@/lib/tokens";
import { t, useLang } from "@/lib/i18n";
import { IconBtn } from "./ui";

export type DockSheet = "parts" | "layers" | "screens" | "prompt";

export function MobileDock({
  p,
  sheet,
  onSheet,
  navMode,
  onNavMode,
  selectMode,
  onSelectMode,
  onPreview,
}: {
  p: Palette;
  /** the sheet currently up, so its dock key reads as pressed */
  sheet: string | null;
  onSheet: (kind: DockSheet) => void;
  navMode: boolean;
  onNavMode: () => void;
  selectMode: boolean;
  onSelectMode: () => void;
  onPreview: () => void;
}) {
  const lang = useLang();
  const cell = 44;
  return (
    <div
      className="m3-chrome"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "calc(10px + var(--bottom-ui, 0px) + env(safe-area-inset-bottom))",
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 44,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: 8,
          borderRadius: 28,
          background: p.surfaceContainerLow,
          boxShadow: "0 2px 10px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)",
          pointerEvents: "auto",
          userSelect: "none",
        }}
      >
        <IconBtn icon="add_box" p={p} size={cell} on={sheet === "parts"} onClick={() => onSheet("parts")} title={t("parts", lang)} />
        <IconBtn icon="layers" p={p} size={cell} on={sheet === "layers"} onClick={() => onSheet("layers")} title={t("layers", lang)} />
        <IconBtn icon="smartphone" p={p} size={cell} on={sheet === "screens"} onClick={() => onSheet("screens")} title={t("screens", lang)} />
        <IconBtn icon="play_arrow" p={p} size={cell} fill onClick={onPreview} title={t("preview", lang)} />
        <IconBtn icon="alt_route" p={p} size={cell} on={navMode} onClick={onNavMode} title={t("navMode", lang)} />
        <IconBtn icon="select_all" p={p} size={cell} on={selectMode} onClick={onSelectMode} title={t("multiSelect", lang)} />
      </div>
    </div>
  );
}
