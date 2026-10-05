"use client";

import { useT } from "@/i18n/client";
import {
  GROUP_COLORS,
  GROUP_COLOR_KEYS,
  GROUP_SYMBOLS,
  type GroupColor,
  type GroupSymbol,
} from "@/shared/groupIcon";
import { GroupIcon } from "./GroupIcon";
import { Icon, type IconName } from "./Icon";

/** Pilih warna dan simbol ikon grup, dengan pratinjau langsung. */
export function GroupIconPicker({
  name,
  color,
  symbol,
  onChange,
}: {
  name: string;
  color: GroupColor;
  symbol: GroupSymbol;
  onChange: (v: { color: GroupColor; symbol: GroupSymbol }) => void;
}) {
  const t = useT();
  return (
    <div className="icon-picker">
      <GroupIcon name={name || "?"} color={color} symbol={symbol} size={80} className="icon-preview" />
      <div className="grow">
        <div className="field" role="group" aria-label={t("gs.iconColor")}>
          <span className="label">{t("gs.iconColor")}</span>
          <div className="swatches">
            {GROUP_COLOR_KEYS.map((c) => (
              <button
                key={c}
                type="button"
                className="swatch"
                style={{ background: GROUP_COLORS[c] }}
                aria-pressed={color === c}
                aria-label={t(`gs.color.${c}`)}
                title={t(`gs.color.${c}`)}
                onClick={() => onChange({ color: c, symbol })}
              />
            ))}
          </div>
        </div>
        <div className="field" role="group" aria-label={t("gs.iconSymbol")} style={{ marginBottom: 0 }}>
          <span className="label">{t("gs.iconSymbol")}</span>
          <div className="symbol-grid">
            {GROUP_SYMBOLS.map((s) => (
              <button
                key={s}
                type="button"
                className="symbol-btn"
                aria-pressed={symbol === s}
                aria-label={t(`gs.symbol.${s}`)}
                title={t(`gs.symbol.${s}`)}
                onClick={() => onChange({ color, symbol: s })}
              >
                {s === "initials" ? <span className="ab">Ab</span> : <Icon name={s as IconName} size={18} />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
