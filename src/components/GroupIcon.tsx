import { GROUP_COLORS, groupInitials, isGroupColor, type GroupSymbol } from "@/shared/groupIcon";
import { Icon } from "./Icon";

/** Ikon grup untuk rail, pengaturan, dan undangan. */
export function GroupIcon({
  name,
  color,
  symbol,
  size = 48,
  className = "",
}: {
  name: string;
  color: string;
  symbol: GroupSymbol | string;
  size?: number;
  className?: string;
}) {
  const bg = isGroupColor(color) ? GROUP_COLORS[color] : GROUP_COLORS.green;
  return (
    <span
      className={`group-icon ${className}`}
      style={{ background: bg, width: size, height: size, fontSize: Math.round(size * 0.32) }}
      aria-hidden
    >
      {symbol === "initials" || !symbol ? (
        groupInitials(name) || "?"
      ) : (
        <Icon name={symbol as Parameters<typeof Icon>[0]["name"]} size={Math.round(size * 0.46)} />
      )}
    </span>
  );
}
