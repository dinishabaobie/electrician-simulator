// 正交绕障布线：在非均匀网格上做 A* 寻路。
// 网格坐标取自：障碍（元件）边界 ±INFLATE、端子所在行/列、相邻坐标的中点
// （给平行线提供备用车道）。代价设计：
//   - 拐弯加价 → 偏好笔直、少弯；
//   - 与已布线「同向共用一段」加价 → 后布的线自动换到相邻车道，
//     十字交叉不罚（电气图里交叉不代表相连）。
// 输出圆角直角折线的 SVG path；找不到路时返回 undefined，由边组件回退平滑折线。

export type Side = 'left' | 'right' | 'top' | 'bottom';
export interface Port { x: number; y: number; side: Side }
export interface Rect { x: number; y: number; w: number; h: number }
export interface RouteReq { id: string; from: Port; to: Port }
export interface Pt { x: number; y: number }
export interface Route { d: string; points: Pt[] }

const INFLATE = 12;    // 障碍外扩：线离元件边至少这么远
const TURN_COST = 40;  // 拐一次弯 ≈ 多走 40px
const SHARE_COST = 90; // 与已有线同向共用一段的代价（× 已占用次数）
const RADIUS = 5;      // 拐角圆角半径
const EPS = 0.75;      // 坐标合并容差

const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];
const SIDE_TO_DIR: Record<Side, number> = { right: 0, left: 1, bottom: 2, top: 3 };

function uniqSorted(vals: number[]): number[] {
  vals.sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of vals) if (!out.length || v - out[out.length - 1] > EPS) out.push(v);
  return out;
}

// 相邻坐标间插中点，平行线才有相邻车道可换
function withMidpoints(vals: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < vals.length; i++) {
    if (i) out.push((vals[i - 1] + vals[i]) / 2);
    out.push(vals[i]);
  }
  return out;
}

