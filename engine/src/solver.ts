// 电工模拟器 · 电压模型求解器（规约 v2 §12）
// 复数（相量）节点电位分析：负载为额定电阻，导线/闭合触点已合并为节点，
// 电源极为固定电位（Dirichlet），高斯消元求未知节点电位。
// 图极小（教学电路 <50 节点），性能无虞。

export type Cx = { re: number; im: number };

export const cx = (re: number, im = 0): Cx => ({ re, im });
export const cadd = (a: Cx, b: Cx): Cx => ({ re: a.re + b.re, im: a.im + b.im });
export const csub = (a: Cx, b: Cx): Cx => ({ re: a.re - b.re, im: a.im - b.im });
export const cmul = (a: Cx, b: Cx): Cx => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
export const cdiv = (a: Cx, b: Cx): Cx => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
export const cabs = (a: Cx): number => Math.hypot(a.re, a.im);

// 相量：幅值 mag、相位 deg（度）
export const phasor = (mag: number, deg: number): Cx => ({
  re: mag * Math.cos((deg * Math.PI) / 180),
  im: mag * Math.sin((deg * Math.PI) / 180),
});

// 电导元件：两节点间的电阻（欧姆）
export interface RElem {
  a: string;
  b: string;
  ohms: number;
}

export interface SolveResult {
  volts: Map<string, Cx>;                 // 节点电位（含固定极）
  drop: (a: string, b: string) => number; // 两节点电压差幅值；未知节点按 0 处理
}

// fixed：固定电位节点（电源极）；elems：电阻元件。
// 返回全部涉及节点的电位；不与任何固定极连通的孤岛节点电位为 0（无定义）。
export function solveNetwork(fixed: Map<string, Cx>, elems: RElem[]): SolveResult {
  // 未知节点收集：出现在元件里且不是固定极的节点
  const unknown: string[] = [];
  const idx = new Map<string, number>();
  for (const e of elems) {
    for (const n of [e.a, e.b]) {
      if (!fixed.has(n) && !idx.has(n)) {
        idx.set(n, unknown.length);
        unknown.push(n);
      }
    }
  }

  const n = unknown.length;
  const volts = new Map<string, Cx>(fixed);

  if (n > 0) {
    // 节点导纳方程 G·V = I（复数），增广矩阵消元
    const A: Cx[][] = Array.from({ length: n }, () =>
      Array.from({ length: n + 1 }, () => cx(0)),
    );
    for (const e of elems) {
      const g = cx(1 / e.ohms);
      const ia = idx.get(e.a);
      const ib = idx.get(e.b);
      if (ia !== undefined) A[ia][ia] = cadd(A[ia][ia], g);
      if (ib !== undefined) A[ib][ib] = cadd(A[ib][ib], g);
      if (ia !== undefined && ib !== undefined) {
        A[ia][ib] = csub(A[ia][ib], g);
        A[ib][ia] = csub(A[ib][ia], g);
      }
      // 一端固定：把 g·V固定 挪到右侧电流项
      if (ia !== undefined && ib === undefined) {
        A[ia][n] = cadd(A[ia][n], cmul(g, fixed.get(e.b)!));
      }
      if (ib !== undefined && ia === undefined) {
        A[ib][n] = cadd(A[ib][n], cmul(g, fixed.get(e.a)!));
      }
    }
    // 完全悬空的节点（对角为 0）：钉在 0，避免奇异
    for (let i = 0; i < n; i++) {
      if (cabs(A[i][i]) < 1e-12) A[i][i] = cx(1);
    }
    // 高斯消元（按幅值部分主元）
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) {
        if (cabs(A[r][col]) > cabs(A[piv][col])) piv = r;
      }
      if (cabs(A[piv][col]) < 1e-12) continue;
      [A[col], A[piv]] = [A[piv], A[col]];
      for (let r = 0; r < n; r++) {
        if (r === col || cabs(A[r][col]) < 1e-15) continue;
        const f = cdiv(A[r][col], A[col][col]);
        for (let k = col; k <= n; k++) A[r][k] = csub(A[r][k], cmul(f, A[col][k]));
      }
    }
    for (let i = 0; i < n; i++) {
      volts.set(unknown[i], cabs(A[i][i]) < 1e-12 ? cx(0) : cdiv(A[i][n], A[i][i]));
    }
  }

  const drop = (a: string, b: string): number => {
    const va = volts.get(a);
    const vb = volts.get(b);
    if (!va || !vb) return 0;
    return cabs(csub(va, vb));
  };
  return { volts, drop };
}
