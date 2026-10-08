"use client";

import { useRouter } from "next/navigation";
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
import { buildWalkable, zoneAt, type MapObject, type ObjectAction } from "@/shared/map";
import { nearestFree } from "@/shared/pathfinding";
import { templateOf } from "@/shared/templates";
import type { Point } from "@/shared/pathfinding";
import type { Presence } from "@/shared/protocol";
import { PAIRED_ACTIONS } from "@/shared/protocol";
import { actionLabel } from "@/shared/avatar-animation";
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
import { TvPanel } from "./TvPanel";
import { ShopPanel } from "./ShopPanel";
import { activeEffects, useLiveLife } from "./LifeHud";
import { ITEMS, venueOf } from "@/shared/life";
import { ProfileCard } from "./ProfileCard";
import { StatusEditor } from "./StatusEditor";
import { InviteModal } from "./InviteModal";
import { WorkspacePicker } from "./WorkspacePicker";
import { JoinWorkspace } from "./JoinWorkspace";
import { WorkspaceBoard } from "./WorkspaceBoard";
import { Popover } from "@/components/Popover";
import { timeAgo } from "@/i18n/relative";
import {
  clearNotifications,
  initNotifications,
  markAllRead,
  pushNotification,
  useNotifications,
} from "@/client/notifications";
import { setPrefs, usePrefs } from "@/client/prefs";
import { GroupIcon } from "@/components/GroupIcon";
import type { ChatTarget, GroupDetail, GroupSummary, Me, MemberInfo } from "./types";