// 最小二叉堆：[代价, 状态] 对
class Heap {
  private a: Array<[number, number]> = [];
  get size() { return this.a.length; }
  push(cost: number, v: number) {
    const a = this.a;
    a.push([cost, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export function routeAll(reqs: RouteReq[], obstacles: Rect[]): Map<string, Route> {
  const out = new Map<string, Route>();
  if (!reqs.length) return out;

  // ---- 网格坐标 ----
  const xsRaw: number[] = [];
  const ysRaw: number[] = [];
  for (const r of obstacles) {
    xsRaw.push(r.x - INFLATE, r.x + r.w + INFLATE);
    ysRaw.push(r.y - INFLATE, r.y + r.h + INFLATE);
  }
  for (const q of reqs) {
    for (const p of [q.from, q.to]) {
      if (p.side === 'left' || p.side === 'right') ysRaw.push(p.y);
      else xsRaw.push(p.x);
    }
  }
  const pad = 48; // 外圈留白，允许从最外侧绕行
  xsRaw.push(Math.min(...xsRaw) - pad, Math.max(...xsRaw) + pad);
  ysRaw.push(Math.min(...ysRaw) - pad, Math.max(...ysRaw) + pad);

  const xs = withMidpoints(uniqSorted(xsRaw));
  const ys = withMidpoints(uniqSorted(ysRaw));
  const W = xs.length;
  const H = ys.length;

  const inside = (x: number, y: number) =>
    obstacles.some(
      (r) =>
        x > r.x - INFLATE + EPS && x < r.x + r.w + INFLATE - EPS &&
        y > r.y - INFLATE + EPS && y < r.y + r.h + INFLATE - EPS,
    );

  const blocked = new Uint8Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++)
      if (inside(xs[i], ys[j])) blocked[j * W + i] = 1;

  // 段占用计数（同向才罚）。key：横段 j*W+min(i)，纵段同理
  const usedH = new Map<number, number>();
  const usedV = new Map<number, number>();

  const nearestIdx = (arr: number[], v: number): number => {
    let lo = 0;
    let hi = arr.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (arr[m] < v) lo = m + 1;
      else hi = m;
    }
    if (lo > 0 && Math.abs(arr[lo - 1] - v) < Math.abs(arr[lo] - v)) return lo - 1;
    return lo;
  };
  const firstGE = (arr: number[], v: number): number => {
    let i = nearestIdx(arr, v);
    while (i < arr.length && arr[i] < v - EPS) i++;
    return i;
  };
  const lastLE = (arr: number[], v: number): number => {
    let i = nearestIdx(arr, v);
    while (i >= 0 && arr[i] > v + EPS) i--;
    return i;
  };

  // 端子出线点：沿端子朝向跨出 INFLATE，落到最近的未被占的网格点
  const escape = (p: Port): [number, number] | null => {
    if (p.side === 'left' || p.side === 'right') {
      const j = nearestIdx(ys, p.y);
      let i = p.side === 'right' ? firstGE(xs, p.x + INFLATE - EPS) : lastLE(xs, p.x - INFLATE + EPS);
      const step = p.side === 'right' ? 1 : -1;
      for (let k = 0; k < 8 && i >= 0 && i < W; k++, i += step)
        if (!blocked[j * W + i]) return [i, j];
      return null;
    }
    const i = nearestIdx(xs, p.x);
    let j = p.side === 'bottom' ? firstGE(ys, p.y + INFLATE - EPS) : lastLE(ys, p.y - INFLATE + EPS);
    const step = p.side === 'bottom' ? 1 : -1;
    for (let k = 0; k < 8 && j >= 0 && j < H; k++, j += step)
      if (!blocked[j * W + i]) return [i, j];
    return null;
  };

  // 横/纵移动一段的占用键
  const hKey = (i: number, j: number) => j * W + i; // (i,j)→(i+1,j)
  const vKey = (i: number, j: number) => j * W + i; // (i,j)→(i,j+1)
  const shareOf = (i: number, j: number, dir: number): number => {
    if (dir === 0) return usedH.get(hKey(i, j)) ?? 0;
    if (dir === 1) return usedH.get(hKey(i - 1, j)) ?? 0;
    if (dir === 2) return usedV.get(vKey(i, j)) ?? 0;
    return usedV.get(vKey(i, j - 1)) ?? 0;
  };
  const markSeg = (a: [number, number], b: [number, number]) => {
    if (a[1] === b[1]) {
      const key = hKey(Math.min(a[0], b[0]), a[1]);
      usedH.set(key, (usedH.get(key) ?? 0) + 1);
    } else {
      const key = vKey(a[0], Math.min(a[1], b[1]));
      usedV.set(key, (usedV.get(key) ?? 0) + 1);
    }
  };

  const astar = (
    si: number, sj: number, sdir: number,
    ti: number, tj: number,
  ): Array<[number, number]> | null => {
    const stateOf = (i: number, j: number, d: number) => (j * W + i) * 4 + d;
    const g = new Map<number, number>();
    const parent = new Map<number, number>();
    const heur = (i: number, j: number) => Math.abs(xs[i] - xs[ti]) + Math.abs(ys[j] - ys[tj]);
    const heap = new Heap();
    const s0 = stateOf(si, sj, sdir);
    g.set(s0, 0);
    heap.push(heur(si, sj), s0);

    while (heap.size) {
      const [, st] = heap.pop();
      const d = st & 3;
      const cell = st >> 2;
      const i = cell % W;
      const j = (cell / W) | 0;
      if (i === ti && j === tj) {
        // 回溯
        const pts: Array<[number, number]> = [];
        let cur: number | undefined = st;
        let prevCell = -1;
        while (cur !== undefined) {
          const c = cur >> 2;
          if (c !== prevCell) {
            pts.push([c % W, (c / W) | 0]);
            prevCell = c;
          }
          cur = parent.get(cur);
        }
        pts.reverse();
        return pts;
      }
      const gc = g.get(st)!;
      for (let nd = 0; nd < 4; nd++) {
        const ni = i + DX[nd];
        const nj = j + DY[nd];
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        if (blocked[nj * W + ni]) continue;
        // 相邻坐标可能横跨窄元件：段中点也要在障碍外
        const mx = (xs[i] + xs[ni]) / 2;
        const my = (ys[j] + ys[nj]) / 2;
        if (inside(mx, my)) continue;
        const dist = Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]);
        const cost =
          gc + dist +
          (nd !== d ? TURN_COST : 0) +
          shareOf(i, j, nd) * SHARE_COST;
        const ns = stateOf(ni, nj, nd);
        if (cost < (g.get(ns) ?? Infinity)) {
          g.set(ns, cost);
          parent.set(ns, st);
          heap.push(cost + heur(ni, nj), ns);
        }
      }
    }
    return null;
  };

