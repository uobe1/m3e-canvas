"use client";

import { useEffect, useState } from "react";
import { motion, useDragControls } from "motion/react";
import { CONTRASTS, Contrast, FONTS, Item, KIND_SPEC, NavTab, PALETTES, Palette, SHAPES, ShapeScale, Theme, defaultTabsFor, iconSlotsOf, setIconSlot } from "@/lib/tokens";
import { ensureFontLoaded } from "@/lib/theme";
import { KIND_TEXT, LANGS, Lang, t, useLang } from "@/lib/i18n";
import { IconPicker } from "./IconPicker";
import { Icon } from "./M3Node";
import { VariantSwatch, variantsOf } from "./Inspector";
import { Field, IconBtn, Segmented, Toggle, useCoarse } from "./ui";

/** Sheet that slides up from the bottom edge; the canvas above stays usable.
 *  Dragging the handle moves the sheet with the finger; a flick or a long pull closes it. */
export function BottomSheet({ p, onClose, children }: { p: Palette; onClose: () => void; children: React.ReactNode }) {
  const lang = useLang();
  const coarse = useCoarse();
  const controls = useDragControls();
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.8 }}
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0 }}
      dragElastic={{ top: 0, bottom: 1 }}
      dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 90 || info.velocity.y > 600) onClose();
      }}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: "72%",
        display: "flex",
        flexDirection: "column",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        background: p.surfaceContainerLow,
        boxShadow: "0 -6px 24px rgba(0,0,0,0.16)",
        zIndex: 60,
        paddingBottom: "calc(var(--bottom-ui, 0px) + env(safe-area-inset-bottom))",
      }}
    >
      <button
        onClick={onClose}
        onPointerDown={(e) => controls.start(e)}
        aria-label={t("close", lang)}
        style={{
          height: coarse ? 44 : 30,
          border: "none",
          background: "transparent",
          display: "grid",
          placeItems: "center",
          cursor: "grab",
          flex: "0 0 auto",
          touchAction: "none",
        }}
      >
        <span style={{ width: 32, height: 4, borderRadius: 2, background: p.outlineVariant }} />
      </button>
      <div className="no-scrollbar" style={{ overflowY: "auto", padding: "0 14px 16px", minHeight: 0 }}>
        {children}
      </div>
    </motion.div>
  );
}

export function Row({ icon, label, p, children }: { icon: string; label: string; p: Palette; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
          color: p.onSurfaceVariant,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.4,
        }}
      >
        <Icon name={icon} size={16} />
        {label}
      </div>
      {children}
    </div>
  );
}

/** The language list, one row per language. */
export function MobileLang({ palette: p, lang, onLang }: { palette: Palette; lang: Lang; onLang: (l: Lang) => void }) {
  return (
    <Row icon="translate" label={t("language", lang)} p={p}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {LANGS.map((l) => {
          const on = l.key === lang;
          return (
            <button
              key={l.key}
              onClick={() => onLang(l.key)}
              aria-pressed={on}
              className="m3-press"
              style={{
                height: 52,
                padding: "0 16px 0 12px",
                borderRadius: 16,
                border: "none",
                background: on ? p.secondaryContainer : p.surfaceContainerHigh,
                color: on ? p.onSecondaryContainer : p.onSurface,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
                textAlign: "left",
              }}
            >
              <span style={{ width: 22, display: "inline-flex" }}>{on && <Icon name="check" size={22} />}</span>
              {l.label}
            </button>
          );
        })}
      </div>
    </Row>
  );
}

