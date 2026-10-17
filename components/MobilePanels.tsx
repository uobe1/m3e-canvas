"use client";

/* The phone's whole editor surface: every panel the desktop shows, laid out for thumbs.
 * The controls themselves are the same atoms the desktop panels use -- a row is a Row,
 * a style choice is a StyleRun -- so a field that exists on the canvas exists here too,
 * and the two never drift apart on *what* can be set, only on *where* it is set. */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Action,
  BUTTON_H_MAX,
  BUTTON_H_MIN,
  BUTTON_SIZES,
  CAROUSEL_HEIGHTS,
  CHIP_H_MAX,
  CHIP_H_MIN,
  CHIP_SIZES,
  CATEGORIES,
  DATE_LAYOUTS,
  DateLayout,
  Doc,
  FAB_H_MAX,
  FAB_H_MIN,
  FAB_KINDS,
  FAB_SIZES,
  Frame,
  FramePreset,
  Group,
  Item,
  KIND_ORDER,
  KIND_SPEC,
  LINK_TARGET,
  LOADING_SIZES,
  MENU_TARGET,
  NavTab,
  PALETTE_HIDDEN,
  PHONE_H,
  PHONE_W,
  SPLIT_MENU_SLOT,
  TRACK_DEFAULT,
  TRACK_MAX,
  TRACK_MIN,
  TOP_BAR_SIZES,
  TIME_LAYOUTS,
  RING_SIZES,
  TimeLayout,
  Variant,
  actionSlotsOf,
  barWidths,
  buttonHeightOf,
  carouselCardPatch,
  carouselCardsOf,
  carouselCountOf,
  chipHeightOf,
  dateLayoutOf,
  defaultTabsFor,
  extendedFabHeight,
  fabTypePatch,
  frameLengthOf,
  frameSizeOf,
  hasMenu,
  iconSlotsOf,
  isFab,
  isField,
  isPicture,
  isPhoneFrame,
  isProgress,
  maxRingThickness,
  menuPatch,
  progressThickness,
  setIconSlot,
  sizeOf,
  timeLayoutOf,
  toggleIcon,
  topBarHeightOf,
  type Category,
  type FabKind,
  type Kind,
  type Palette,
  type Place,
} from "@/lib/tokens";
import { maxFrameLength } from "@/lib/tidy";
import { popHistory } from "@/lib/ai";
import { buildPrompt, effectivePrompt, promptOptionsOf, PROMPT_OPTIONS, PROMPT_OPTION_TEXT, type PromptOption } from "@/lib/prompt";
import { KIND_TEXT, t, useLang } from "@/lib/i18n";
import { Icon } from "./M3Node";
import { IconPicker } from "./IconPicker";
import { CardStage } from "./CardStage";
import { LinkStage, TapStage } from "./TapStage";
import {
  AlignBox,
  AiIconBtn,
  CornerRows,
  EdgeCornerRows,
  EntryList,
  FillRun,
  IconRow,
  IconStrip,
  ListStyleRun,
  NoTriggerNote,
  NoteSection,
  PlaceFn,
  StyleRun,
  TriggerSection,
  WidthRows,
  WidthRun,
  actionOptionsOf,
  hasTrigger,
} from "./PartPanel";
import { ButtonRun, Field, IconBtn, ImageRow, NamedSizes, Segmented, Select, Slider, TidyButton, Tile, Toggle, type TidyState } from "./ui";
import { AiHooks, FrameSizePicker, variantsOf, VariantSwatch } from "./Inspector";
import { ScreenFillRun } from "./FramePanel";
import { CardStrip, CarouselLayoutPicker, ProgressTypePicker, ProgressValue, RailRows, SlotStrip, TextRows, TextSizeRows } from "./PartInspector";
import { FabTypeRow, StateMark, ToggleStage } from "./ButtonInspector";
import { Row } from "./Mobile";

/** the buttons and bars whose panel is the button's: they take a tap somewhere */
const isButtonish = (kind: Kind) =>
  kind === "button" || kind === "iconButton" || kind === "chip" || kind === "splitButton" || isFab(kind);

export function MobileHeaderRow({
  kindIcon,
  kindLabel,
  p,
  locked,
  onToggleLock,
  grouped,
  onGroup,
  onUngroup,
  onDuplicate,
  onDelete,
  onClose,
}: {
  kindIcon: string;
  kindLabel: string;
  p: Palette;
  locked?: boolean;
  onToggleLock?: () => void;
  grouped?: boolean;
  onGroup?: () => void;
  onUngroup?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
}) {
  const lang = useLang();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          background: p.secondaryContainer,
          color: p.onSecondaryContainer,
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
        }}
      >
        <Icon name={kindIcon} size={22} />
      </div>
      <span style={{ fontSize: 16, fontWeight: 700, color: p.onSurface, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kindLabel}</span>
      {onToggleLock && (
        <IconBtn icon={locked ? "lock" : "lock_open"} p={p} on={!!locked} onClick={onToggleLock} title={t(locked ? "unlock" : "lock", lang)} size={44} />
      )}
      {(onGroup || onUngroup) && (
        <IconBtn icon={grouped ? "ungroup" : "group_work"} p={p} onClick={grouped ? onUngroup : onGroup} title={t(grouped ? "ungroup" : "makeGroup", lang)} size={44} />
      )}
      {onDuplicate && <IconBtn icon="content_copy" p={p} onClick={onDuplicate} title={t("duplicate", lang)} size={44} />}
      {onDelete && <IconBtn icon="delete" p={p} danger onClick={onDelete} title={t("delete", lang)} size={44} />}
      {onClose && <IconBtn icon="check" p={p} on onClick={onClose} title={t("done", lang)} size={44} />}
    </div>
  );
}