const EMPTY_SNAP: RoomSnapshot = {
  conn: "closed",
  selfId: null,
  peers: new Map(),
  map: null,
  sharedNote: null,
  music: {},
  tv: {},
  locks: {},
  clockOffset: 0,
  life: null,
  lifeAt: 0,
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
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [me, setMe] = useState(initialUser);
  const [groups, setGroups] = useState(initialGroups);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [room, setRoom] = useState<RoomClient | null>(null);
  const [media, setMedia] = useState<MediaManager | null>(null);
  const [music, setMusic] = useState<MusicPlayer | null>(null);
  const [speaker, setSpeaker] = useState<MapObject | null>(null);
  const [tv, setTv] = useState<MapObject | null>(null);
  const [shop, setShop] = useState<MapObject | null>(null);
  const [chatTarget, setChatTarget] = useState<ChatTarget>({ kind: "nearby" });
  const [dmTabs, setDmTabs] = useState<string[]>([]);
  const [notes, setNotes] = useState<null | "private" | "shared">(null);
  const [board, setBoard] = useState<null | "agenda" | "task" | "resource">(null);
  const [modal, setModal] = useState<
    null | "create" | "profile" | "settings" | "invites" | "devices" | "tips" | "status" | "join"
  >(null);
  /** Beranda: halaman Pilih Workspace. */
  const [home, setHome] = useState(initialGroups.length === 0);
  const prefs = usePrefs();
  const [headMenu, setHeadMenu] = useState<null | "notifs" | "profile">(null);
  const notifs = useNotifications();
  const unreadNotifs = notifs.filter((n) => !n.read).length;
  const groupsRef = useRef(groups);
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);
  const [userSection, setUserSection] = useState<UserSection>("profile");
  const [groupSection, setGroupSection] = useState<GroupSection | undefined>(undefined);
  const [railMenu, setRailMenu] = useState<{ group: GroupSummary; x: number; y: number } | null>(null);
  const openGroupSettings = (s?: GroupSection) => {
    setGroupSection(s);
    setModal("settings");
  };
  const openUserSettings = (s: UserSection = "profile") => {
    setUserSection(s);
    setModal("profile");
  };
  const [joining, setJoining] = useState(false);
  const [peerCard, setPeerCard] = useState<{ member: MemberInfo; presence?: Presence } | null>(null);
  const [showNav, setShowNav] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showChat, setShowChat] = useState(false);
  // Chat tersembunyi secara bawaan: pesan kanal/DM yang masuk saat itu ditandai di tombol chat.
  const [chatUnread, setChatUnread] = useState(false);
  const showChatRef = useRef(showChat);
  useEffect(() => {
    showChatRef.current = showChat;
  }, [showChat]);
  /** Di layar sempit rail & sidebar adalah laci di atas peta: tutup saat panel lain dibuka agar panel tidak tertutup laci. */
  const closeDrawer = () => {
    if (window.matchMedia("(max-width: 760px)").matches) setShowNav(false);
  };
  const toggleChat = () => {
    setShowChat((v) => !v);
    setChatUnread(false);
    closeDrawer();
  };
  // Escape menutup laci seluler (bila tidak ada dialog di atasnya; dialog menangani Escape sendiri).
  useEffect(() => {
    if (!showNav && !showMembers) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector('[aria-modal="true"]')) return;
      if (!window.matchMedia("(max-width: 760px)").matches) return;
      setShowNav(false);
      setShowMembers(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showNav, showMembers]);
  const [zoneSearch, setZoneSearch] = useState("");
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
    initNotifications(initialUser.id);
    setBannerHidden(!!sessionStorage.getItem("mt_banner_hidden"));
    try {
      if (!localStorage.getItem("mt_tips_seen")) {
        localStorage.setItem("mt_tips_seen", "1");
        setModal("tips");
      }
    } catch {}
  }, [initialGroups, initialUser.id]);

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
      // Tidak ada grup lagi (dikeluarkan/grup dihapus): lepaskan koneksi ruangan yang sudah ditutup
      // agar header tidak menampilkan pencarian area & chat milik ruangan lama.
      setDetail(null);
      setRoom(null);
      setMedia(null);
      setMusic(null);
      const url = new URL(location.href);
      if (url.searchParams.has("g")) {
        url.searchParams.delete("g");
        history.replaceState(null, "", url);
      }
      return;
    }
    const url = new URL(location.href);
    url.searchParams.set("g", activeId);
    history.replaceState(null, "", url);
    setDetail(null);
    setDmTabs([]);
    setNotes(null);
    setBoard(null);
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
    setTv(null);
    setShop(null);
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
    const gname = () => groupsRef.current.find((g) => g.id === room.groupId)?.name ?? "";
    media.setErrorHandler((e) => toast({ text: t(`media.err.${e}`), kind: "error" }));
    const offs = [
      room.on("peerJoined", (p) =>
        pushNotification({
          kind: "join",
          name: p.name,
          userId: p.id,
          groupId: room.groupId,
          groupName: gname(),
        }),
      ),
      room.on("knock", (k) => {
        pushNotification({
          kind: "knock",
          name: k.fromName,
          userId: k.from,
          groupId: room.groupId,
          groupName: gname(),
        });
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
      room.on("pairInvite", (r) =>
        toast({
          text: t("pair.invite", { name: r.fromName, action: actionLabel(r.action, locale).toLowerCase() }),
          sticky: true,
          action: {
            label: t("pair.accept"),
            run: () => room.send({ t: "pairReply", requestId: r.requestId, accept: true }),
          },
          secondary: {
            label: t("pair.decline"),
            run: () => room.send({ t: "pairReply", requestId: r.requestId, accept: false }),
          },
        }),
      ),
      room.on("pairResult", (r) =>
        toast({
          text: t(r.accepted ? "pair.started" : `pair.result.${r.reason ?? "declined"}`),
        }),
      ),
      room.on("teleported", (m) => m.toName && toast({ text: t("peer.teleported", { name: m.toName }) })),
      room.on("teleportRejected", (m) =>
        toast({ text: t(`peer.teleportRejected.${m.reason}`), kind: "error" }),
      ),
      room.on("groupChanged", () => {
        void loadDetail(room.groupId);
        void refreshGroups();
      }),
      room.on("chat", (m) => {
        if (m.senderId === me.id) return;
        if (m.kind !== "nearby" && !showChatRef.current) setChatUnread(true);
        const prefs = getPrefs();
        const base = { name: m.senderName, userId: m.senderId, groupId: room.groupId, groupName: gname() };
        if (m.kind === "dm") {
          pushNotification({ ...base, kind: "dm", extra: m.body.slice(0, 80) });
          if (prefs.soundDm) playSound("dm");
          if (prefs.desktopNotify) desktopNotify(m.senderName, m.body.slice(0, 140));
        } else if (m.kind === "channel" && m.body.toLowerCase().includes(`@${me.name.toLowerCase()}`)) {
          pushNotification({ ...base, kind: "mention", extra: m.body.slice(0, 80) });
          if (prefs.soundMention) playSound("mention");
          if (prefs.desktopNotify) desktopNotify(m.senderName, m.body.slice(0, 140));
        }
      }),
      room.on("order", (m) => toast({ text: t("shop.preparing", { item: t(`item.${m.item}`) }) })),
      room.on("consumed", (m) =>
        toast({ text: t("shop.enjoy", { item: `${ITEMS[m.item].emoji} ${t(`item.${m.item}`)}` }) }),
      ),
      room.on("shopRejected", (m) => toast({ text: t(`shop.rejected.${m.reason}`), kind: "error" })),
      room.on("error", (code) => {
        if (code === "seatOccupied" || code === "seatTooFar")
          return toast({ text: t(`seat.${code === "seatOccupied" ? "occupied" : "tooFar"}`), kind: "error" });
        if (["rateLimited", "tooFar", "notRoomMaster", "badPin", "badVideo"].includes(code))
          toast({ text: t(`error.${code}`), kind: "error" });
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
  }, [room, media, t, locale, toast, refreshGroups, loadDetail, me.id, me.name]);

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

  // Karakter hidup (Fase 2): efek ringan saat bar hampir kosong; suara orang lain paling pelan 50%.
  const life = useLiveLife(snap);
  const effects = activeEffects(life, prefs.lifeEffects);
  useEffect(() => {
    media?.setLifeVolume(effects.volume);
  }, [media, effects.volume]);

  const openDm = (userId: string) => {
    setShowChat(true);
    setChatUnread(false);
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
      case "drink":
      case "cook":
        // Mesin penjual, kopi, dispenser, kulkas, dapur: buka menu bila fitur kebutuhan menyala.
        if (venueOf(obj) && snap.life?.settings.enabled) return setShop(obj);
        if (action === "drink") return toast({ text: t("action.drinkResult") });
        if (action === "cook") return toast({ text: t("action.cookResult") });
        return toast({ text: t("life.disabled") });
      case "read":
        room?.send({ t: "avatarAction", action: "read" });
        return toast({
          text: t("action.readingActive"),
        });
      case "watch":
        return obj.kind === "tv" ? setTv(obj) : toast({ text: t("action.watchResult") });
      case "play":
        return toast({
          text: t("action.minigameSoon"),
        });
    }
  };

  const selectPeer = (member: MemberInfo, presence?: Presence) => {
    setPeerCard({ member, presence });
  };
  const selfMember: MemberInfo = detail?.members.find((m) => m.id === me.id) ?? {
    id: me.id,
    name: me.name,
    avatar: me.avatar,
    role,
  };
  const card = peerCard
    ? (() => {
        const isSelf = peerCard.member.id === me.id;
        const presence = isSelf ? self : (snap.peers.get(peerCard.member.id) ?? peerCard.presence);
        return { isSelf, presence, busy: presence?.status === "busy" };
      })()
    : null;
  const isSelf = !!card?.isSelf;
  const presence = card?.presence;
  const busy = !!card?.busy;
  const close = () => setPeerCard(null);
  const walkToPresence = (p: Presence) => walkToRef.current?.({ x: p.x + 1, y: p.y });
  const zoneName = (p?: Presence) => {
    const z = p && snap.map ? zoneAt(snap.map, p.x, p.y) : null;
    return z ? t(z.label) : null;
  };

  const closeHeadMenu = useCallback(() => setHeadMenu(null), []);
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };

  const switchGroup = (id: string) => {
    setHome(false);
    setActiveId(id);
    setShowNav(false);
  };

  const onlineCount = snap.peers.size;
  const activeGroup = groups.find((g) => g.id === activeId);

  return (
    <div
      className={`app ${showNav ? "show-nav" : ""} ${showMembers ? "show-members" : ""} ${detail && !home ? "" : "no-members"} ${home ? "home" : ""}`}
    >
      <nav className="rail" aria-label={t("nav.groups")}>
        <button
          className="rail-item nav"
          aria-current={home}
          onClick={() => {
            setHome(true);
            setShowNav(false);
          }}
          title={t("nav.home")}
          aria-label={t("nav.home")}
        >
          <Icon name="home" size={22} />
        </button>
        <span className="rail-sep" />
        {!home && detail && (
          <div className="rail-actions">
            <button
              className="rail-item nav"
              aria-label={chatUnread ? `${t("nav.toggleChat")} · ${t("chat.unread")}` : t("nav.toggleChat")}
              title={t("nav.toggleChat")}
              aria-pressed={showChat}
              onClick={toggleChat}
            >
              <Icon name="chat" size={22} />
              {chatUnread && <span className="count-badge dot" aria-hidden="true" />}
            </button>
            {can(role, "manageGroup") && (
              <button
                className="rail-item nav"
                aria-label={t("nav.maps")}
                title={t("nav.maps")}
                onClick={() => {
                  closeDrawer();
                  openGroupSettings("room");
                }}
              >
                <Icon name="door" size={22} />
              </button>
            )}
            <button
              className="rail-item nav"
              aria-label={t("notes.title")}
              title={t("notes.title")}
              aria-pressed={!!notes}
              onClick={() => {
                closeDrawer();
                setNotes((v) => (v ? null : "shared"));
              }}
            >
              <Icon name="notes" size={22} />
            </button>
            <button
              className="rail-item nav"
              aria-label={t("members.title")}
              title={t("members.title")}
              aria-pressed={showMembers}
              onClick={() => {
                closeDrawer();
                setShowMembers((v) => !v);
              }}
            >
              <Icon name="users" size={22} />
            </button>
            {(["agenda", "task", "resource"] as const).map((v) => (
              <button
                className="rail-item nav"
                key={v}
                aria-label={t(`board.${v}`)}
                title={t(`board.${v}`)}
                onClick={() => {
                  setBoard(v);
                  setShowNav(false);
                }}
              >
                <Icon name={v === "agenda" ? "clock" : v === "task" ? "check" : "folder"} size={22} />
              </button>
            ))}
          </div>
        )}
        {groups.map((g) => (
          <button
            key={g.id}
            className="rail-item"
            aria-current={!home && g.id === activeId}
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
                    setShowChat(true);
                    setChatUnread(false);
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
          <button
            className="user-chip"
            onClick={() => setPeerCard({ member: selfMember, presence: self })}
            aria-label={t("pc.myProfile")}
            title={t("pc.myProfile")}
          >
            <span className="avatar-wrap">
              <AvatarCanvas avatar={me.avatar} size={34} face />
              <span className={`status-dot s-${self?.status ?? "offline"}`} />
            </span>
            <span className="who">
              <b>{me.name}</b>
              <span>{me.statusText ?? (self ? t(`status.${self.status}`) : t("status.offline"))}</span>
            </span>
          </button>
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
          <div className="app-brand">
            <Logo size={29} />
          </div>
          <button
            className="icon-btn"
            onClick={() => setShowNav((v) => !v)}
            aria-expanded={showNav}
            aria-label={t("nav.open")}
          >
            <Icon name="menu" />
          </button>
          <div className="head-title">
            <h2>{home || !activeId ? t("nav.home") : activeGroup ? activeGroup.name : "Meetopia"}</h2>
            {activeGroup && !home && (
              <span className="head-sub">
                <Icon name="door" size={13} /> {snap.map ? t(`tpl.${templateOf(snap.map)}`) : t("nav.office")}{" "}
                · {t("nav.inRoom", { n: onlineCount })}
              </span>
            )}
          </div>
          {!home && snap.map && (
            <div className="room-search">
              <label>
                <Icon name="search" size={18} />
                <input
                  value={zoneSearch}
                  onChange={(e) => setZoneSearch(e.target.value)}
                  placeholder={t("room.search")}
                  aria-label={t("room.search")}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setZoneSearch("");
                  }}
                />
              </label>
              {zoneSearch.trim() && (
                <div className="room-search-results">
                  {snap.map.zones
                    .filter((z) =>
                      t(z.label).toLocaleLowerCase().includes(zoneSearch.trim().toLocaleLowerCase()),
                    )
                    .map((z) => (
                      <button
                        key={z.id}
                        onClick={() => {
                          const target = nearestFree(buildWalkable(snap.map!), {
                            x: z.x + Math.floor(z.w / 2),
                            y: z.y + Math.floor(z.h / 2),
                          });
                          if (target) walkToRef.current?.(target);
                          setZoneSearch("");
                        }}
                      >
                        <Icon name={z.private ? "lock" : "pin"} size={14} />
                        {t(z.label)}
                      </button>
                    ))}
                  {!snap.map.zones.some((z) =>
                    t(z.label).toLocaleLowerCase().includes(zoneSearch.trim().toLocaleLowerCase()),
                  ) && <p>{t("room.searchEmpty")}</p>}
                </div>
              )}
            </div>
          )}
          {!home && activeId && (
            <button
              className="icon-btn"
              onClick={toggleChat}
              aria-label={chatUnread ? `${t("nav.toggleChat")} · ${t("chat.unread")}` : t("nav.toggleChat")}
              aria-pressed={showChat}
            >
              <Icon name="chat" />
              {chatUnread && <span className="count-badge dot" aria-hidden="true" />}
            </button>
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
          <div className="head-menu">
            <button
              className="icon-btn"
              onClick={() => setHeadMenu((m) => (m === "notifs" ? null : "notifs"))}
              aria-label={unreadNotifs ? t("notif.titleUnread", { n: unreadNotifs }) : t("notif.title")}
              aria-expanded={headMenu === "notifs"}
            >
              <Icon name="bell" />
              {unreadNotifs > 0 && <span className="count-badge">{Math.min(unreadNotifs, 9)}</span>}
            </button>
            {headMenu === "notifs" && (
              <Popover label={t("notif.title")} onClose={closeHeadMenu} className="notif-pop">
                <div className="pop-head">
                  <b>{t("notif.title")}</b>
                  <span className="spacer" />
                  {notifs.length > 0 && (
                    <button
                      className="btn ghost small"
                      onClick={unreadNotifs ? markAllRead : clearNotifications}
                    >
                      {unreadNotifs ? t("notif.markRead") : t("notif.clear")}
                    </button>
                  )}
                </div>
                {notifs.length === 0 ? (
                  <p className="hint pop-empty">{t("notif.empty")}</p>
                ) : (
                  <ul className="notif-list">
                    {notifs.map((n) => {
                      const m = detail?.members.find((x) => x.id === n.userId);
                      return (
                        <li key={n.id} data-unread={!n.read}>
                          {m ? (
                            <AvatarCanvas avatar={m.avatar} size={34} face />
                          ) : (
                            <span className="notif-icon" aria-hidden>
                              <Icon name="bell" size={16} />
                            </span>
                          )}
                          <span className="grow">
                            <span>
                              {t(`notif.${n.kind}`, { name: n.name, group: n.groupName })}
                              {n.extra && <span className="notif-extra">{n.extra}</span>}
                            </span>
                            <span className="hint">{timeAgo(n.at, locale)}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Popover>
            )}
          </div>
          <div className="head-menu">
            <button
              className="head-avatar"
              onClick={() => setHeadMenu((m) => (m === "profile" ? null : "profile"))}
              aria-label={t("pc.myProfile")}
              aria-expanded={headMenu === "profile"}
            >
              <span className="avatar-wrap">
                <AvatarCanvas avatar={me.avatar} size={32} face />
                <span className={`status-dot s-${self?.status ?? "offline"}`} />
              </span>
            </button>
            {headMenu === "profile" && (
              <Popover label={t("pc.myProfile")} onClose={closeHeadMenu} className="profile-pop">
                <div className="pp-head">
                  <AvatarCanvas avatar={me.avatar} size={44} face />
                  <span className="grow">
                    <b>{me.name}</b>
                    <span className="hint">
                      <span className={`status-dot inline s-${self?.status ?? "offline"}`} />{" "}
                      {me.statusText ?? t(`status.${self?.status ?? "offline"}`)}
                    </span>
                  </span>
                </div>
                {activeGroup && (
                  <div className="pp-role">
                    <span className="hint">{t("pc.role")}</span>
                    <span>
                      {t(`role.${role}`)} · {activeGroup.name}
                    </span>
                  </div>
                )}
                <div className="pp-items">
                  {(
                    [
                      ["smile", me.statusText ? "cs.edit" : "cs.set", () => setModal("status")],
                      ["edit", "pp.editProfile", () => openUserSettings("profile")],
                      ["user", "pp.changeAvatar", () => openUserSettings("profile")],
                      ["settings", "pp.settings", () => openUserSettings("appearance")],
                    ] as const
                  ).map(([icon, label, run]) => (
                    <button
                      key={label}
                      onClick={() => {
                        closeHeadMenu();
                        run();
                      }}
                    >
                      <Icon name={icon} size={16} />
                      <span className="grow">{t(label)}</span>
                      <Icon name="chevron" size={14} />
                    </button>
                  ))}
                  <button className="danger" onClick={() => void logout()}>
                    <Icon name="logout" size={16} />
                    <span className="grow">{t("auth.logout")}</span>
                  </button>
                </div>
              </Popover>
            )}
          </div>
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
        {home || !activeId ? (
          <WorkspacePicker
            groups={groups}
            activeId={activeId}
            avatar={me.avatar}
            onOpen={switchGroup}
            onCreate={() => setModal("create")}
            onJoin={() => setModal("join")}
            onBack={activeId ? () => setHome(false) : undefined}
          />
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
                life={prefs.showLifeHud ? life : null}
                effects={effects}
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
            {detail && showChat && (
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
      {modal === "join" && (
        <JoinWorkspace
          onClose={() => setModal(null)}
          onJoined={async (id) => {
            setModal(null);
            await refreshGroups();
            switchGroup(id);
          }}
        />
      )}
      {modal === "create" && (
        <CreateGroup
          onClose={() => setModal(null)}
          onCreated={async (id) => {
            setModal(null);
            await refreshGroups();
            switchGroup(id);
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
      {modal === "invites" && detail && (
        <InviteModal
          groupId={detail.group.id}
          groupName={detail.group.name}
          onClose={() => setModal(null)}
          onAdvanced={() => openGroupSettings("invites")}
        />
      )}
      {modal === "settings" && detail && (
        <GroupSettings
          detail={detail}
          selfId={me.id}
          initialTab={groupSection}
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
      {tv && room && <TvPanel room={room} snap={snap} obj={tv} role={role} onClose={() => setTv(null)} />}
      {shop && room && life && (
        <ShopPanel room={room} snap={snap} obj={shop} life={life} onClose={() => setShop(null)} />
      )}
      {speaker && room && (
        <SpeakerPanel room={room} snap={snap} obj={speaker} role={role} onClose={() => setSpeaker(null)} />
      )}
      {modal === "status" && <StatusEditor me={me} onClose={() => setModal(null)} onSaved={setMe} />}
      {board && activeId && (
        <WorkspaceBoard
          groupId={activeId}
          selfId={me.id}
          role={role}
          room={room}
          initial={board}
          onClose={() => setBoard(null)}
        />
      )}
      {peerCard && (
        <ProfileCard
          member={peerCard.member}
          presence={presence}
          isSelf={isSelf}
          statusText={isSelf ? me.statusText : (presence?.statusText ?? null)}
          location={zoneName(presence)}
          onClose={close}
        >
          {isSelf ? (
            <div className="pc-actions">
              <button
                className="btn secondary"
                onClick={() => {
                  close();
                  setModal("status");
                }}
              >
                <Icon name="smile" size={18} /> {me.statusText ? t("cs.edit") : t("cs.set")}
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  close();
                  openUserSettings("profile");
                }}
              >
                <Icon name="edit" size={18} /> {t("us.editAvatar")}
              </button>
            </div>
          ) : (
            <>
              <div className="pc-actions">
                <button
                  className="btn secondary"
                  onClick={() => {
                    openDm(peerCard.member.id);
                    close();
                  }}
                >
                  <Icon name="chat" size={18} /> {t("peer.message")}
                </button>
                {presence && (
                  <button
                    className="btn secondary"
                    onClick={() => {
                      walkToPresence(presence);
                      close();
                    }}
                  >
                    <Icon name="pin" size={18} /> {t("peer.walkTo")}
                  </button>
                )}
                {presence && !busy && (
                  <button
                    className="btn secondary"
                    onClick={() => {
                      room?.send({ t: "teleport", toUserId: peerCard.member.id });
                      close();
                    }}
                  >
                    <Icon name="teleport" size={18} /> {t("peer.teleport")}
                  </button>
                )}
                {busy && (
                  <button
                    className="btn"
                    onClick={() => {
                      room?.send({ t: "knock", toUserId: peerCard.member.id });
                      toast({ text: t("knock.sent") });
                      close();
                    }}
                  >
                    <Icon name="knock" size={18} /> {t("knock.knock")}
                  </button>
                )}
              </div>
              {busy && <p className="hint">{t("peer.busyHint")}</p>}
              {presence && room && (
                <div className="pc-actions" aria-label={t("pair.label")}>
                  {PAIRED_ACTIONS.map((action) => (
                    <button
                      className="btn secondary small"
                      key={action}
                      onClick={() => {
                        room.send({ t: "pairInvite", toUserId: presence.id, action });
                        close();
                      }}
                    >
                      {actionLabel(action, locale)}
                    </button>
                  ))}
                </div>
              )}
              {presence && (
                <div className="field pc-volume">
                  <label htmlFor="pc-vol">
                    {t("pc.volume")}: <b>{Math.round((prefs.peerVolumes[peerCard.member.id] ?? 1) * 100)}%</b>
                  </label>
                  <input
                    id="pc-vol"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={prefs.peerVolumes[peerCard.member.id] ?? 1}
                    onChange={(e) =>
                      setPrefs({
                        peerVolumes: {
                          ...prefs.peerVolumes,
                          [peerCard.member.id]: Number(e.target.value),
                        },
                      })
                    }
                  />
                  <span className="hint">{t("pc.volumeHint")}</span>
                </div>
              )}
            </>
          )}
        </ProfileCard>
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
