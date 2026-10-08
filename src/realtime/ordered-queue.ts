/** Keep websocket commands in arrival order, including asynchronous seat/position writes. */
export class OrderedQueue {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  constructor(
    private readonly onError: (error: unknown) => void,
    private readonly capacity = 128,
  ) {}

  enqueue(run: () => Promise<void>): boolean {
    if (this.pending >= this.capacity) return false;
    this.pending++;
    this.tail = this.tail
      .then(run)
      .catch(this.onError)
      .finally(() => {
        this.pending--;
      });
    return true;
  }

  drain(): Promise<void> {
    return this.tail;
  }
}
