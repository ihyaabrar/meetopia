"use client";

import { useEffect, useState } from "react";
import type { RoomClient, RoomSnapshot } from "@/client/roomClient";
import { useT } from "@/i18n/client";
import { Modal } from "@/components/Modal";
import { distanceToObject, type MapObject } from "@/shared/map";
import { ITEMS, MENUS, NEED_KEYS, SHOP_RANGE, venueOf, type ItemId, type LifeState } from "@/shared/life";
import { Icon } from "@/components/Icon";
import { NEED_ICON, NeedBar } from "./LifeHud";

/**
 * Mesin penjual, mesin kopi, dispenser, kulkas, dan dapur/kantin (FR-51, FR-54, FR-55).
 * Harga, jarak, dan saldo diperiksa lagi di server; di sini hanya untuk tampilan.
 */
export function ShopPanel({
  room,
  snap,
  obj,
  life,
  onClose,
}: {
  room: RoomClient;
  snap: RoomSnapshot;
  obj: MapObject;
  life: LifeState;
  onClose: () => void;
}) {
  const t = useT();
  const venue = venueOf(obj);
  const self = snap.selfId ? snap.peers.get(snap.selfId) : undefined;
  const near = !!self && distanceToObject(obj, self.x, self.y) <= SHOP_RANGE;
  const [pending, setPending] = useState<{ item: ItemId; until: number; waitMs: number } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const offs = [
      room.on("order", (m) => {
        setSending(false);
        setPending({ item: m.item, waitMs: m.waitMs, until: Date.now() + m.waitMs });
      }),
      room.on("consumed", () => {
        setSending(false);
        setPending(null);
      }),
      room.on("shopRejected", () => {
        setSending(false);
        setPending(null);
      }),
    ];
    return () => offs.forEach((o) => o());
  }, [room]);

  if (!venue) return null;
  const menu = MENUS[venue];
  const buy = (item: ItemId) => {
    setSending(true);
    room.send({ t: "consume", objectId: obj.id, item });
  };

  return (
    <Modal title={t(obj.label ?? "object.vending")} sub={t(`shop.${venue}Hint`)} onClose={onClose}>
      <div className="shop-status">
        <div className="shop-needs">
          {NEED_KEYS.map((k) => (
            <NeedBar key={k} need={k} value={life.needs[k]} />
          ))}
        </div>
        <span className="coin-amt big">
          <Icon name="coin" size={17} /> {t("life.coins", { n: life.coins })}
        </span>
      </div>

      {!near && <p className="hint warn-text">{t("shop.tooFar")}</p>}
      {pending && (
        <div className="shop-pending" role="status">
          <span aria-hidden>{ITEMS[pending.item].emoji}</span>
          <span className="grow">{t("shop.preparing", { item: t(`item.${pending.item}`) })}</span>
          <span className="shop-progress" aria-hidden>
            <i style={{ animationDuration: `${pending.waitMs}ms` }} />
          </span>
        </div>
      )}

      <ul className="shop-list">
        {menu.map((e) => {
          const item = ITEMS[e.item];
          const short = life.coins < e.price;
          return (
            <li key={e.item} className="shop-item">
              <span className="shop-emoji" aria-hidden>
                {item.emoji}
              </span>
              <span className="grow">
                <b>{t(`item.${e.item}`)}</b>
                <span className="shop-effects">
                  {NEED_KEYS.filter((k) => item.effect[k]).map((k) => (
                    <span key={k} className="fx" data-neg={(item.effect[k] ?? 0) < 0}>
                      <Icon name={NEED_ICON[k]} size={12} label={t(`life.${k}`)} />
                      {(item.effect[k] ?? 0) > 0 ? "+" : ""}
                      {item.effect[k]}
                    </span>
                  ))}
                  {e.waitMs > 0 && (
                    <span className="fx wait">
                      <Icon name="clock" size={12} /> {t("shop.wait", { n: e.waitMs / 1000 })}
                    </span>
                  )}
                </span>
              </span>
              <span className="shop-price" data-free={e.price === 0}>
                {e.price === 0 ? t("shop.free") : t("shop.price", { n: e.price })}
              </span>
              <button
                className="btn small"
                disabled={!near || short || !!pending || sending}
                title={short ? t("shop.rejected.coins") : undefined}
                onClick={() => buy(e.item)}
              >
                {e.price === 0 ? t("shop.take") : e.waitMs > 0 ? t("shop.order") : t("shop.buy")}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hint">{t("shop.virtual")}</p>
    </Modal>
  );
}
