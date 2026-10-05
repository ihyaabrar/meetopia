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
  const [collapsed, setCollapsed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const key = chatKey(target);
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);
  const loaded = useRef(new Set<string>());

  // Riwayat dimuat sekali per tab.
  useEffect(() => {
    if (loaded.current.has(key) || target.kind === "nearby") return;
    loaded.current.add(key);
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
      .catch(() => loaded.current.delete(key));
  }, [key, target, detail.group.id]);

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
      if (k !== keyRef.current) setUnread((u) => ({ ...u, [k]: true }));
    });
  }, [room, selfId]);

  useEffect(() => {
    setUnread((u) => (u[key] ? { ...u, [key]: false } : u));
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [key, store]);

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

  return (
    <section className={`chat ${collapsed ? "collapsed" : ""}`} aria-label={t("chat.title")}>
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
              # {c.name} {unread[k] && "•"}
            </button>
          );
        })}
        <button
          role="tab"
          className="tab"
          aria-selected={key === "nearby"}
          onClick={() => setTarget({ kind: "nearby" })}
        >
          📍 {t("chat.nearby")} {unread.nearby && "•"}
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
                @ {memberById.get(id)?.name ?? "?"} {unread[k] && "•"}
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
        <span className="spacer" />
        <button
          className="icon-btn"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? t("chat.expand") : t("chat.collapse")}
          aria-expanded={!collapsed}
        >
          <span style={{ display: "inline-block", transform: collapsed ? "rotate(180deg)" : undefined }}>
            <Icon name="chevron" size={18} />
          </span>
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="messages" ref={listRef} aria-live="polite">
            {messages.length === 0 && (
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
          <form className="composer" onSubmit={send}>
            <label className="sr-only" htmlFor="chat-input">
              {placeholder}
            </label>
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
            <button className="btn" disabled={!canSend || !text.trim()} aria-label={t("chat.send")}>
              <Icon name="send" size={18} />
            </button>
          </form>
        </>
      )}
    </section>
  );
}