/** The theme sheet: palette, light / dark, shape, type and motion, sized for thumbs. */
export function MobileSettings({
  palette: p,
  paletteKey,
  onPalette,
  theme,
  onTheme,
}: {
  palette: Palette;
  paletteKey: string;
  onPalette: (key: string) => void;
  theme: Theme;
  onTheme: (patch: Partial<Theme>) => void;
}) {
  const lang = useLang();
  const shapeLabel = (k: ShapeScale) => (k === "square" ? t("shapeSquare", lang) : k === "full" ? t("shapeFull", lang) : t("shapeRounded", lang));
  return (
    <div>
      <Row icon="brightness_6" label={t("brightness", lang)} p={p}>
        <Segmented<"light" | "dark">
          options={[
            { key: "light", icon: "light_mode", label: t("light", lang) },
            { key: "dark", icon: "dark_mode", label: t("dark", lang) },
          ]}
          value={theme.dark ? "dark" : "light"}
          onChange={(k) => onTheme({ dark: k === "dark" })}
          p={p}
          height={44}
        />
        <div style={{ marginTop: 8 }}>
          <Toggle on={theme.bothModes} onChange={(bothModes) => onTheme({ bothModes })} p={p} icon="routine" label={t("bothModes", lang)} grow />
        </div>
      </Row>
      <Row icon="contrast" label={t("contrast", lang)} p={p}>
        <Segmented<Contrast>
          options={CONTRASTS.map((c) => ({ key: c.key, label: c.key === "high" ? t("contrastHigh", lang) : c.key === "medium" ? t("contrastMedium", lang) : t("contrastStandard", lang) }))}
          value={theme.contrast}
          onChange={(contrast) => onTheme({ contrast })}
          p={p}
          height={44}
        />
      </Row>
      <Row icon="palette" label={t("theme", lang)} p={p}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "2px 0" }}>
          {PALETTES.map((pal) => {
            const on = pal.key === paletteKey;
            return (
              <button
                key={pal.key}
                onClick={() => onPalette(pal.key)}
                title={pal.label}
                aria-label={pal.label}
                aria-pressed={on}
                className="m3-press"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  border: "none",
                  background: pal.primary,
                  color: pal.onPrimary,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  outline: on ? `3px solid ${p.onSurface}` : "3px solid transparent",
                  outlineOffset: 3,
                }}
              >
                {on && <Icon name="check" size={24} />}
              </button>
            );
          })}
        </div>
      </Row>
      <Row icon="rounded_corner" label={t("shape", lang)} p={p}>
        <Segmented<ShapeScale>
          options={SHAPES.map((s) => ({ key: s.key, icon: s.icon, label: shapeLabel(s.key) }))}
          value={theme.shape}
          onChange={(shape) => onTheme({ shape })}
          p={p}
          height={44}
        />
      </Row>
      <Row icon="text_fields" label={t("typography", lang)} p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {FONTS.map((f) => {
            const on = theme.font === f.key;
            ensureFontLoaded(f.key);
            return (
              <button
                key={f.key}
                onClick={() => onTheme({ font: f.key })}
                aria-pressed={on}
                className="m3-press"
                style={{
                  height: 48,
                  padding: "0 16px 0 12px",
                  borderRadius: 16,
                  border: "none",
                  background: on ? p.secondaryContainer : p.surfaceContainerHigh,
                  color: on ? p.onSecondaryContainer : p.onSurface,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                  fontFamily: f.family,
                }}
              >
                <span style={{ width: 22, display: "inline-flex" }}>{on && <Icon name="check" size={22} />}</span>
                {f.label}
              </button>
            );
          })}
          <div style={{ marginTop: 4 }}>
            <Toggle on={theme.emphasized} onChange={(emphasized) => onTheme({ emphasized })} p={p} icon="format_bold" label={t("emphasized", lang)} />
          </div>
        </div>
      </Row>
      <Row icon="animation" label={t("motion", lang)} p={p}>
        <Segmented<"standard" | "expressive">
          options={[
            { key: "standard", label: t("motionStandard", lang) },
            { key: "expressive", label: t("motionExpressive", lang) },
          ]}
          value={theme.motion}
          onChange={(motion) => onTheme({ motion })}
          p={p}
          height={44}
        />
      </Row>
    </div>
  );
}

/** Edit / duplicate / delete for the selected part, sized for thumbs. */
export function MobileActionBar({
  p,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  p: Palette;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const lang = useLang();
  return (
    <div
      style={{
        position: "absolute",
        left: 14,
        bottom: "calc(16px + var(--bottom-ui, 0px) + env(safe-area-inset-bottom))",
        display: "flex",
        gap: 4,
        padding: 6,
        borderRadius: 32,
        background: p.surface,
        boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
        zIndex: 46,
      }}
    >
      <button
        onClick={onEdit}
        className="m3-press"
        style={{
          height: 52,
          padding: "0 20px 0 16px",
          borderRadius: 26,
          border: "none",
          background: p.primary,
          color: p.onPrimary,
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon name="tune" size={22} />
        {t("edit", lang)}
      </button>
      <IconBtn icon="content_copy" p={p} size={52} title={t("duplicate", lang)} onClick={onDuplicate} />
      <IconBtn icon="delete" p={p} size={52} danger title={t("delete", lang)} onClick={onDelete} />
    </div>
  );
}
