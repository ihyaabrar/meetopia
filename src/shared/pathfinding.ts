/**
 * Pencarian jalur A* di grid tile (FR-12). 8 arah, tanpa memotong sudut dinding.
 * Mengembalikan daftar tile (tanpa tile awal) dari start ke goal.
 */
export interface Point {
  x: number;
  y: number;
}

const DIRS: Array<[number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

function isFree(grid: boolean[][], x: number, y: number): boolean {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length && grid[y][x];
}

/** Tile bisa-dilewati terdekat ke target (BFS), dipakai bila pengguna mengetuk dinding atau objek. */
export function nearestFree(grid: boolean[][], target: Point, blocked?: (p: Point) => boolean): Point | null {
  const tx = Math.max(0, Math.min(grid[0].length - 1, Math.floor(target.x)));
  const ty = Math.max(0, Math.min(grid.length - 1, Math.floor(target.y)));
  const ok = (x: number, y: number) => isFree(grid, x, y) && !(blocked && blocked({ x, y }));
  if (ok(tx, ty)) return { x: tx, y: ty };
  const seen = new Set<number>([ty * 10000 + tx]);
  const queue: Point[] = [{ x: tx, y: ty }];
  while (queue.length) {
    const p = queue.shift()!;
    for (const [dx, dy] of DIRS) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (nx < 0 || ny < 0 || ny >= grid.length || nx >= grid[0].length) continue;
      const k = ny * 10000 + nx;
      if (seen.has(k)) continue;
      seen.add(k);
      if (ok(nx, ny)) return { x: nx, y: ny };
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

export function findPath(
  grid: boolean[][],
  start: Point,
  goal: Point,
  blocked?: (p: Point) => boolean,
): Point[] | null {
  const W = grid[0].length;
  const sx = Math.floor(start.x);
  const sy = Math.floor(start.y);
  const gx = Math.floor(goal.x);
  const gy = Math.floor(goal.y);
  const free = (x: number, y: number) => isFree(grid, x, y) && !(blocked && blocked({ x, y }));
  if (!free(gx, gy)) return null;
  if (sx === gx && sy === gy) return [];

  const key = (x: number, y: number) => y * W + x;
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - gx);
    const dy = Math.abs(y - gy);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  const gScore = new Map<number, number>([[key(sx, sy), 0]]);
  const came = new Map<number, number>();
  const closed = new Set<number>();
  // Heap biner sederhana [f, key]
  const heap: Array<[number, number]> = [[h(sx, sy), key(sx, sy)]];
  const push = (item: [number, number]) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };

  const goalKey = key(gx, gy);
  while (heap.length) {
    const [, k] = pop();
    if (k === goalKey) {
      const path: Point[] = [];
      let c: number | undefined = k;
      while (c !== undefined && c !== key(sx, sy)) {
        path.push({ x: c % W, y: Math.floor(c / W) });
        c = came.get(c);
      }
      return path.reverse();
    }
    if (closed.has(k)) continue;
    closed.add(k);
    const x = k % W;
    const y = Math.floor(k / W);
    for (const [dx, dy, cost] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!free(nx, ny)) continue;
      // Jangan memotong sudut: langkah diagonal butuh kedua tile tetangga bebas.
      if (dx !== 0 && dy !== 0 && (!free(x + dx, y) || !free(x, y + dy))) continue;
      const nk = key(nx, ny);
      const tentative = (gScore.get(k) ?? Infinity) + cost;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentative);
        came.set(nk, k);
        push([tentative + h(nx, ny), nk]);
      }
    }
  }
  return null;
}
