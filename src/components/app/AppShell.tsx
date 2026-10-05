"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { RoomClient, type RoomSnapshot } from "@/client/roomClient";
import { MediaManager } from "@/client/media";
import { MusicPlayer } from "@/client/music";
import { api } from "@/client/api";
import { applyPrefsToDocument, getPrefs } from "@/client/prefs";
import { desktopNotify, playSound } from "@/client/sounds";
import { useI18n } from "@/i18n/client";
import { ToastProvider, useToast } from "@/components/Toasts";
import { Logo, LogoMark } from "@/components/Logo";
import { Icon, type IconName } from "@/components/Icon";
import { AvatarCanvas } from "@/components/AvatarCanvas";
import { Modal } from "@/components/Modal";
import { zoneAt, type MapObject, type ObjectAction } from "@/shared/map";
import type { Point } from "@/shared/pathfinding";
import type { Presence } from "@/shared/protocol";
import { can } from "@/shared/roles";
import { RoomStage } from "./RoomStage";
import { ChatPanel } from "./ChatPanel";
import { MembersPanel } from "./MembersPanel";
import { NotesPanel } from "./NotesPanel";
import { DeviceCheck } from "./DeviceCheck";
import { Tips } from "./Tips";
import { CreateGroup } from "./CreateGroup";
import { UserSettings, type UserSection } from "./UserSettings";
import { GroupSettings, type GroupSection } from "./GroupSettings";
import { SpeakerPanel } from "./SpeakerPanel";
import { GroupIcon } from "@/components/GroupIcon";
import type { ChatTarget, GroupDetail, GroupSummary, Me, MemberInfo } from "./types";

const EMPTY_SNAP: RoomSnapshot = {
  conn: "closed",
  selfId: null,
  peers: new Map(),
  map: null,
  sharedNote: null,
  music: {},
  clockOffset: 0,
  version: 0,
};
const noopSubscribe = () => () => {};

export function AppShell(props: { initialUser: Me; initialGroups: GroupSummary[] }) {
  return (
    <ToastProvider>
      <Shell {...props} />
    </ToastProvider>
  );
}

