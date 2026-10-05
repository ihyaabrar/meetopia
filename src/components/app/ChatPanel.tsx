"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomClient } from "@/client/roomClient";
import { api } from "@/client/api";
import { useT, useI18n } from "@/i18n/client";
import { AvatarCanvas } from "@/components/AvatarCanvas";
import { Icon } from "@/components/Icon";
import type { ChatMessage } from "@/shared/protocol";
import { can, type Role } from "@/shared/roles";
import { chatKey, type ChatTarget, type GroupDetail } from "./types";

const CHAT_EMOJI = ["😀", "😂", "😍", "👍", "🙏", "🎉", "🔥", "👀", "☕", "✅", "❤️", "🤔"];

interface Props {
  room: RoomClient | null;
  detail: GroupDetail;
  selfId: string;
  role: Role;
  target: ChatTarget;
  setTarget: (c: ChatTarget) => void;
  dmTabs: string[];
  closeDm: (userId: string) => void;
  connected: boolean;
}

/** Chat: kanal teks grup, percakapan sekitar, dan pesan langsung (FR-25, FR-73). */
export function ChatPanel({
  room,
  detail,
  selfId,
  role,
  target,
  setTarget,
  dmTabs,
  closeDm,
  connected,
}: Props) {
  const t = useT();
  const { locale } = useI18n();
  const [store, setStore] = useState<Record<string, ChatMessage[]>>({});
  const [unread, setUnread] = useState<Record<string, boolean>>({});
  const [text, setText] = useState("");
  // Bawaan: hanya bilah ketik di bawah peta (sesuai desain); pesan tampil saat dibuka.
  const [collapsed, setCollapsed] = useState(true);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [retry, setRetry] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const key = chatKey(target);
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);
  const loaded = useRef(new Set<string>());
  const collapsedRef = useRef(collapsed);
  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  // Riwayat dimuat sekali per tab.
  useEffect(() => {
    if (loaded.current.has(key) || target.kind === "nearby") return;
    loaded.current.add(key);
    setFailed((f) => ({ ...f, [key]: false }));
    const url =
      target.kind === "channel"
        ? `/api/groups/${detail.group.id}/channels/${target.id}/messages`
        : `/api/groups/${detail.group.id}/dm/${target.userId}`;
    api<{ messages: ChatMessage[] }>(url)
      .then((r) =>
        setStore((s) => {
          const live = s[key] ?? [];
          const ids = new Set(r.messages.map((m) => m.id));
          return { ...s, [key]: [...r.messages, ...live.filter((m) => !ids.has(m.id))] };
        }),
      )
      .catch(() => {
        loaded.current.delete(key);
        setFailed((f) => ({ ...f, [key]: true }));
      });
  }, [key, target, detail.group.id, retry]);

  useEffect(() => {
    if (!room) return;
    return room.on("chat", (m) => {
      const k =
        m.kind === "channel"
          ? `c:${m.channelId}`
          : m.kind === "dm"
            ? `dm:${m.senderId === selfId ? m.toUserId : m.senderId}`
            : "nearby";
      setStore((s) => ({ ...s, [k]: [...(s[k] ?? []), m].slice(-300) }));
      if (k !== keyRef.current || collapsedRef.current) setUnread((u) => ({ ...u, [k]: true }));
    });
  }, [room, selfId]);

  useEffect(() => {
    if (collapsed) return;
    setUnread((u) => (u[key] ? { ...u, [key]: false } : u));
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [key, store, collapsed]);

  const canSend = connected && (target.kind !== "channel" || can(role, "sendChannelMessage"));

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !room || !canSend) return;
    if (target.kind === "channel") room.send({ t: "chat", kind: "channel", channelId: target.id, body });
    else if (target.kind === "dm") room.send({ t: "chat", kind: "dm", toUserId: target.userId, body });
    else room.send({ t: "chat", kind: "nearby", body });
    setText("");
  };

  const memberById = new Map(detail.members.map((m) => [m.id, m]));
  const messages = store[key] ?? [];
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale === "id" ? "id-ID" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const placeholder =
    target.kind === "channel"
      ? t("chat.placeholderChannel", { name: detail.channels.find((c) => c.id === target.id)?.name ?? "" })
      : target.kind === "dm"
        ? t("chat.placeholderDm", { name: memberById.get(target.userId)?.name ?? "" })
        : t("chat.placeholderNearby");

  const anyUnread = Object.values(unread).some(Boolean);
  const targetName =
    target.kind === "channel"
      ? `# ${detail.channels.find((c) => c.id === target.id)?.name ?? ""}`
      : target.kind === "dm"
        ? `@ ${memberById.get(target.userId)?.name ?? ""}`
        : t("chat.nearby");

  return (
    <section className={`chat ${collapsed ? "collapsed" : ""}`} aria-label={t("chat.title")}>
      {!collapsed && (
        <>
          <div className="chat-tabs" role="tablist">
            {detail.channels.map((c) => {
              const k = `c:${c.id}`;
              return (
                <button
                  key={c.id}
                  role="tab"
                  className="tab"
                  aria-selected={key === k}
                  onClick={() => setTarget({ kind: "channel", id: c.id })}
                >
                  # {c.name} {unread[k] && <span className="unread" aria-label={t("chat.unread")} />}
                </button>
              );
            })}
            <button
              role="tab"
              className="tab"
              aria-selected={key === "nearby"}
              onClick={() => setTarget({ kind: "nearby" })}
            >
              {t("chat.nearby")} {unread.nearby && <span className="unread" aria-label={t("chat.unread")} />}
            </button>
            {dmTabs.map((id) => {
              const k = `dm:${id}`;
              return (
                <span key={id} className="row" style={{ gap: 0 }}>
                  <button
                    role="tab"
                    className="tab"
                    aria-selected={key === k}
                    onClick={() => setTarget({ kind: "dm", userId: id })}
                  >
                    @ {memberById.get(id)?.name ?? "?"}{" "}
                    {unread[k] && <span className="unread" aria-label={t("chat.unread")} />}
                  </button>
                  <button
                    className="icon-btn"
                    style={{ width: 22, height: 22 }}
                    onClick={() => closeDm(id)}
                    aria-label={t("common.close")}
                  >
                    <Icon name="x" size={12} />
                  </button>
                </span>
              );
            })}
          </div>
          <div className="messages" ref={listRef} aria-live="polite">
            {failed[key] && (
              <div className="empty" role="alert">
                {t("chat.loadError")}{" "}
                <button className="btn small secondary" onClick={() => setRetry((r) => r + 1)}>
                  {t("common.retry")}
                </button>
              </div>
            )}
            {!failed[key] && messages.length === 0 && (
              <div className="empty">
                {target.kind === "nearby" ? t("chat.emptyNearby") : t("chat.empty")}
              </div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const cont =
                prev &&
                prev.senderId === m.senderId &&
                Date.parse(m.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000;
              const av = memberById.get(m.senderId)?.avatar;
              return (
                <div key={m.id} className={`msg ${cont ? "cont" : ""}`}>
                  <div>{!cont && av && <AvatarCanvas avatar={av} size={34} face />}</div>
                  <div>
                    {!cont && (
                      <div className="meta">
                        <b>{m.senderName}</b>
                        {time(m.createdAt)}
                      </div>
                    )}
                    <div className="body">{m.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      <form className="composer" onSubmit={send}>
        <button
          type="button"
          className="chat-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("chat.expand") : t("chat.collapse")}
          title={collapsed ? t("chat.expand") : t("chat.collapse")}
        >
          <Icon name="chat" size={18} />
          <span className="lbl">{collapsed ? t("chat.title") : targetName}</span>
          {collapsed && anyUnread && <span className="unread" aria-label={t("chat.unread")} />}
          <span style={{ display: "inline-flex", transform: collapsed ? "rotate(180deg)" : undefined }}>
            <Icon name="chevron" size={14} />
          </span>
        </button>
        <label className="sr-only" htmlFor="chat-input">
          {placeholder}
        </label>
        <div className="composer-field">
          <input
            id="chat-input"
            className="input"
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            placeholder={canSend ? placeholder : connected ? t("chat.readOnly") : t("chat.offline")}
            disabled={!canSend}
            autoComplete="off"
          />
          <button
            type="button"
            className="icon-btn emoji-btn"
            aria-label={t("chat.emoji")}
            aria-expanded={emojiOpen}
            onClick={() => setEmojiOpen((o) => !o)}
            disabled={!canSend}
          >
            <Icon name="smile" size={18} />
          </button>
          {emojiOpen && (
            <div className="emoji-pick" role="menu" aria-label={t("chat.emoji")}>
              {CHAT_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setText((v) => v + e);
                    setEmojiOpen(false);
                    document.getElementById("chat-input")?.focus();
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn send" disabled={!canSend || !text.trim()} aria-label={t("chat.send")}>
          <Icon name="send" size={18} />
        </button>
      </form>
    </section>
  );
}
