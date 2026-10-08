import { describe, it, expect, vi } from "vitest";
import { OrderedQueue } from "@/realtime/ordered-queue";

describe("websocket command order", () => {
  it("waits for asynchronous standing before moving and inviting", async () => {
    const order: string[] = [],
      error = vi.fn();
    let finish!: () => void;
    const waiting = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const q = new OrderedQueue(error);
    q.enqueue(async () => {
      order.push("stand:start");
      await waiting;
      order.push("stand:end");
    });
    q.enqueue(async () => {
      order.push("move");
    });
    q.enqueue(async () => {
      order.push("invite");
    });
    await Promise.resolve();
    expect(order).toEqual(["stand:start"]);
    finish();
    await q.drain();
    expect(order).toEqual(["stand:start", "stand:end", "move", "invite"]);
    expect(error).not.toHaveBeenCalled();
  });
  it("continues after an error and bounds pending work", async () => {
    const error = vi.fn(),
      done = vi.fn();
    const q = new OrderedQueue(error, 2);
    expect(
      q.enqueue(async () => {
        throw new Error("failed");
      }),
    ).toBe(true);
    expect(
      q.enqueue(async () => {
        done();
      }),
    ).toBe(true);
    expect(q.enqueue(async () => {})).toBe(false);
    await q.drain();
    expect(error).toHaveBeenCalledOnce();
    expect(done).toHaveBeenCalledOnce();
    expect(q.enqueue(async () => {})).toBe(true);
    await q.drain();
  });
});