function Shell({ initialUser, initialGroups }: { initialUser: Me; initialGroups: GroupSummary[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const [me, setMe] = useState(initialUser);
  const [groups, setGroups] = useState(initialGroups);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [room, setRoom] = useState<RoomClient | null>(null);
  const [media, setMedia] = useState<MediaManager | null>(null);
  const [music, setMusic] = useState<MusicPlayer | null>(null);
  const [speaker, setSpeaker] = useState<MapObject | null>(null);
  const [chatTarget, setChatTarget] = useState<ChatTarget>({ kind: "nearby" });
  const [dmTabs, setDmTabs] = useState<string[]>([]);
  const [notes, setNotes] = useState<null | "private" | "shared">(null);
  const [modal, setModal] = useState<
    null | "create" | "profile" | "settings" | "invites" | "devices" | "tips"
  >(null);
  const [userSection, setUserSection] = useState<UserSection>("account");
  const [groupSection, setGroupSection] = useState<GroupSection | undefined>(undefined);
  const [railMenu, setRailMenu] = useState<{ group: GroupSummary; x: number; y: number } | null>(null);
  const openGroupSettings = (s?: GroupSection) => {
    setGroupSection(s);
    setModal("settings");
  };
  const openUserSettings = (s: UserSection = "account") => {
    setUserSection(s);
    setModal("profile");
  };
  const [joining, setJoining] = useState(false);
  const [peerCard, setPeerCard] = useState<{ member: MemberInfo; presence?: Presence } | null>(null);
  const [showNav, setShowNav] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [bannerHidden, setBannerHidden] = useState(false);
  const walkToRef = useRef<((p: Point) => void) | null>(null);
  const registerWalkTo = useCallback((fn: (p: Point) => void) => {
    walkToRef.current = fn;
  }, []);

  // Grup awal dari URL (?g=) atau grup pertama.
  useEffect(() => {
    const g = new URLSearchParams(location.search).get("g");
    setActiveId(g && initialGroups.some((x) => x.id === g) ? g : (initialGroups[0]?.id ?? null));
    setDevLink(sessionStorage.getItem("mt_dev_verify"));
    applyPrefsToDocument();
    setBannerHidden(!!sessionStorage.getItem("mt_banner_hidden"));
    try {
      if (!localStorage.getItem("mt_tips_seen")) {
        localStorage.setItem("mt_tips_seen", "1");
        setModal("tips");
      }
    } catch {}
  }, [initialGroups]);

  const refreshGroups = useCallback(async () => {
    const r = await api<{ groups: GroupSummary[] }>("/api/groups");
    setGroups(r.groups);
    return r.groups;
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const d = await api<GroupDetail>(`/api/groups/${id}`);
      setDetail((cur) => (cur && cur.group.id !== id ? cur : d));
      return d;
    } catch {
      return null;
    }
  }, []);

  // Pindah grup tanpa memuat ulang halaman (FR-70, FR-71). Audio ruangan sebelumnya diputus.
  useEffect(() => {
    if (!activeId) {
      setDetail(null);
      return;
    }
    const url = new URL(location.href);
    url.searchParams.set("g", activeId);
    history.replaceState(null, "", url);
    setDetail(null);
    setDmTabs([]);
    setNotes(null);
    void loadDetail(activeId).then((d) => {
      if (d?.channels[0]) setChatTarget({ kind: "channel", id: d.channels[0].id });
    });
    const r = new RoomClient(activeId);
    const m = new MediaManager(r);
    const mp = new MusicPlayer(r);
    setRoom(r);
    setMedia(m);
    setMusic(mp);
    setSpeaker(null);
    void r.connect();
    // Hook debug untuk tes e2e dan pengukuran spike (hanya di pengembangan).
    if (process.env.NODE_ENV !== "production")
      (window as unknown as { __meetopia?: unknown }).__meetopia = {
        room: r,
        media: m,
        music: mp,
        walkTo: (p: Point) => walkToRef.current?.(p),
      };
    if (!sessionStorage.getItem("mt_device_checked")) {
      setJoining(true);
      setModal("devices");
    } else if (getPrefs().micOnJoin) {
      // Pilihan pengguna di pengaturan: mikrofon langsung menyala setelah tersambung.
      const off = r.on("welcome", () => {
        off();
        void m.setMic(true);
      });
    }
    return () => {
      mp.destroy();
      m.destroy();
      r.close();
    };
  }, [activeId, loadDetail]);

  const snap = useSyncExternalStore(
    room?.subscribe ?? noopSubscribe,
    room?.getSnapshot ?? (() => EMPTY_SNAP),
    () => EMPTY_SNAP,
  );

  // Event ruangan: ketuk, layar, dikeluarkan, galat media.
  useEffect(() => {
    if (!room || !media) return;
    media.setErrorHandler((e) => toast({ text: t(`media.err.${e}`), kind: "error" }));
    const offs = [
      room.on("knock", (k) => {
        if (getPrefs().soundKnock) playSound("knock");
        if (getPrefs().desktopNotify) desktopNotify("Meetopia", t("knock.incoming", { name: k.fromName }));
        const zone = k.zoneId ? room.snapshot.map?.zones.find((z) => z.id === k.zoneId) : null;
        toast({
          text: zone
            ? t("knock.incomingZone", { name: k.fromName, zone: t(zone.label) })
            : t("knock.incoming", { name: k.fromName }),
          sticky: true,
          action: {
            label: t("knock.accept"),
            run: () => room.send({ t: "knockReply", knockId: k.knockId, accept: true }),
          },
          secondary: {
            label: t("knock.decline"),
            run: () => room.send({ t: "knockReply", knockId: k.knockId, accept: false }),
          },
        });
      }),
      room.on("knockResult", (r) => {
        if (!r.knockId) return toast({ text: t("knock.enterFree") });
        toast({
          text: r.accept ? t("knock.accepted", { name: r.byName }) : t("knock.declined", { name: r.byName }),
          kind: r.accept ? "info" : "error",
        });
      }),
      room.on("screenRejected", () => media.screenRejected()),
      room.on("groupChanged", () => {
        void loadDetail(room.groupId);
        void refreshGroups();
      }),
      room.on("chat", (m) => {
        if (m.kind !== "dm" || m.senderId === me.id) return;
        const prefs = getPrefs();
        if (prefs.soundDm) playSound("dm");
        if (prefs.desktopNotify) desktopNotify(m.senderName, m.body.slice(0, 140));
      }),
      room.on("error", (code) => {
        if (code === "rateLimited" || code === "tooFar") toast({ text: t(`error.${code}`), kind: "error" });
      }),
      room.on("kicked", (reason) => {
        if (reason === "replaced") {
          toast({
            text: t("conn.replaced"),
            sticky: true,
            action: { label: t("conn.reconnect"), run: () => void room.connect() },
          });
          return;
        }
        toast({ text: t(`conn.kicked.${reason}`), kind: "error" });
        void refreshGroups().then((gs) => setActiveId(gs[0]?.id ?? null));
      }),
    ];
    return () => offs.forEach((o) => o());
  }, [room, media, t, toast, refreshGroups, loadDetail, me.id]);

  // Aktivitas dalam aplikasi (bukan pelacakan layar/keystroke): cukup tanda "masih di sini" tiap 30 detik.
  useEffect(() => {
    if (!room) return;
    let last = 0;
    const onAct = () => {
      const now = Date.now();
      if (now - last > 30_000) {
        last = now;
        room.send({ t: "activity" });
      }
    };
    window.addEventListener("pointerdown", onAct);
    window.addEventListener("keydown", onAct);
    return () => {
      window.removeEventListener("pointerdown", onAct);
      window.removeEventListener("keydown", onAct);
    };
  }, [room]);

  // Daftar anggota diperbarui saat ada yang baru bergabung lewat undangan.
  const presenceIds = useMemo(() => [...snap.peers.keys()].sort().join(","), [snap.peers]);
  useEffect(() => {
    if (!detail || !activeId) return;
    const known = new Set(detail.members.map((m) => m.id));
    if ([...snap.peers.keys()].some((id) => !known.has(id))) void loadDetail(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenceIds]);

  const self = snap.selfId ? snap.peers.get(snap.selfId) : undefined;
  const role = detail?.role ?? "guest";

  const openDm = (userId: string) => {
    setDmTabs((l) => (l.includes(userId) ? l : [...l, userId]));
    setChatTarget({ kind: "dm", userId });
  };

  const onAction = (action: ObjectAction, obj: MapObject) => {
    switch (action) {
      case "music":
        return setSpeaker(obj);
      case "openSharedNotes":
        return setNotes("shared");
      case "openPrivateNotes":
        return setNotes("private");
      case "showTips":
        return setModal("tips");
      case "buy":
      case "brew":
        return toast({ text: t("action.comingSoon") });
      case "read":
        return toast({ text: t("action.readResult") });
      case "drink":
        return toast({ text: t("action.drinkResult") });
      case "watch":
        return toast({ text: t("action.watchResult") });
    }
  };

  const selectPeer = (member: MemberInfo, presence?: Presence) => {
    if (member.id === me.id) return openUserSettings("avatar");
    setPeerCard({ member, presence });
  };

  const switchGroup = (id: string) => {
    setActiveId(id);
    setShowNav(false);
  };

  const onlineCount = snap.peers.size;
  const activeGroup = groups.find((g) => g.id === activeId);

  return (
    <div
      className={`app ${showNav ? "show-nav" : ""} ${showMembers ? "show-members" : ""} ${detail ? "" : "no-members"}`}
    >
      <nav className="rail" aria-label={t("nav.groups")}>
        <div className="rail-home" title="Meetopia">
          <LogoMark size={36} title="Meetopia" />
        </div>
        <span className="rail-sep" />
        {groups.map((g) => (
          <button
            key={g.id}
            className="rail-item"
            aria-current={g.id === activeId}
            onClick={() => switchGroup(g.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setRailMenu({ group: g, x: e.clientX, y: e.clientY });
            }}
            title={g.name}
            aria-label={g.name}
            aria-haspopup="menu"
          >
            <GroupIcon name={g.name} color={g.iconColor} symbol={g.iconSymbol} size={48} />
          </button>
        ))}
        <button
          className="rail-item add"
          onClick={() => setModal("create")}
          title={t("group.createTitle")}
          aria-label={t("group.createTitle")}
        >
          +
        </button>
      </nav>

      <aside className="sidebar" aria-label={t("nav.channels")}>
        <div className="sidebar-head">
          <span className="name">{activeGroup?.name ?? "Meetopia"}</span>
          {detail && (
            <button
              className="icon-btn"
              onClick={() => openGroupSettings()}
              aria-label={t("settings.open")}
              title={t("settings.open")}
            >
              <Icon name="settings" size={18} />
            </button>
          )}
        </div>
        <div className="sidebar-body">
          {detail && (
            <>
              <div className="section-title">{t("nav.textChannels")}</div>
              {detail.channels.map((c) => (
                <button
                  key={c.id}
                  className="nav-item"
                  aria-current={chatTarget.kind === "channel" && chatTarget.id === c.id}
                  onClick={() => {
                    setChatTarget({ kind: "channel", id: c.id });
                    setShowNav(false);
                  }}
                >
                  <span className="hash">#</span> {c.name}
                </button>
              ))}
              <button className="nav-item" aria-current={!!notes} onClick={() => setNotes("shared")}>
                <span className="hash">#</span> {t("nav.notes")}
              </button>
              <div className="section-title">{t("nav.room")}</div>
              <div className="room-card">
                <div className="room-card-head">
                  <span className="room-icon" aria-hidden>
                    <Icon name="door" size={18} />
                  </span>
                  <span className="grow">
                    <b>{t("nav.office")}</b>
                    <span className="count">
                      <span className={`live-dot ${snap.conn === "open" ? "" : "off"}`} />
                      {t("nav.inRoom", { n: onlineCount })}
                    </span>
                  </span>
                </div>
                {onlineCount > 0 && (
                  <div className="avatar-stack" aria-hidden>
                    {[...snap.peers.values()].slice(0, 6).map((p) => (
                      <span key={p.id} className="stack-item" title={p.name}>
                        <AvatarCanvas avatar={p.avatar} size={28} face />
                      </span>
                    ))}
                    {onlineCount > 6 && <span className="stack-more">+{onlineCount - 6}</span>}
                  </div>
                )}
                <button
                  className="btn small secondary block"
                  style={{ marginTop: 10 }}
                  onClick={() => setModal("devices")}
                >
                  <Icon name="speaker" size={16} /> {t("devices.title")}
                </button>
              </div>
              {can(role, "createInvite") && (
                <button className="nav-item" onClick={() => setModal("invites")} style={{ marginTop: 8 }}>
                  <Icon name="link" size={16} /> {t("invite.inviteMembers")}
                </button>
              )}
            </>
          )}
        </div>
        <div className="user-bar">
          <span className="avatar-wrap">
            <AvatarCanvas avatar={me.avatar} size={34} face />
            <span className={`status-dot s-${self?.status ?? "offline"}`} />
          </span>
          <span className="who">
            <b>{me.name}</b>
            <span>{self ? t(`status.${self.status}`) : t("status.offline")}</span>
          </span>
          <button
            className="icon-btn"
            onClick={() => openUserSettings()}
            aria-label={t("us.open")}
            title={t("us.open")}
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="main-head">
          <button
            className="icon-btn mobile-only"
            onClick={() => setShowNav(true)}
            aria-label={t("nav.open")}
          >
            <Icon name="menu" />
          </button>
          <div className="head-title">
            <h2>{activeGroup ? activeGroup.name : "Meetopia"}</h2>
            {activeGroup && (
              <span className="head-sub">
                <Icon name="door" size={13} /> {t("nav.office")} · {t("nav.inRoom", { n: onlineCount })}
              </span>
            )}
          </div>
          {onlineCount > 0 && (
            <div className="avatar-stack head-stack" aria-hidden>
              {[...snap.peers.values()].slice(0, 4).map((p) => (
                <span key={p.id} className="stack-item" title={p.name}>
                  <AvatarCanvas avatar={p.avatar} size={26} face />
                </span>
              ))}
            </div>
          )}
          {detail && (
            <button
              className="icon-btn"
              onClick={() => setShowMembers((v) => !v)}
              aria-label={t("members.title")}
              aria-expanded={showMembers}
            >
              <Icon name="users" />
            </button>
          )}
        </header>
        {me.emailVerification && !me.emailVerified && !bannerHidden && (
          <div className="banner" role="status">
            <Icon name="mail" size={16} />
            <span className="grow">{t("profile.verifyBanner", { email: me.email })}</span>
            {devLink && <a href={devLink}>{t("profile.devVerify")}</a>}
            <button
              className="icon-btn"
              style={{ width: 28, height: 28 }}
              onClick={() => {
                setBannerHidden(true);
                sessionStorage.setItem("mt_banner_hidden", "1");
              }}
              aria-label={t("common.close")}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        )}
        {!activeId ? (
          <div className="welcome-main">
            <div className="card" style={{ padding: 32, maxWidth: 460 }}>
              <Logo size={40} tagline />
              <h2 style={{ marginTop: 24 }}>{t("welcome.title")}</h2>
              <p className="hint">{t("welcome.body")}</p>
              <button className="btn" onClick={() => setModal("create")}>
                <Icon name="plus" size={18} /> {t("group.createTitle")}
              </button>
            </div>
          </div>
        ) : (
          <div className="split" style={{ position: "relative" }}>
            {room && media && snap.map ? (
              <RoomStage
                room={room}
                media={media}
                music={music}
                onOpenSpeaker={(id) => {
                  const o = snap.map?.objects.find((x) => x.id === id);
                  if (o) setSpeaker(o);
                }}
                snap={snap}
                onAction={onAction}
                onPeerClick={(p) => {
                  const m = detail?.members.find((x) => x.id === p.id) ?? {
                    id: p.id,
                    name: p.name,
                    avatar: p.avatar,
                    role: p.role,
                  };
                  selectPeer(m, p);
                }}
                onOpenDevices={() => setModal("devices")}
                onOpenNotes={() => setNotes("private")}
                onHelp={() => setModal("tips")}
                registerWalkTo={registerWalkTo}
              />
            ) : (
              <div className="stage loading-stage">
                <div className="loading-mark" role="status">
                  <LogoMark size={48} />
                  {snap.configError ? (
                    <>
                      <b>{t("config.title")}</b>
                      <span>{t(`error.${snap.configError}`)}</span>
                    </>
                  ) : (
                    <span>{t(snap.conn === "closed" ? "conn.closed" : "conn.connecting")}</span>
                  )}
                </div>
              </div>
            )}
            {detail && (
              <ChatPanel
                key={detail.group.id}
                room={room}
                detail={detail}
                selfId={me.id}
                role={role}
                target={chatTarget}
                setTarget={setChatTarget}
                dmTabs={dmTabs}
                closeDm={(id) => {
                  setDmTabs((l) => l.filter((x) => x !== id));
                  if (chatTarget.kind === "dm" && chatTarget.userId === id) setChatTarget({ kind: "nearby" });
                }}
                connected={snap.conn === "open"}
              />
            )}
            {notes && detail && (
              <NotesPanel
                groupId={detail.group.id}
                role={role}
                shared={snap.sharedNote}
                selfId={me.id}
                tab={notes}
                setTab={setNotes}
                onClose={() => setNotes(null)}
              />
            )}
          </div>
        )}
      </main>

      {detail && (
        <MembersPanel
          members={detail.members}
          presence={snap.peers}
          selfId={me.id}
          onSelect={selectPeer}
          locate={(p) => {
            const z = snap.map ? zoneAt(snap.map, p.x, p.y) : null;
            return z ? t(z.label) : null;
          }}
          onClose={showMembers ? () => setShowMembers(false) : undefined}
        />
      )}
      <div className="drawer-backdrop" onClick={() => (setShowNav(false), setShowMembers(false))} />

      {railMenu && (
        <ContextMenu
          x={railMenu.x}
          y={railMenu.y}
          label={railMenu.group.name}
          onClose={() => setRailMenu(null)}
          items={[
            {
              label: t("settings.open"),
              icon: "settings",
              run: () => {
                switchGroup(railMenu.group.id);
                openGroupSettings();
              },
            },
            ...(can(railMenu.group.role, "createInvite")
              ? [
                  {
                    label: t("invite.inviteMembers"),
                    icon: "link" as const,
                    run: () => {
                      switchGroup(railMenu.group.id);
                      setModal("invites");
                    },
                  },
                ]
              : []),
            ...(railMenu.group.role !== "owner"
              ? [
                  {
                    label: t("settings.leave"),
                    icon: "logout" as const,
                    danger: true,
                    run: async () => {
                      if (!confirm(t("settings.leaveConfirm"))) return;
                      await api(`/api/groups/${railMenu.group.id}/members/${me.id}`, { method: "DELETE" });
                      const gs = await refreshGroups();
                      if (railMenu.group.id === activeId) setActiveId(gs[0]?.id ?? null);
                    },
                  },
                ]
              : []),
          ]}
        />
      )}
      {modal === "create" && (
        <CreateGroup
          onClose={() => setModal(null)}
          onCreated={async (id) => {
            setModal(null);
            await refreshGroups();
            setActiveId(id);
          }}
        />
      )}
      {modal === "profile" && (
        <UserSettings
          me={me}
          media={media}
          initial={userSection}
          onClose={() => setModal(null)}
          onSaved={setMe}
        />
      )}
      {(modal === "settings" || modal === "invites") && detail && (
        <GroupSettings
          detail={detail}
          selfId={me.id}
          initialTab={modal === "invites" ? "invites" : groupSection}
          onClose={() => setModal(null)}
          onChanged={() => {
            if (activeId) void loadDetail(activeId);
            void refreshGroups();
          }}
          onLeft={async () => {
            setModal(null);
            const gs = await refreshGroups();
            setActiveId(gs[0]?.id ?? null);
          }}
        />
      )}
      {modal === "devices" && media && (
        <DeviceCheck
          media={media}
          joining={joining}
          onDone={(micOn) => {
            sessionStorage.setItem("mt_device_checked", "1");
            setModal(null);
            setJoining(false);
            if (micOn) void media.setMic(true);
          }}
        />
      )}
      {modal === "tips" && <Tips onClose={() => setModal(null)} />}
      {speaker && room && (
        <SpeakerPanel room={room} snap={snap} obj={speaker} role={role} onClose={() => setSpeaker(null)} />
      )}
      {peerCard && (
        <Modal
          title={peerCard.member.name}
          sub={peerCard.presence ? t(`status.${peerCard.presence.status}`) : t("status.offline")}
          onClose={() => setPeerCard(null)}
        >
          <div style={{ display: "grid", placeItems: "center", marginBottom: 12 }}>
            <AvatarCanvas avatar={peerCard.presence?.avatar ?? peerCard.member.avatar} size={110} />
            <span className="badge">{t(`role.${peerCard.member.role}`)}</span>
          </div>
          <div className="modal-actions" style={{ justifyContent: "center" }}>
            <button
              className="btn secondary"
              onClick={() => {
                openDm(peerCard.member.id);
                setPeerCard(null);
              }}
            >
              <Icon name="chat" size={18} /> {t("peer.message")}
            </button>
            {peerCard.presence && (
              <button
                className="btn secondary"
                onClick={() => {
                  walkToRef.current?.({ x: peerCard.presence!.x + 1, y: peerCard.presence!.y });
                  setPeerCard(null);
                }}
              >
                <Icon name="pin" size={18} /> {t("peer.walkTo")}
              </button>
            )}
            {peerCard.presence?.status === "busy" && (
              <button
                className="btn"
                onClick={() => {
                  room?.send({ t: "knock", toUserId: peerCard.member.id });
                  toast({ text: t("knock.sent") });
                  setPeerCard(null);
                }}
              >
                <Icon name="knock" size={18} /> {t("knock.knock")}
              </button>
            )}
          </div>
          {peerCard.presence?.status === "busy" && (
            <p className="hint" style={{ textAlign: "center" }}>
              {t("peer.busyHint")}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}

interface MenuItem {
  label: string;
  icon: IconName;
  danger?: boolean;
  run: () => void | Promise<void>;
}

/** Menu klik kanan sederhana (rail grup). Escape, klik di luar, atau gulir menutupnya. */
function ContextMenu({
  x,
  y,
  label,
  items,
  onClose,
}: {
  x: number;
  y: number;
  label: string;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useEffect(() => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({
        left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
        top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
      });
      el.querySelector<HTMLElement>("button")?.focus();
    }
    const onDown = (e: PointerEvent) => !el?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const btns = [...(el?.querySelectorAll<HTMLElement>("button") ?? [])];
        const i = btns.indexOf(document.activeElement as HTMLElement);
        btns[(i + (e.key === "ArrowDown" ? 1 : -1) + btns.length) % btns.length]?.focus();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
    };
  }, [x, y, onClose]);
  return (
    <div ref={ref} className="context-menu" role="menu" aria-label={label} style={pos}>
      <div className="context-title">{label}</div>
      {items.map((it) => (
        <button
          key={it.label}
          role="menuitem"
          className={it.danger ? "danger" : ""}
          onClick={() => {
            onClose();
            void it.run();
          }}
        >
          <Icon name={it.icon} size={16} />
          {it.label}
        </button>
      ))}
    </div>
  );
}