/** the phone's part panel: every section the desktop's two inspectors hold, in one scroll */
export function MobileInspector({
  ai,
  item,
  palette: p,
  frames,
  frame,
  onChange,
  onDelete,
  onDuplicate,
  onClose,
  locked,
  onToggleLock,
  grouped,
  onGroup,
  onUngroup,
  onPlace,
  measured,
  selfRect,
  allFrames,
  onShowOn,
  onShowMenu,
  railStandalone = false,
}: {
  ai: AiHooks;
  item: Item;
  palette: Palette;
  /** the screens a tap can be sent to (empty on a desktop board, as on the desktop) */
  frames: Frame[];
  frame: Frame | null;
  onChange: (patch: Partial<Item>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
  locked?: boolean;
  onToggleLock?: () => void;
  grouped?: boolean;
  onGroup?: () => void;
  onUngroup?: () => void;
  onPlace?: PlaceFn;
  measured?: number;
  selfRect: { x: number; y: number; w: number; h: number } | null;
  allFrames: Frame[];
  onShowOn?: (on: boolean) => void;
  onShowMenu?: (open: boolean) => void;
  railStandalone?: boolean;
}) {
  const lang = useLang();
  const spec = KIND_SPEC[item.kind];
  const buttonish = isButtonish(item.kind);

  /* states both desktop inspectors keep, flattened into one sheet here */
  const [slotKey, setSlotKey] = useState<string>(iconSlotsOf(item)[0]?.key ?? "icon");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tabSlot, setTabSlot] = useState<number | null>(null);
  const [shownOn, setShownOnState] = useState(false);
  const [seg, setSeg] = useState<string>("main");
  const [slot, setSlot] = useState<string>("");
  const [picked, setCard] = useState(0);
  /* the canvas shows the "on" look / the open FAB menu only while this sheet asks --
   * held through refs so a parent handing over a fresh callback every render does not
   * tear the look down and put it back (the ButtonInspector's arrangement) */
  const showOn = useRef(onShowOn);
  showOn.current = onShowOn;
  const showMenu = useRef(onShowMenu);
  showMenu.current = onShowMenu;
  useEffect(() => {
    setSlotKey(iconSlotsOf(item)[0]?.key ?? "icon");
    setPickerOpen(false);
    setTabSlot(null);
    setShownOnState(false);
    showOn.current?.(false);
    setSeg("main");
    setSlot("");
    setCard(0);
  }, [item.id, item.kind, item.tabs?.length]);
  const setShownOn = (on: boolean) => {
    setShownOnState(on);
    onShowOn?.(on);
  };
  const menuShown = hasMenu(item) || (item.kind === "splitButton" && seg === SPLIT_MENU_SLOT);
  useEffect(() => {
    showMenu.current?.(menuShown);
    return () => showMenu.current?.(false);
  }, [menuShown]);

  const frameW = frame ? frameSizeOf(frame).w : PHONE_W;
  const frameH = frame ? frameSizeOf(frame).h : PHONE_H;

  /* ---------- button-family computations (mirrors ButtonInspector) ---------- */
  const isIcon = item.kind === "iconButton";
  const fab = isFab(item.kind);
  const chip = item.kind === "chip";
  const split = item.kind === "splitButton";
  const isMenu = hasMenu(item);
  const isExtended = item.kind === "extendedFab";
  const iconOnly = isIcon || item.kind === "fab";
  const isToggle = buttonish && !!item.toggle;
  const isLink = item.action?.to === LINK_TARGET;
  const setToggle = (patch: Partial<NonNullable<Item["toggle"]>>) => onChange({ toggle: { ...(item.toggle ?? {}), ...patch } });
  const actionValue = isToggle ? "toggle" : (item.action?.to ?? "none");
  const actionOptions = actionOptionsOf(item, frame, allFrames, lang);
  const step = (spec.size ?? spec.size2)?.step ?? 4;
  const width = item.size ?? measured ?? spec.w;
  const height = chip ? chipHeightOf(item) : isExtended ? extendedFabHeight(item) : item.kind === "fab" ? (item.size ?? KIND_SPEC.fab.w) : buttonHeightOf(item);
  const minW = Math.min(buttonHeightOf(item), width);
  const setHeight = (v: number) =>
    onChange(isIcon || item.kind === "fab" ? { size: v } : isExtended || chip || split ? { size2: v } : item.size && item.size < v ? { size2: v, size: v } : { size2: v });
  const pickAction = (k: string) => {
    if (k === MENU_TARGET) {
      onChange({ toggle: undefined, ...menuPatch(item, true) });
      return;
    }
    if (isMenu) onChange(menuPatch(item, false));
    if (k === "toggle") {
      onChange({ toggle: { variant: item.variant === "filled" ? "tonal" : "filled" }, action: undefined });
      return;
    }
    setShownOn(false);
    setPickerOpen(false);
    if (k === LINK_TARGET) {
      onChange({ toggle: undefined, action: { to: LINK_TARGET, transition: "none", url: item.action?.url } });
      return;
    }
    const transition = item.action && item.action.to !== LINK_TARGET ? item.action.transition : "slide";
    onChange({ toggle: undefined, action: k === "none" ? undefined : { to: k, transition } });
  };
  const segAction: Action | undefined = seg === "main" ? item.action : item.actions?.[SPLIT_MENU_SLOT];
  const setSegAction = (a: Action | undefined) => {
    if (seg === "main") {
      onChange({ action: a });
      return;
    }
    const actions = { ...(item.actions ?? {}) };
    if (a) actions[SPLIT_MENU_SLOT] = a;
    else delete actions[SPLIT_MENU_SLOT];
    onChange({ actions: Object.keys(actions).length ? actions : undefined });
  };
  const menuEditor = isMenu || (split && seg === SPLIT_MENU_SLOT);
  const pickSegAction = (k: string) => {
    if (k === "none") return setSegAction(undefined);
    if (k === LINK_TARGET) return setSegAction({ to: LINK_TARGET, transition: "none", url: segAction?.url });
    setSegAction({ to: k, transition: segAction && segAction.to !== LINK_TARGET ? segAction.transition : "slide" });
  };

  /* ---------- part computations (mirrors PartInspector) ---------- */
  const kind = item.kind;
  const bar = kind === "linearProgress";
  const { w: partW, h: partH } = sizeOf(item, measured ? { [item.id]: measured } : {});
  const slots = actionSlotsOf(item);
  const slotKeyNav = slots.some((s) => s.key === slot) ? slot : (slots[0]?.key ?? "");
  const card = kind === "carousel" ? Math.max(0, Math.min(picked, carouselCountOf(item) - 1)) : picked;
  const trailing = kind === "listItem" && item.switch ? (item.checked ? "toggle_on" : "toggle_off") : (item.icon2 ?? null);
  const iconSlots = iconSlotsOf(item).map((s) =>
    s.key === "icon2"
      ? { ...s, value: trailing ?? s.value }
      : s,
  );
  const pickIconPart = (key: string, icon: string | null) => {
    if (kind === "listItem" && key === "icon2") {
      if (icon === "toggle_on" || icon === "toggle_off") {
        onChange({ switch: true, checked: icon === "toggle_on", icon2: undefined });
        return;
      }
      onChange({ ...setIconSlot(item, key, icon), switch: undefined });
      return;
    }
    onChange(setIconSlot(item, key, icon));
  };
  const setTabCount = (n: number) => {
    const defaults = defaultTabsFor(item.kind);
    const next: NavTab[] = [];
    for (let i = 0; i < n; i++) next.push((item.tabs ?? [])[i] ? { ...item.tabs![i] } : { ...defaults[i % defaults.length] });
    onChange({ tabs: next, selected: item.selected !== undefined && item.selected >= n ? undefined : item.selected });
  };
  const isSelect = kind === "select";
  const tabsList: NavTab[] = item.tabs ?? [];

  const widthRows = (auto = false) => (
    <WidthRows value={buttonish ? width : partW} min={spec.size?.min ?? 40} max={spec.size?.max ?? PHONE_W} step={spec.size?.step ?? 4} frameW={frameW} onChange={(size) => onChange({ size })} p={p} auto={auto} />
  );
  const heightRow = (presets?: readonly { key: string; value: number }[]) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Slider icon="height" title={t("height", lang)} value={partH} min={spec.size2?.min ?? 24} max={Math.max(spec.size2?.max === PHONE_H ? frameH : (spec.size2?.max ?? PHONE_H), partH)} step={spec.size2?.step ?? 4} onChange={(size2) => onChange({ size2 })} p={p} />
      {presets && <NamedSizes steps={presets} value={partH} onChange={(size2) => onChange({ size2 })} p={p} label={t("height", lang)} />}
    </div>
  );

  /* ---------- icon row shared by both families ---------- */
  const buttonSlots = [...iconSlots];
  if (isToggle) buttonSlots.push({ key: "toggle", label: t("on", lang), value: toggleIcon(item) });
  const activeSlot = buttonSlots.find((s) => s.key === slotKey) ?? buttonSlots[0];

  return (
    <div>
      <MobileHeaderRow
        kindIcon={spec.paletteIcon}
        kindLabel={(KIND_TEXT[lang][item.kind]?.noun ?? spec.label) + (locked ? ` · ${t("lock", lang)}` : "")}
        p={p}
        locked={locked}
        onToggleLock={onToggleLock}
        grouped={grouped}
        onGroup={onGroup}
        onUngroup={onUngroup}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onClose={onClose}
      />

      {buttonish ? (
        <>
          {fab && (
            <Row icon="add_circle" label={t("partType", lang)} p={p}>
              <FabTypeRow value={item.kind as FabKind} onChange={(k) => onChange(fabTypePatch(item, k))} p={p} />
            </Row>
          )}

          <Row icon={iconOnly ? "insert_emoticon" : "short_text"} label={t(iconOnly || isToggle ? "icon" : "text", lang)} p={p}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {!iconOnly && (
                <Field value={item.label} onChange={(label) => onChange({ label })} placeholder={t("label", lang)} p={p} height={48} />
              )}
              {isToggle && !iconOnly && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <StateMark on p={p} title={t("onState", lang)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Field value={item.toggle?.label ?? ""} onChange={(label) => setToggle({ label: label || undefined })} placeholder={item.label || t("label", lang)} p={p} height={48} />
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {buttonSlots.map((s) => {
                  const on = s.key === activeSlot?.key && pickerOpen;
                  return (
                    <button
                      key={s.key}
                      onClick={() => {
                        setTabSlot(null);
                        setSlotKey(s.key);
                        setPickerOpen(!(on && pickerOpen));
                        setShownOn(s.key === "toggle");
                      }}
                      title={s.label}
                      className="m3-press"
                      style={{
                        height: 48,
                        minWidth: 48,
                        padding: buttonSlots.length > 1 ? "0 14px 0 10px" : 0,
                        borderRadius: 24,
                        border: "none",
                        background: on ? p.primary : p.surfaceContainerHigh,
                        color: on ? p.onPrimary : s.value ? p.onSurface : p.outline,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <Icon name={s.value ?? "block"} size={24} />
                      {buttonSlots.length > 1 && <span>{s.label}</span>}
                    </button>
                  );
                })}
                {activeSlot?.value && (
                  <button
                    onClick={() => {
                      if (activeSlot.key === "toggle") setToggle({ icon: null });
                      else if (activeSlot.key === "icon") onChange({ icon: null });
                      else onChange(setIconSlot(item, activeSlot.key, null));
                    }}
                    className="m3-press"
                    style={{ height: 48, padding: "0 14px 0 10px", borderRadius: 24, border: `1px solid ${p.outline}`, background: "transparent", color: p.onSurfaceVariant, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}
                  >
                    <Icon name="close" size={20} />
                    {t("noIcon", lang)}
                  </button>
                )}
              </div>
              {pickerOpen && activeSlot && (
                <div style={{ marginTop: 4 }}>
                  <IconPicker
                    value={activeSlot.value}
                    onChange={(icon) => {
                      if (activeSlot.key === "toggle") setToggle({ icon });
                      else if (activeSlot.key === "icon") onChange({ icon });
                      else onChange(setIconSlot(item, activeSlot.key, icon));
                    }}
                    onClose={() => setPickerOpen(false)}
                    palette={p}
                  />
                </div>
              )}
            </div>
          </Row>

          <Row icon="palette" label={t("style", lang)} p={p}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {isToggle ? (
                <>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <StateMark on={false} p={p} title={t("normalState", lang)} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <StyleRun kind={item.kind} value={item.variant} onChange={(variant) => onChange({ variant })} p={p} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <StateMark on p={p} title={t("onState", lang)} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <StyleRun kind={item.kind} value={item.toggle?.variant ?? item.variant} onChange={(variant) => setToggle({ variant })} p={p} />
                    </div>
                  </div>
                </>
              ) : (
                <StyleRun kind={item.kind} value={item.variant} onChange={(variant) => onChange({ variant })} p={p} />
              )}
              {chip && <Toggle on={!!item.checked} onChange={(checked) => onChange({ checked })} p={p} icon="check_circle" label={t("selected", lang)} grow />}
            </div>
          </Row>

          <Row icon="straighten" label={t("size", lang)} p={p}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {!isIcon && !fab && !chip && !split && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Slider icon="width" title={t("width", lang)} value={width} min={minW} max={frameW} step={step} onChange={(v) => onChange({ size: v })} p={p} />
                  <WidthRun value={item.size} onChange={(size) => onChange({ size })} frameW={frameW} p={p} />
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Slider
                  icon={isIcon || fab ? "open_in_full" : "height"}
                  title={t(isIcon || fab ? "size" : "height", lang)}
                  value={height}
                  min={chip ? CHIP_H_MIN : fab ? (isExtended ? KIND_SPEC.extendedFab.h : FAB_H_MIN) : BUTTON_H_MIN}
                  max={chip ? CHIP_H_MAX : fab ? FAB_H_MAX : BUTTON_H_MAX}
                  step={step}
                  onChange={setHeight}
                  p={p}
                />
                <NamedSizes
                  steps={chip ? CHIP_SIZES.map((c) => ({ key: c.key, value: c.h })) : fab ? FAB_SIZES.map((f) => ({ key: f.key, value: isExtended ? f.h : f.d })) : BUTTON_SIZES.map((b) => ({ key: b.key, value: b.h }))}
                  value={height}
                  onChange={setHeight}
                  p={p}
                  label={t(isIcon || fab ? "size" : "height", lang)}
                />
              </div>
            </div>
          </Row>
        </>
      ) : (
        <>
          {isProgress(kind) && (
            <Row icon="progress_activity" label={t("partType", lang)} p={p}>
              <ProgressTypePicker item={item} onChange={onChange} p={p} />
            </Row>
          )}

          {kind === "topAppBar" || kind === "searchBar" || kind === "listItem" ? (
            <Row icon="short_text" label={t("text", lang)} p={p}>
              <IconRow
                slots={iconSlots.map((s) => ({ key: s.key, value: s.value, title: s.label, extras: s.key === "icon2" && kind === "listItem" ? [{ icon: "toggle_off", title: t("switchOff", lang) }, { icon: "toggle_on", title: t("switchOn", lang) }] : undefined }))}
                onPick={pickIconPart}
                p={p}
              >
                <Field value={item.label} onChange={(label) => onChange({ label })} placeholder={t(kind === "searchBar" ? "placeholder" : kind === "topAppBar" ? "title" : "label", lang)} p={p} height={48} />
              </IconRow>
              {spec.hasSupporting && <div style={{ marginTop: 8 }}><Field value={item.supporting ?? ""} onChange={(supporting) => onChange({ supporting })} placeholder={t("supporting", lang)} p={p} height={48} /></div>}
            </Row>
          ) : kind === "dialog" || isField(kind) ? (
            <Row icon="short_text" label={t("text", lang)} p={p}>
              <IconRow slots={iconSlots.map((s) => ({ key: s.key, value: s.value, title: s.label }))} onPick={pickIconPart} p={p}>
                <Field value={item.label} onChange={(label) => onChange({ label })} placeholder={t(kind === "dialog" ? "title" : "label", lang)} p={p} height={48} />
              </IconRow>
              <div style={{ marginTop: 8 }}>
                <Field
                  value={item.supporting ?? ""}
                  onChange={(supporting) => onChange({ supporting })}
                  placeholder={t(kind === "dialog" ? "body" : "supporting", lang)}
                  p={p}
                  multiline={kind === "dialog"}
                  rows={kind === "dialog" ? 2 : undefined}
                  grow={kind === "dialog"}
                  maxHeight={140}
                />
              </div>
            </Row>
          ) : (
            (spec.hasLabel || spec.hasSupporting) && (
              <Row icon="title" label={t("text", lang)} p={p}>
                <TextRows
                  item={item}
                  onChange={onChange}
                  p={p}
                  labelKey={kind === "snackbar" ? "message" : kind === "card" ? "title" : "label"}
                  supportingKey={kind === "snackbar" ? "action" : kind === "card" ? "body" : "supporting"}
                  paragraph={kind === "card"}
                  bold={kind === "text"}
                />
              </Row>
            )
          )}

          {slots.length === 0 && iconSlots.filter((s) => !s.key.startsWith("tab:")).length > 0 && (
            <Row icon="emoji_symbols" label={t("icon", lang)} p={p}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {iconSlots
                  .filter((s) => !s.key.startsWith("tab:"))
                  .map((s) => {
                    const on = s.key === activeSlot?.key && pickerOpen;
                    return (
                      <button
                        key={s.key}
                        onClick={() => {
                          setSlotKey(s.key);
                          setPickerOpen(!(on && pickerOpen));
                        }}
                        title={s.label}
                        className="m3-press"
                        style={{ height: 48, minWidth: 48, padding: "0 14px 0 10px", borderRadius: 24, border: "none", background: on ? p.primary : p.surfaceContainerHigh, color: on ? p.onPrimary : s.value ? p.onSurface : p.outline, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 600 }}
                      >
                        <Icon name={s.value ?? "block"} size={24} />
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
              </div>
              {pickerOpen && activeSlot && (
                <div style={{ marginTop: 4 }}>
                  <IconPicker value={activeSlot.value} onChange={(icon) => pickIconPart(activeSlot.key, icon)} onClose={() => setPickerOpen(false)} palette={p} />
                </div>
              )}
            </Row>
          )}

          {(kind === "bottomNav" || kind === "navRail" || kind === "tabs" || kind === "select") && (
            <Row icon={kind === "select" ? "list" : "view_column"} label={t(kind === "select" ? "options" : "tabs", lang)} p={p}>
              <EntryList item={item} onChange={onChange} p={p} icons={kind !== "tabs" && kind !== "select"} selectable clearable={kind === "select"} />
            </Row>
          )}
          {kind === "toolbar" && (
            <Row icon="view_column" label={t("tabs", lang)} p={p}>
              <IconStrip item={item} onChange={onChange} p={p} />
            </Row>
          )}

          {kind === "card" && (
            <Row icon="image" label={t("cardLayout", lang)} p={p}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => onChange({ noImage: item.noImage ? undefined : true })}
                    title={t(item.noImage ? "image" : "noImageLayout", lang)}
                    aria-label={t("image", lang)}
                    aria-pressed={!item.noImage}
                    className="m3-press"
                    style={{ width: 44, height: 44, flex: "0 0 auto", borderRadius: 22, border: "none", padding: 0, background: item.noImage ? p.surfaceContainerHigh : p.secondaryContainer, color: item.noImage ? p.onSurfaceVariant : p.onSecondaryContainer, cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <Icon name={item.noImage ? "hide_image" : "image"} size={20} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <CardStage item={item} onChange={onChange} p={p} />
                  </div>
                </div>
                {!item.noImage && <ImageRow key={item.id} value={item.src} onChange={(src) => onChange({ src })} p={p} />}
              </div>
            </Row>
          )}
          {kind === "image" && (
            <Row icon="image" label={t("image", lang)} p={p}>
              <ImageRow key={item.id} value={item.src} onChange={(src) => onChange({ src })} p={p} />
            </Row>
          )}
          {kind === "carousel" && (
            <>
              <Row icon="view_carousel" label={t("layout", lang)} p={p}>
                <CarouselLayoutPicker item={item} onChange={onChange} p={p} />
              </Row>
              <Row icon="photo_library" label={t("cards", lang)} p={p}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Slider icon="view_column" title={t("cards", lang)} value={carouselCountOf(item)} min={2} max={8} step={1} onChange={(count) => onChange({ count })} p={p} />
                  <CardStrip item={item} selected={card} onSelect={setCard} p={p} />
                  <Field value={carouselCardsOf(item)[card]?.label ?? ""} onChange={(label) => onChange(carouselCardPatch(item, card, { label }))} placeholder={t("label", lang)} p={p} multiline rows={2} maxHeight={140} />
                  <ImageRow value={carouselCardsOf(item)[card]?.src} onChange={(src) => onChange(carouselCardPatch(item, card, { src }))} p={p} />
                </div>
              </Row>
            </>
          )}

          {kind === "datePicker" && (
            <Row icon="calendar_month" label={t("layout", lang)} p={p}>
              <Segmented<DateLayout>
                options={DATE_LAYOUTS.map((l) => ({ key: l.key, icon: l.icon, title: t(l.text, lang) }))}
                value={dateLayoutOf(item)}
                onChange={(layout) => onChange({ layout })}
                p={p}
                height={44}
              />
            </Row>
          )}
          {kind === "timePicker" && (
            <Row icon="schedule" label={t("layout", lang)} p={p}>
              <Segmented<TimeLayout>
                options={TIME_LAYOUTS.map((l) => ({ key: l.key, icon: l.icon, title: t(l.text, lang) }))}
                value={timeLayoutOf(item)}
                onChange={(layout) => onChange({ layout })}
                p={p}
                height={44}
              />
            </Row>
          )}

          {(kind === "card" || isField(kind) || kind === "toolbar" || kind === "searchBar") && (
            <Row icon="palette" label={t("style", lang)} p={p}>
              <StyleRun kind={kind} value={item.variant} onChange={(variant) => onChange({ variant })} p={p} />
            </Row>
          )}
          {kind === "listItem" && (
            <Row icon="palette" label={t("style", lang)} p={p}>
              <ListStyleRun item={item} onChange={onChange} p={p} />
            </Row>
          )}
          {(kind === "box" || kind === "bottomSheet") && (
            <Row icon="palette" label={t("style", lang)} p={p}>
              <FillRun value={item.fill ?? "surfaceContainerLow"} onChange={(fill) => onChange({ fill })} p={p} />
            </Row>
          )}
          {/* looks the button-family run carries but this panel drew through StyleRun only for buttons: any other part with variants keeps the swatch strip */}
          {!isButtonish(kind) && spec.hasVariant && kind !== "card" && !isField(kind) && kind !== "toolbar" && kind !== "searchBar" && kind !== "listItem" && kind !== "box" && kind !== "bottomSheet" && (
            <Row icon="palette" label={t("style", lang)} p={p}>
              <div className="no-scrollbar" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "3px 3px 6px" }}>
                {variantsOf(kind).map((v) => (
                  <VariantSwatch key={v.key} v={v.key as Variant} label={v.label} p={p} on={item.variant === v.key} onClick={() => onChange({ variant: v.key })} />
                ))}
              </div>
            </Row>
          )}

          {kind === "navRail" && (
            <Row icon="side_navigation" label={t("railState", lang)} p={p}>
              <RailRows item={item} onChange={onChange} p={p} standalone={railStandalone} />
            </Row>
          )}
          {kind === "loadingIndicator" && (
            <Row icon="tune" label={t("state", lang)} p={p}>
              <Toggle on={!!item.contained} onChange={(contained) => onChange({ contained })} p={p} icon="circle" label={t("container", lang)} grow />
            </Row>
          )}
          {isProgress(kind) && (
            <Row icon="tune" label={t("state", lang)} p={p}>
              <ProgressValue item={item} onChange={onChange} p={p} />
            </Row>
          )}
          {kind === "slider" && (
            <Row icon="tune" label={t("state", lang)} p={p}>
              <Slider icon="percent" title={t("progressState", lang)} value={item.value ?? 50} min={0} max={100} step={1} onChange={(value) => onChange({ value })} p={p} unit="%" />
            </Row>
          )}

          {kind === "text" && (
            <Row icon="straighten" label={t("size", lang)} p={p}>
              <TextSizeRows item={item} onChange={onChange} p={p} />
            </Row>
          )}
          {kind === "topAppBar" && (
            <Row icon="straighten" label={t("size", lang)} p={p}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {widthRows()}
                <NamedSizes steps={TOP_BAR_SIZES.map((b) => ({ key: b.key, value: b.h }))} value={topBarHeightOf(item)} onChange={(size2) => onChange({ size2 })} p={p} label={t("height", lang)} />
                <EdgeCornerRows item={item} onChange={onChange} p={p} />
              </div>
            </Row>
          )}
          {(kind === "bottomNav" || kind === "tabs") && (
            <Row icon="straighten" label={t("size", lang)} p={p}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {widthRows()}
                {kind === "bottomNav" && <EdgeCornerRows item={item} onChange={onChange} p={p} />}
              </div>
            </Row>
          )}
          {kind === "navRail" && (
            <Row icon="straighten" label={t("size", lang)} p={p}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {heightRow([
                  { key: "half", value: Math.round(frameH / 2) },
                  { key: "full", value: frameH },
                ])}
                <EdgeCornerRows item={item} onChange={onChange} p={p} />
              </div>
            </Row>
          )}
          {(kind === "searchBar" || kind === "listItem" || isField(kind) || kind === "divider") && (
            <Row icon="straighten" label={t("size", lang)} p={p}>
              {widthRows()}
            </Row>
          )}
          {kind === "switch" && (
            <Row icon="straighten" label={t("size", lang)} p={p}>
              {widthRows(true)}
            </Row>
          )}
          {kind === "card" && (
            <Row icon="straighten" label={t("size", lang)} p={p}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {widthRows()}
                {heightRow(spec.size2!.presets!.map((v) => ({ key: v === 120 ? "s" : v === 188 ? "m" : "l", value: v })))}
                <CornerRows item={item} onChange={onChange} p={p} />
              </div>
            </Row>
          )}
          {(kind === "box" || kind === "bottomSheet" || isPicture(kind)) && (
            <Row icon="straighten" label={t("size", lang)} p={p}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {heightRow(
                  kind === "box" || kind === "bottomSheet"
                    ? [
                        { key: "half", value: Math.round(frameH / 2) },
                        { key: "full", value: frameH },
                      ]
                    : undefined,
                )}
                {widthRows()}
                {(kind === "box" || kind === "image") && <CornerRows item={item} onChange={onChange} p={p} />}
                {kind === "bottomSheet" && (
                  <Slider icon="rounded_corner" title={t("cornerTop", lang)} value={item.radiusTop ?? 28} min={0} max={48} step={1} onChange={(radiusTop) => onChange({ radiusTop })} p={p} />
                )}
              </div>
            </Row>
          )}
          {kind === "carousel" && (
            <Row icon="straighten" label={t("size", lang)} p={p}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{heightRow(CAROUSEL_HEIGHTS)}</div>
            </Row>
          )}
          {(kind === "datePicker" || kind === "timePicker") && (
            <Row icon="straighten" label={t("size", lang)} p={p}>
              {widthRows()}
            </Row>
          )}
          {kind === "slider" && (
            <Row icon="straighten" label={t("size", lang)} p={p}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Slider icon="width" title={t("width", lang)} value={item.size ?? spec.w} min={Math.min(spec.size!.min, item.size ?? spec.w)} max={Math.max(frameW, spec.size!.max)} step={spec.size!.step} onChange={(size) => onChange({ size })} p={p} />
                <NamedSizes steps={barWidths(frameW)} value={item.size ?? spec.w} onChange={(size) => onChange({ size })} p={p} label={t("width", lang)} />
              </div>
            </Row>
          )}
          {kind === "loadingIndicator" && (
            <Row icon="straighten" label={t("size", lang)} p={p}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Slider icon="open_in_full" title={t("size", lang)} value={item.size ?? spec.w} min={spec.size!.min} max={spec.size!.max} step={spec.size!.step} onChange={(size) => onChange({ size })} p={p} />
                <NamedSizes steps={LOADING_SIZES} value={item.size ?? spec.w} onChange={(size) => onChange({ size })} p={p} />
              </div>
            </Row>
          )}
          {isProgress(kind) && (
            <Row icon="straighten" label={t("size", lang)} p={p}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <Slider
                  icon="line_weight"
                  title={t("trackThickness", lang)}
                  value={progressThickness(item)}
                  min={TRACK_MIN}
                  max={kind === "circularProgress" ? maxRingThickness(item.size ?? spec.w) : TRACK_MAX}
                  step={1}
                  onChange={(v) => onChange({ trackThickness: v === TRACK_DEFAULT ? undefined : v })}
                  p={p}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Slider
                    icon={bar ? "width" : "open_in_full"}
                    title={t(bar ? "width" : "size", lang)}
                    value={item.size ?? spec.w}
                    min={Math.min(spec.size!.min, item.size ?? spec.w)}
                    max={bar ? Math.max(frameW, spec.size!.max) : spec.size!.max}
                    step={spec.size!.step}
                    onChange={(size) => onChange({ size })}
                    p={p}
                  />
                  <NamedSizes steps={bar ? barWidths(frameW) : RING_SIZES} value={item.size ?? spec.w} onChange={(size) => onChange({ size })} p={p} />
                </div>
              </div>
            </Row>
          )}
        </>
      )}

      {onPlace && (
        <Row icon="grid_on" label={t("align", lang)} p={p}>
          <AlignBox key={item.id} onPlace={onPlace} p={p} />
        </Row>
      )}

      {/* navigation: what a tap -- or a tap on one of the part's places -- sends you to */}
      {buttonish && hasTrigger(kind) && (
        <Row icon="ads_click" label={t("tapTo", lang)} p={p}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {split && (
              <Segmented<string>
                options={[
                  { key: "main", icon: item.icon ?? undefined, label: item.icon ? undefined : item.label || t("splitMain", lang), title: t("splitMain", lang), dot: !!item.action },
                  { key: SPLIT_MENU_SLOT, icon: "keyboard_arrow_down", title: t("splitMenu", lang), dot: actionSlotsOf(item).some((sl) => !!item.actions?.[sl.key]) },
                ]}
                value={seg}
                onChange={setSeg}
                p={p}
                height={44}
              />
            )}
            {!(split && seg === SPLIT_MENU_SLOT) && (
              <Select
                options={actionOptions}
                value={split ? (segAction?.to ?? "none") : isMenu ? MENU_TARGET : actionValue}
                onChange={split ? pickSegAction : pickAction}
                p={p}
                label={t("tapTo", lang)}
              />
            )}
            {menuEditor && (
              <>
                <EntryList item={item} onChange={onChange} p={p} />
                {actionSlotsOf(item).length > 0 && (
                  <>
                    <Segmented<string>
                      options={actionSlotsOf(item).map((sl) => ({ key: sl.key, icon: sl.value ?? undefined, label: sl.value ? undefined : sl.label, title: sl.label, dot: !!item.actions?.[sl.key] }))}
                      value={slotKeyNav}
                      onChange={setSlot}
                      p={p}
                      height={44}
                    />
                    <Select
                      options={actionOptions.filter((o) => o.key !== "toggle")}
                      value={item.actions?.[slotKeyNav]?.to ?? "none"}
                      onChange={(k) => {
                        const actions = { ...(item.actions ?? {}) };
                        if (k === "none") delete actions[slotKeyNav];
                        else actions[slotKeyNav] = { to: k, transition: k === LINK_TARGET ? "none" : (actions[slotKeyNav]?.transition ?? "slide"), url: actions[slotKeyNav]?.url };
                        onChange({ actions: Object.keys(actions).length ? actions : undefined });
                      }}
                      p={p}
                      label={t("tapTo", lang)}
                    />
                  </>
                )}
              </>
            )}
            {split && seg === "main" ? (
              segAction?.to === LINK_TARGET ? (
                <LinkStage self={frame} selfRect={selfRect} action={segAction} onChange={setSegAction} p={p} />
              ) : (
                <TapStage frames={allFrames} self={frame} selfRect={selfRect} action={segAction} onChange={setSegAction} p={p} />
              )
            ) : menuEditor ? (
              actionSlotsOf(item).length === 0 ? null : (
                <TapStage
                  frames={allFrames}
                  self={frame}
                  selfRect={selfRect}
                  action={item.actions?.[slotKeyNav]}
                  onChange={(a) => {
                    const actions = { ...(item.actions ?? {}) };
                    if (a) actions[slotKeyNav] = a;
                    else delete actions[slotKeyNav];
                    onChange({ actions: Object.keys(actions).length ? actions : undefined });
                  }}
                  p={p}
                />
              )
            ) : isToggle ? (
              <>
                <ToggleStage item={item} shownOn={shownOn} onPick={setShownOn} p={p} measured={measured} />
                <div style={{ fontSize: 12, lineHeight: 1.5, color: p.onSurfaceVariant, padding: "0 4px" }}>{t("toggleLookHint", lang)}</div>
              </>
            ) : isLink ? (
              <LinkStage self={frame} selfRect={selfRect} action={item.action} onChange={(action) => onChange({ action })} p={p} />
            ) : (
              <TapStage frames={allFrames} self={frame} selfRect={selfRect} action={item.action} onChange={(action) => onChange({ action })} p={p} />
            )}
          </div>
        </Row>
      )}
      {!buttonish && (kind === "carousel" ? true : slots.length > 0 || hasTrigger(kind)) && (
        <div>
          {kind === "carousel" ? (
            <TriggerSection item={item} frame={frame} allFrames={allFrames} selfRect={selfRect} onChange={onChange} p={p} slot={`tab:${card}`} head={<CardStrip item={item} selected={card} onSelect={setCard} p={p} />} />
          ) : slots.length > 0 ? (
            <TriggerSection item={item} frame={frame} allFrames={allFrames} selfRect={selfRect} onChange={onChange} p={p} slot={slotKeyNav} head={<SlotStrip item={item} selected={slotKeyNav} onSelect={setSlot} p={p} />} />
          ) : hasTrigger(kind) ? (
            <TriggerSection item={item} frame={frame} allFrames={allFrames} selfRect={selfRect} onChange={onChange} p={p} />
          ) : (
            <NoTriggerNote p={p} />
          )}
        </div>
      )}

      <NoteSection item={item} ai={ai} onChange={onChange} p={p} />
    </div>
  );
}

/** several parts at once: line them up, make or break a group, or get rid of them */
export function MobileMultiPanel({
  p,
  count,
  grouped,
  locked,
  onToggleLock,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  onPlace,
  onClose,
}: {
  p: Palette;
  count: number;
  grouped: boolean;
  locked: boolean;
  onToggleLock?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onPlace?: PlaceFn;
  onClose: () => void;
}) {
  const lang = useLang();
  const toggle = grouped ? onUngroup : onGroup;
  return (
    <div>
      <MobileHeaderRow
        kindIcon={grouped ? "group_work" : "select_all"}
        kindLabel={grouped ? t("group", lang) : lang === "en" ? `${count} ${t("selectedParts", lang)}` : `${count}${t("selectedParts", lang)}`}
        p={p}
        locked={locked}
        onToggleLock={onToggleLock}
        grouped={grouped}
        onGroup={onGroup}
        onUngroup={onUngroup}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onClose={onClose}
      />
      {onPlace && (
        <Row icon="grid_on" label={t("align", lang)} p={p}>
          <AlignBox onPlace={onPlace} p={p} />
        </Row>
      )}
      {toggle && (
        <button
          onClick={toggle}
          className="m3-press"
          style={{ height: 48, width: "100%", borderRadius: 24, border: "none", background: p.secondaryContainer, color: p.onSecondaryContainer, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}
        >
          <Icon name={grouped ? "ungroup" : "group_work"} size={22} />
          {t(grouped ? "ungroup" : "makeGroup", lang)}
        </button>
      )}
      <div style={{ fontSize: 12, lineHeight: 1.5, color: p.onSurfaceVariant, padding: "0 4px", textWrap: "pretty" }}>{t(grouped ? "groupEditNote" : "groupHint", lang)}</div>
    </div>
  );
}

/** the parts you can drop: search, favorites and the categories -- tapped, not dragged */
export function MobilePartsSheet({
  p,
  favorites,
  onToggleFavorite,
  onAdd,
}: {
  p: Palette;
  favorites: Kind[];
  onToggleFavorite: (k: Kind) => void;
  onAdd: (k: Kind) => void;
}) {
  const lang = useLang();
  const [q, setQ] = useState("");
  const labelOf = (k: Kind) => (lang === "en" ? KIND_SPEC[k].label : (KIND_TEXT[lang][k]?.noun ?? KIND_SPEC[k].label));
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const listed = KIND_ORDER.filter((k) => !PALETTE_HIDDEN.includes(k));
    if (!s) return listed;
    return listed.filter((k) => {
      const sp = KIND_SPEC[k];
      return labelOf(k).toLowerCase().includes(s) || sp.label.toLowerCase().includes(s) || sp.noun.toLowerCase().includes(s) || k.toLowerCase().includes(s);
    });
  }, [q, lang]);
  const tile = (k: Kind) => {
    const s = KIND_SPEC[k];
    return (
      <Tile key={k} icon={s.paletteIcon} label={labelOf(k)} p={p} onClick={() => onAdd(k)} starred={favorites.includes(k)} onStar={() => onToggleFavorite(k)} />
    );
  };
  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(78px, 1fr))", gap: 6 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Field value={q} onChange={setQ} placeholder={t("search", lang)} p={p} icon="search" height={44} />
      {!q && favorites.length > 0 && (
        <Row icon="star" label={t("favorites", lang)} p={p}>
          <div style={grid}>{favorites.filter((k) => KIND_SPEC[k] && !PALETTE_HIDDEN.includes(k)).map(tile)}</div>
        </Row>
      )}
      {q ? (
        <div style={grid}>
          {filtered.map(tile)}
          {filtered.length === 0 && (
            <div role="status" style={{ gridColumn: "1 / -1", color: p.outline, fontSize: 13, padding: 12, textAlign: "center", display: "grid", placeItems: "center", gap: 6 }}>
              <Icon name="search_off" size={28} />
              <span>{t("noMatch", lang)}</span>
            </div>
          )}
        </div>
      ) : (
        CATEGORIES.map((c) => (
          <Row key={c.key} icon={c.icon} label={lang === "en" ? c.label : CATEGORY_TEXT[lang][c.key as Category]} p={p}>
            <div style={grid}>{KIND_ORDER.filter((k) => KIND_SPEC[k].category === c.key && !PALETTE_HIDDEN.includes(k)).map(tile)}</div>
          </Row>
        ))
      )}
    </div>
  );
}

/** every screen, front tap to select; preview, copy and delete ride on the row */
export function MobileScreensSheet({
  p,
  frames,
  currentId,
  onSelect,
  onAdd,
  onPreview,
  onDuplicate,
  onDelete,
}: {
  p: Palette;
  frames: Frame[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onPreview: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const lang = useLang();
  return (
    <div>
      <Row icon="smartphone" label={t("screens", lang)} p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {frames.map((f) => {
            const on = f.id === currentId;
            return (
              <div key={f.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                  onClick={() => onSelect(f.id)}
                  aria-pressed={on}
                  className="m3-press"
                  style={{ flex: 1, minWidth: 0, height: 48, padding: "0 14px", borderRadius: 16, border: "none", background: on ? p.secondaryContainer : p.surfaceContainerHigh, color: on ? p.onSecondaryContainer : p.onSurface, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}
                >
                  <Icon name={isPhoneFrame(f) ? "smartphone" : "desktop_windows"} size={20} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{f.name || t("screen", lang)}</span>
                </button>
                <IconBtn icon="play_arrow" p={p} size={44} onClick={() => onPreview(f.id)} title={t("previewFrom", lang)} fill />
                <IconBtn icon="content_copy" p={p} size={44} onClick={() => onDuplicate(f.id)} title={t("duplicate", lang)} />
                <IconBtn icon="delete" p={p} size={44} danger onClick={() => onDelete(f.id)} title={t("delete", lang)} />
              </div>
            );
          })}
          <button
            onClick={onAdd}
            className="m3-press"
            style={{ height: 48, width: "100%", borderRadius: 24, border: `1px dashed ${p.outline}`, background: "transparent", color: p.primary, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Icon name="add" size={20} />
            {t("addScreen", lang)}
          </button>
        </div>
      </Row>
    </div>
  );
}

/** the layers of one screen: front first, with lock and the two moves that need no drag */
export function MobileLayersSheet({
  p,
  groups,
  widths,
  selectedIds,
  onSelect,
  onToggleLock,
  onReorder,
}: {
  p: Palette;
  /** the runs on the chosen screen, canvas order (bottom first), as the desktop panel takes them */
  groups: Group[];
  widths: Record<string, number>;
  selectedIds: string[];
  onSelect: (itemIds: string[]) => void;
  onToggleLock: (groupId: string) => void;
  onReorder: (topFirst: string[]) => void;
}) {
  const lang = useLang();
  const topFirst = useMemo(() => [...groups].reverse(), [groups]);
  const sel = new Set(selectedIds);
  const move = (id: string, dir: -1 | 1) => {
    const ids = topFirst.map((g) => g.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    next.splice(i, 1);
    next.splice(j, 0, id);
    onReorder(next);
  };
  return (
    <div>
      <Row icon="layers" label={t("layers", lang)} p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {topFirst.length === 0 && (
            <div role="status" style={{ color: p.outline, fontSize: 13, padding: 12, textAlign: "center" }}>{t("nothingHere", lang)}</div>
          )}
          {topFirst.map((g, i) => {
            const on = g.items.some((it) => sel.has(it.id));
            const first = g.items[0];
            return (
              <div key={g.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                  onClick={() => onSelect(g.items.map((it) => it.id))}
                  aria-pressed={on}
                  className="m3-press"
                  style={{ flex: 1, minWidth: 0, height: 48, padding: "0 14px", borderRadius: 16, border: "none", background: on ? p.secondaryContainer : p.surfaceContainerHigh, color: on ? p.onSecondaryContainer : p.onSurface, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}
                >
                  <Icon name={first ? KIND_SPEC[first.kind].paletteIcon : "view_array"} size={20} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {first ? (KIND_TEXT[lang][first.kind]?.noun ?? KIND_SPEC[first.kind].label) : g.id}
                  </span>
                  {g.items.length > 1 && <span style={{ color: p.onSurfaceVariant, fontSize: 12 }}>{g.items.length}</span>}
                </button>
                <IconBtn icon="arrow_upward" p={p} size={44} disabled={i === 0} onClick={() => move(g.id, -1)} title={t("bringFront", lang)} />
                <IconBtn icon="arrow_downward" p={p} size={44} disabled={i === topFirst.length - 1} onClick={() => move(g.id, 1)} title={t("sendBack", lang)} />
                <IconBtn icon={g.locked ? "lock" : "lock_open"} p={p} size={44} on={!!g.locked} onClick={() => onToggleLock(g.id)} title={t(g.locked ? "unlock" : "lock", lang)} />
              </div>
            );
          })}
        </div>
      </Row>
    </div>
  );
}

/** one screen's own editor, thumb-sized: name, colour, length, tidy, description, export */
export function MobileFrameEditor({
  frame,
  palette: p,
  onChange,
  onDelete,
  onDuplicate,
  onPreview,
  prompt,
  onSaveImage,
  tidy,
  onTidy,
  onPlace,
  minLength,
  onLength,
  ai,
  onSize,
  onClose,
}: {
  frame: Frame;
  palette: Palette;
  onChange: (patch: Partial<Frame>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPreview: () => void;
  prompt: string;
  onSaveImage: () => Promise<void>;
  tidy: TidyState;
  onTidy: () => void;
  onPlace: (place: Place) => void;
  minLength: number;
  onLength: (length: number) => void;
  ai: AiHooks;
  onSize: (preset: FramePreset) => void;
  onClose: () => void;
}) {
  const lang = useLang();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(id);
  }, [copied]);
  const actionBtn = (icon: string, label: string, onClick: () => void, busy?: boolean) => (
    <button
      onClick={onClick}
      disabled={busy}
      className="m3-press"
      style={{ flex: 1, height: 48, borderRadius: 24, border: "none", background: p.secondaryContainer, color: p.onSecondaryContainer, fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.6 : 1 }}
    >
      <Icon name={icon} size={20} />
      {label}
    </button>
  );
  return (
    <div>
      <MobileHeaderRow
        kindIcon={isPhoneFrame(frame) ? "smartphone" : "desktop_windows"}
        kindLabel={frame.name || t("screen", lang)}
        p={p}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onClose={onClose}
      />
      <Row icon="label" label={t("name", lang)} p={p}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FrameSizePicker frame={frame} palette={p} onChange={onSize} compact />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Field value={frame.name} onChange={(name) => onChange({ name })} placeholder={t("screenName", lang)} p={p} height={48} />
          </div>
        </div>
      </Row>
      <Row icon="palette" label={t("style", lang)} p={p}>
        <ScreenFillRun value={frame.bg ?? "surface"} onChange={(bg) => onChange({ bg })} p={p} />
      </Row>
      <Row icon="swap_vert" label={t("scrolling", lang)} p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Slider icon="height" title={t("screenLength", lang)} value={frameLengthOf(frame)} min={minLength} max={maxFrameLength(frame)} step={4} onChange={onLength} p={p} />
          <NamedSizes steps={LENGTH_STEPS(frameSizeOf(frame).h)} value={frameLengthOf(frame)} onChange={onLength} p={p} label={t("screenLength", lang)} />
        </div>
      </Row>
      <Row icon="align_space_even" label={t("tidy", lang)} p={p}>
        <TidyButton state={tidy} onClick={onTidy} p={p} place={frame.place} onPlace={onPlace} />
      </Row>
      <Row icon="notes" label={t("description", lang)} p={p}>
        <Field
          value={frame.note ?? ""}
          onChange={(note) => onChange({ note: note || undefined })}
          placeholder={t("screenDescription", lang)}
          p={p}
          multiline
          grow
          rows={4}
          maxHeight={280}
          aiBusy={ai.busy}
          action={
            <>
              <AiIconBtn ai={ai} p={p} />
              {!!frame.noteHistory?.length && (
                <IconBtn icon="undo" p={p} size={40} on onClick={() => onChange(popHistory(frame.note, frame.noteHistory, "note", "noteHistory"))} title={t("aiRestore", lang)} />
              )}
            </>
          }
        />
      </Row>
      <Row icon="ios_share" label={t("export", lang)} p={p}>
        <div style={{ display: "flex", gap: 8 }}>
          {actionBtn(copied ? "check" : "content_copy", copied ? t("copied", lang) : t("prompt", lang), async () => {
            try {
              await navigator.clipboard.writeText(prompt);
              setCopied(true);
            } catch {}
          })}
          {actionBtn("image", saving ? t("saving", lang) : t("saveImage", lang), async () => {
            setSaving(true);
            try {
              await onSaveImage();
            } finally {
              setSaving(false);
            }
          }, saving)}
        </div>
      </Row>
      <button
        onClick={onPreview}
        className="m3-press"
        style={{ height: 52, width: "100%", borderRadius: 26, border: "none", background: p.primary, color: p.onPrimary, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}
      >
        <Icon name="play_arrow" size={22} />
        {t("previewFrom", lang)}
      </button>
    </div>
  );
}

const LENGTH_STEPS = (deviceH: number) =>
  [1, 1.5, 2, 3].map((n) => ({ key: `${n}×`, value: n === 1 ? deviceH : Math.round((deviceH * n) / 4) * 4 }));

/** the prompt this canvas turns into: read it, tweak the wording, copy it, leave */
export function MobilePromptSheet({
  doc,
  widths,
  p,
  onPatch,
  onClose,
}: {
  doc: Doc;
  widths: Record<string, number>;
  p: Palette;
  onPatch: (patch: { title?: string; brief?: string; promptEdit?: string; promptOptions?: PromptOption[]; platform?: "android" | "web" | null }) => void;
  onClose: () => void;
}) {
  const lang = useLang();
  const text = effectivePrompt(doc, widths, lang);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(id);
  }, [copied]);
  const options = promptOptionsOf(doc);
  const full = buildPrompt(doc, widths, undefined, lang);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 20, background: p.secondaryContainer, color: p.onSecondaryContainer, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
          <Icon name="auto_awesome" size={22} />
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: p.onSurface, flex: 1 }}>{t("prompt", lang)}</span>
        {!!doc.promptEdit && (
          <IconBtn icon="undo" p={p} size={44} onClick={() => onPatch({ promptEdit: undefined })} title={t("promptReset", lang)} />
        )}
        <IconBtn icon={editing ? "check" : "edit"} p={p} size={44} on={editing} onClick={() => setEditing((e) => !e)} title={editing ? t("done", lang) : t("edit", lang)} />
        <IconBtn icon="close" p={p} size={44} onClick={onClose} title={t("close", lang)} />
      </div>
      <Row icon="title" label={t("appName", lang)} p={p}>
        <Field value={doc.title} onChange={(title) => onPatch({ title })} placeholder={t("appName", lang)} p={p} height={48} />
      </Row>
      <Row icon="notes" label={t("brief", lang)} p={p}>
        <Field value={doc.brief} onChange={(brief) => onPatch({ brief })} placeholder={t("brief", lang)} p={p} multiline rows={2} grow maxHeight={140} />
      </Row>
      <Row icon="phone_android" label={t("targetPlatform", lang)} p={p}>
        <Segmented<"android" | "web">
          options={[
            { key: "android", icon: "android", label: "Android" },
            { key: "web", icon: "language", label: "Web" },
          ]}
          value={doc.platform ?? "android"}
          onChange={(k) => onPatch({ platform: k })}
          p={p}
          height={44}
          grow
        />
      </Row>
      <Row icon="tune" label={t("options", lang)} p={p}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {PROMPT_OPTIONS.map((k) => (
            <Toggle
              key={k}
              on={options.includes(k)}
              onChange={() =>
                onPatch({
                  promptOptions: (options.includes(k) ? options.filter((x) => x !== k) : [...options, k]) as PromptOption[],
                })
              }
              p={p}
              icon={PROMPT_OPTION_TEXT[lang][k].icon}
              label={PROMPT_OPTION_TEXT[lang][k].label}
              grow
            />
          ))}
        </div>
      </Row>
      <Row icon="description" label={t("prompt", lang)} p={p}>
        {editing ? (
          <Field value={doc.promptEdit ?? ""} onChange={(promptEdit) => onPatch({ promptEdit: promptEdit || undefined })} p={p} multiline rows={12} maxHeight={340} />
        ) : (
          <div
            className="no-scrollbar"
            style={{ maxHeight: 240, overflowY: "auto", whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", fontSize: 12, lineHeight: 1.6, color: p.onSurface, background: p.surfaceContainerHigh, borderRadius: 16, padding: 12 }}
          >
            {full}
          </div>
        )}
      </Row>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          } catch {}
        }}
        className="m3-press"
        style={{ height: 52, width: "100%", borderRadius: 26, border: "none", background: p.primary, color: p.onPrimary, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 }}
      >
        <Icon name={copied ? "check" : "content_copy"} size={22} />
        {copied ? t("copied", lang) : t("copyPrompt", lang)}
      </button>
    </div>
  );
}

/* tiny helper the parts panel above needs but the desktop kept to itself */
const CATEGORY_TEXT = {
  ja: { actions: "操作", navigation: "ナビゲーション", containment: "コンテナ", inputs: "入力", content: "コンテンツ", progress: "進捗" },
  zh: { actions: "操作", navigation: "导航", containment: "容器", inputs: "输入", content: "内容", progress: "进度" },
  ko: { actions: "동작", navigation: "내비게이션", containment: "컨테이너", inputs: "입력", content: "콘텐츠", progress: "진행 상태" },
} satisfies Record<string, Record<Category, string>>;