  // ---- 逐条布线（先布的线占道，后布的自动分道）----
  for (const q of reqs) {
    const e1 = escape(q.from);
    const e2 = escape(q.to);
    if (!e1 || !e2) continue;
    let grid: Array<[number, number]> | null;
    if (e1[0] === e2[0] && e1[1] === e2[1]) grid = [e1];
    else grid = astar(e1[0], e1[1], SIDE_TO_DIR[q.from.side], e2[0], e2[1]);
    if (!grid) continue;
    for (let k = 1; k < grid.length; k++) markSeg(grid[k - 1], grid[k]);

    const pts: Pt[] = [
      { x: q.from.x, y: q.from.y },
      ...grid.map(([i, j]) => ({ x: xs[i], y: ys[j] })),
      { x: q.to.x, y: q.to.y },
    ];
    snapEnds(pts);
    const clean = simplify(pts);
    out.set(q.id, { d: svgPath(clean), points: clean });
  }
  return out;
}

// 端子行/列坐标在合并网格时可能被挪动 <EPS：把首尾相邻点吸回端子的行/列，
// 消除亚像素小台阶（端点本身必须精确落在端子上）。
function snapEnds(pts: Pt[]) {
  if (pts.length < 2) return;
  const snap = (fixed: Pt, p: Pt) => {
    if (Math.abs(p.x - fixed.x) < 1.5) p.x = fixed.x;
    if (Math.abs(p.y - fixed.y) < 1.5) p.y = fixed.y;
  };
  snap(pts[0], pts[1]);
  snap(pts[pts.length - 1], pts[pts.length - 2]);
}

function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const a = out[out.length - 2];
    const b = out[out.length - 1];
    if (b && Math.abs(b.x - p.x) < 0.05 && Math.abs(b.y - p.y) < 0.05) continue; // 重复点
    if (a && b) {
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      if (Math.abs(cross) < 0.5) { out[out.length - 1] = p; continue; } // 共线合并
    }
    out.push(p);
  }
  return out;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

// 直角折线 → 带小圆角的 SVG path
function svgPath(pts: Pt[]): string {
  if (!pts.length) return '';
  let d = `M ${r2(pts[0].x)} ${r2(pts[0].y)}`;
  const toward = (from: Pt, to: Pt, dist: number): Pt => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.abs(dx) + Math.abs(dy) || 1;
    return { x: from.x + (dx / len) * dist, y: from.y + (dy / len) * dist };
  };
  for (let k = 1; k < pts.length - 1; k++) {
    const a = pts[k - 1];
    const p = pts[k];
    const b = pts[k + 1];
    const lenA = Math.abs(p.x - a.x) + Math.abs(p.y - a.y);
    const lenB = Math.abs(b.x - p.x) + Math.abs(b.y - p.y);
    const r = Math.min(RADIUS, lenA / 2, lenB / 2);
    if (r < 0.5) {
      d += ` L ${r2(p.x)} ${r2(p.y)}`;
      continue;
    }
    const pin = toward(p, a, r);
    const pout = toward(p, b, r);
    d += ` L ${r2(pin.x)} ${r2(pin.y)} Q ${r2(p.x)} ${r2(p.y)} ${r2(pout.x)} ${r2(pout.y)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${r2(last.x)} ${r2(last.y)}`;
  return d;
}
