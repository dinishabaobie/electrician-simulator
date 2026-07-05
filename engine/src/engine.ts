// 电工模拟器 · 模拟引擎
// 实现《电路连通性判定规约》§2~§8。
// 第一版：状态模拟，不做物理量计算。

import type {
  Circuit,
  Component,
  NodeId,
  SimResult,
  SimComponentOut,
  CheckError,
  Expected,
} from './types.ts';
import { cx, phasor, solveNetwork, type Cx, type RElem } from './solver.ts';

// ----------------------------------------------------------------------------
// §2.1 并查集（Union-Find），把 pin 合并成电气节点
// ----------------------------------------------------------------------------

class DSU {
  private parent = new Map<string, string>();
  find(x: string): string {
    const p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

const pin = (compId: string, term: string): string => `${compId}#${term}`;

function buildNodes(c: Circuit): DSU {
  const dsu = new DSU();
  for (const comp of c.components) {
    for (const t of comp.terminals) dsu.find(pin(comp.id, t.id));
  }
  for (const w of c.wires) {
    const a = pin(w.from.componentId, w.from.terminal);
    const b = pin(w.to.componentId, w.to.terminal);
    if (a === b) continue; // §10 自环：丢弃
    dsu.union(a, b);
  }
  return dsu;
}

const nodeOf = (dsu: DSU, compId: string, term: string): NodeId =>
  dsu.find(pin(compId, term));

// ----------------------------------------------------------------------------
// §2.2 / §3 元件导通 → 图的边
// ----------------------------------------------------------------------------

interface Edge {
  a: NodeId;
  b: NodeId;
  isLoad: boolean;
  owner: string; // 产生这条边的元件 id（§5.2 判负载工作时要剔除自身的边）
}

// bestCase=true：把所有可操作元件（开关/按钮/触点）都视为导通，用于结构性
// 断路检查——「无论怎么操作都成不了回路」才算接线错误。真实故障态
// （熔断/热继动作）不参与放宽，它们造成的断路本来就该报。
function componentEdges(
  comp: Component,
  dsu: DSU,
  coilEnergized: Map<string, boolean>,
  bestCase = false,
): Edge[] {
  const n = (t: string) => nodeOf(dsu, comp.id, t);
  const edge = (a: NodeId, b: NodeId, isLoad: boolean): Edge =>
    ({ a, b, isLoad, owner: comp.id });
  const coilOn = comp.groupId ? !!coilEnergized.get(comp.groupId) : false;

  switch (comp.type) {
    case 'switch':
      return bestCase || comp.state.closed ? [edge(n('in'), n('out'), false)] : [];
    case 'breaker':
      return bestCase || comp.state.closed
        ? [edge(n('in_L'), n('out_L'), false), edge(n('in_N'), n('out_N'), false)]
        : [];
    case 'breaker3':
      // 三相空开：合闸三极同时导通，分闸同时断开
      return bestCase || comp.state.closed
        ? [
            edge(n('in_L1'), n('out_L1'), false),
            edge(n('in_L2'), n('out_L2'), false),
            edge(n('in_L3'), n('out_L3'), false),
          ]
        : [];
    case 'button_no':
      return bestCase || comp.state.pressed ? [edge(n('in'), n('out'), false)] : [];
    case 'button_nc':
      return bestCase || !comp.state.pressed ? [edge(n('in'), n('out'), false)] : [];
    case 'fuse':
      return !comp.state.blown ? [edge(n('in'), n('out'), false)] : [];
    case 'thermal_main':
      // 三相热元件（与主触点同为三对端子）：正常导通，过载动作后三相一起断开
      return !comp.state.tripped
        ? [
            edge(n('L1'), n('T1'), false),
            edge(n('L2'), n('T2'), false),
            edge(n('L3'), n('T3'), false),
          ]
        : [];
    case 'thermal_nc':
      return !comp.state.tripped ? [edge(n('in'), n('out'), false)] : [];
    case 'contactor_no':
      return bestCase || coilOn ? [edge(n('in'), n('out'), false)] : [];
    case 'contactor_nc':
      return bestCase || !coilOn ? [edge(n('in'), n('out'), false)] : [];
    case 'contactor_main':
      return bestCase || coilOn
        ? [
            edge(n('L1'), n('T1'), false),
            edge(n('L2'), n('T2'), false),
            edge(n('L3'), n('T3'), false),
          ]
        : [];
    case 'contactor_coil':
      return [edge(n('A1'), n('A2'), true)]; // 线圈始终连续，是负载边
    case 'lamp':
    case 'indicator':
      return [edge(n('L'), n('N'), true)];
    case 'motor':
      return []; // 三相电机不桥接相，单独判定（§5.4）
    case 'ammeter':
      return [edge(n('in'), n('out'), false)]; // 近似 0Ω 串联，参与导通
    case 'timer_coil':
      return [edge(n('7'), n('8'), true)]; // 时间继电器本体：负载边（同线圈）
    case 'timer_no':
      // 通电延时闭合：延时到（closed，由 UI 计时驱动）才导通；断电由 UI 复位
      return bestCase || comp.state.closed ? [edge(n('in'), n('out'), false)] : [];
    case 'terminal_block':
      // 端子排：五对恒直通
      return ['L1', 'L2', 'L3', 'N', 'PE'].map((t) =>
        edge(n(`in_${t}`), n(`out_${t}`), false),
      );
    case 'earth':
      return []; // 接地符号：装饰，单端子无边
    case 'voltmeter':
      return []; // 跨接开路（内阻极大）
    case 'transformer3':
    case 'rectifier3':
    case 'dc_motor':
      return []; // 不桥接端子；激活/工作由 §12 电压域单独判定
    default:
      return []; // 电源：不是边，是极
  }
}

// ----------------------------------------------------------------------------
// §5.1 电源极
// ----------------------------------------------------------------------------

interface Pole {
  node: NodeId;
  potential: string; // 'L' | 'N' | 'L1'… | 派生：'{id}.R1' / '{id}.DC+' 等
  volt: Cx;          // 该极的电位相量（§12 电压模型）
}

// 三相域：三个相电位标签 + 线电压。电机运行与转换器（变压器/整流器）
// 激活都按「端子分别接到某一个域的三个相」判定。
interface Domain {
  pots: [string, string, string];
  vll: number;
}

// 回流极（电位参考侧）：零线 N 与直流负极
const isReturnPot = (pot: string): boolean => pot === 'N' || pot.endsWith('.DC-');

function basePoles(c: Circuit, dsu: DSU): { ps: Pole[]; domains: Domain[] } {
  const ps: Pole[] = [];
  const domains: Domain[] = [];
  let has3ph = false;
  for (const comp of c.components) {
    if (comp.type === 'single_phase_power' && comp.state.on) {
      ps.push({ node: nodeOf(dsu, comp.id, 'L'), potential: 'L', volt: phasor(220, 0) });
      ps.push({ node: nodeOf(dsu, comp.id, 'N'), potential: 'N', volt: cx(0) });
    }
    if (comp.type === 'three_phase_power' && comp.state.on) {
      ps.push({ node: nodeOf(dsu, comp.id, 'L1'), potential: 'L1', volt: phasor(220, 0) });
      ps.push({ node: nodeOf(dsu, comp.id, 'L2'), potential: 'L2', volt: phasor(220, -120) });
      ps.push({ node: nodeOf(dsu, comp.id, 'L3'), potential: 'L3', volt: phasor(220, 120) });
      ps.push({ node: nodeOf(dsu, comp.id, 'N'), potential: 'N', volt: cx(0) });
      has3ph = true;
    }
  }
  if (has3ph) domains.push({ pots: ['L1', 'L2', 'L3'], vll: 380 });
  return { ps, domains };
}

// ----------------------------------------------------------------------------
// 图遍历
// ----------------------------------------------------------------------------

type Adj = Map<NodeId, NodeId[]>;

function adjacency(edges: Edge[], includeLoad: boolean): Adj {
  const adj: Adj = new Map();
  const add = (a: NodeId, b: NodeId) => {
    const l = adj.get(a);
    if (l) l.push(b);
    else adj.set(a, [b]);
  };
  for (const e of edges) {
    if (!includeLoad && e.isLoad) continue;
    add(e.a, e.b);
    add(e.b, e.a);
  }
  return adj;
}

// stop：吸收节点集合——遍历遇到即截断，既不进入结果集也不向外扩散。
// 用于电位钳制：零线排等极节点的电位被电源钳住，火线经负载到达零线排后，
// 那里已是“另一种电位”，不能算火线可达、更不能再倒灌出去（起点不受限）。
function bfs(starts: NodeId[], adj: Adj, stop?: Set<NodeId>): Set<NodeId> {
  const seen = new Set<NodeId>(starts);
  const q = [...starts];
  while (q.length) {
    const x = q.shift() as NodeId;
    for (const y of adj.get(x) ?? []) {
      if (seen.has(y) || stop?.has(y)) continue;
      seen.add(y);
      q.push(y);
    }
  }
  return seen;
}

// 电源极吸收集：所有“电位不属于 allowed”的极节点
function poleStops(ps: Pole[], allowed: (pot: string) => boolean): Set<NodeId> {
  return new Set(ps.filter((p) => !allowed(p.potential)).map((p) => p.node));
}

function connected(a: NodeId, b: NodeId, adj: Adj): boolean {
  if (a === b) return true;
  return bfs([a], adj).has(b);
}

// ----------------------------------------------------------------------------
// §12 电压域级联：变压器/整流器的一次侧接到某个三相域的三个相 → 激活，
// 二次侧端子成为新的电源极（新域）。变压器抽头 → 两个低压三相域；
// 整流器 → 直流域（DC+ = 1.35 × 供电域线电压）。级联最多迭代 4 层。
// bestCase=true 用于结构性检查：全部转换器视为已激活（额定电位）。
// ----------------------------------------------------------------------------

function derivePoles(
  c: Circuit,
  dsu: DSU,
  adj: Adj,
  ps: Pole[],
  domains: Domain[],
  bestCase = false,
): void {
  const reach = (pot: string): Set<NodeId> =>
    bfs(
      ps.filter((p) => p.potential === pot).map((p) => p.node),
      adj,
      poleStops(ps, (x) => x === pot),
    );
  const fedBy = (t: NodeId[]): Domain | undefined =>
    domains.find((d) => {
      const rs = d.pots.map((pot) => reach(pot));
      return PERMS.some((perm) => t.every((node, i) => rs[perm[i]].has(node)));
    });

  const done = new Set<string>();
  for (let iter = 0; iter < 4; iter++) {
    let changed = false;
    for (const comp of c.components) {
      if (done.has(comp.id)) continue;
      if (comp.type !== 'transformer3' && comp.type !== 'rectifier3') continue;
      const t = ['L1', 'L2', 'L3'].map((x) => nodeOf(dsu, comp.id, x));
      const feed = bestCase ? domains[0] : fedBy(t);
      if (!feed && !bestCase) continue;
      done.add(comp.id);
      changed = true;
      if (comp.type === 'transformer3') {
        const tv = comp.rules?.tapVolts ?? [60, 45, 30];
        const groups = [
          ['R1', 'S1', 'T1'],
          ['R2', 'S2', 'T2'],
          ['R3', 'S3', 'T3'],
        ];
        const taps: Array<[string[], number]> = groups
          .slice(0, tv.length)
          .map((terms, i) => [terms, tv[i]]);
        for (const [terms, vll] of taps) {
          const pots = terms.map((tm) => `${comp.id}.${tm}`) as [string, string, string];
          terms.forEach((tm, i) => {
            ps.push({
              node: nodeOf(dsu, comp.id, tm),
              potential: `${comp.id}.${tm}`,
              volt: phasor(vll / Math.sqrt(3), [0, -120, 120][i]),
            });
          });
          domains.push({ pots, vll });
        }
      } else {
        const vdc = Math.round(1.35 * (feed?.vll ?? 380) * 10) / 10;
        ps.push({ node: nodeOf(dsu, comp.id, 'DC+'), potential: `${comp.id}.DC+`, volt: cx(vdc) });
        ps.push({ node: nodeOf(dsu, comp.id, 'DC-'), potential: `${comp.id}.DC-`, volt: cx(0) });
      }
    }
    if (!changed) break;
  }
}

// ----------------------------------------------------------------------------
// §5.2 负载工作判定（Menger）：负载两端 a、b 到火线极与零线极是否存在
// 两条顶点不相交的路径（极性不限，一端到火线一端到零线）。
// 单纯的可达集会被“电流倒穿负载”骗过（共零线排、经断路器隔出的零线母线
// 等场景）；顶点不相交等价于图上存在一条经过该负载的简单回路，与物理一致。
// 实现：拆点法节点容量 1 + 最大流，流量到 2 即工作。
// ----------------------------------------------------------------------------

function pairPowered(
  edges: Edge[], // 调用方需已剔除该负载自身的边
  a: NodeId,
  b: NodeId,
  hotNodes: NodeId[],
  nNodes: NodeId[],
): boolean {
  if (hotNodes.length === 0 || nNodes.length === 0 || a === b) return false;
  // 残量网络：拆点 v-（入）→ v+（出）容量 1；无向边双向容量 1；
  // 源 S → a-、b-；火线极+ → H、零线极+ → Z；H→T、Z→T 各容量 1。
  const cap = new Map<string, Map<string, number>>();
  const arc = (u: string, v: string, c: number) => {
    let m = cap.get(u);
    if (!m) cap.set(u, (m = new Map()));
    m.set(v, (m.get(v) ?? 0) + c);
    let r = cap.get(v);
    if (!r) cap.set(v, (r = new Map()));
    if (!r.has(u)) r.set(u, 0);
  };
  const nodes = new Set<NodeId>([a, b, ...hotNodes, ...nNodes]);
  for (const e of edges) {
    nodes.add(e.a);
    nodes.add(e.b);
  }
  for (const v of nodes) arc(`${v}-`, `${v}+`, 1);
  for (const e of edges) {
    arc(`${e.a}+`, `${e.b}-`, 1);
    arc(`${e.b}+`, `${e.a}-`, 1);
  }
  arc('S', `${a}-`, 1);
  arc('S', `${b}-`, 1);
  for (const p of new Set(hotNodes)) arc(`${p}+`, 'H', 1);
  for (const p of new Set(nNodes)) arc(`${p}+`, 'Z', 1);
  arc('H', 'T', 1);
  arc('Z', 'T', 1);

  // Edmonds–Karp：最多增广两次
  let flow = 0;
  for (let i = 0; i < 2; i++) {
    const prev = new Map<string, string>();
    prev.set('S', 'S');
    const q = ['S'];
    while (q.length && !prev.has('T')) {
      const u = q.shift() as string;
      for (const [v, c] of cap.get(u) ?? []) {
        if (c > 0 && !prev.has(v)) {
          prev.set(v, u);
          q.push(v);
        }
      }
    }
    if (!prev.has('T')) break;
    let v = 'T';
    while (v !== 'S') {
      const u = prev.get(v) as string;
      cap.get(u)!.set(v, cap.get(u)!.get(v)! - 1);
      cap.get(v)!.set(u, (cap.get(v)!.get(u) ?? 0) + 1);
      v = u;
    }
    flow++;
  }
  return flow >= 2;
}

// ----------------------------------------------------------------------------
// §2 单轮计算
// ----------------------------------------------------------------------------

interface Step {
  edges: Edge[];
  adjAll: Adj;
  ps: Pole[];
  domains: Domain[];
  reachHot: Set<NodeId>;
  reachN: Set<NodeId>;
  newCoil: Map<string, boolean>;
}

function step(c: Circuit, dsu: DSU, coil: Map<string, boolean>): Step {
  const edges = c.components.flatMap((comp) => componentEdges(comp, dsu, coil));
  const adjAll = adjacency(edges, true);
  const { ps, domains } = basePoles(c, dsu);
  derivePoles(c, dsu, adjAll, ps, domains); // §12 变压器/整流器级联出新极

  const hotNodes = ps.filter((p) => !isReturnPot(p.potential)).map((p) => p.node);
  const nNodes = ps.filter((p) => isReturnPot(p.potential)).map((p) => p.node);
  const stopAtN = poleStops(ps, (pot) => !isReturnPot(pot));
  const stopAtHot = poleStops(ps, (pot) => isReturnPot(pot));
  const reachHot = bfs(hotNodes, adjAll, stopAtN);
  const reachN = bfs(nNodes, adjAll, stopAtHot);

  // §5.2 重新判定各线圈是否得电：剔除线圈自身的边后做 Menger 判定
  const newCoil = new Map<string, boolean>();
  for (const comp of c.components) {
    if (comp.type === 'contactor_coil' && comp.groupId) {
      const a = nodeOf(dsu, comp.id, 'A1');
      const b = nodeOf(dsu, comp.id, 'A2');
      const own = edges.filter((e) => e.owner !== comp.id);
      newCoil.set(comp.groupId, pairPowered(own, a, b, hotNodes, nNodes));
    }
  }
  return { edges, adjAll, ps, domains, reachHot, reachN, newCoil };
}

const fp = (coil: Map<string, boolean>): string =>
  JSON.stringify([...coil.entries()].sort());

// ----------------------------------------------------------------------------
// §6 收敛循环 + 输出
// ----------------------------------------------------------------------------

const MAX_ITER = 20;

// U/V/W 与 L1/L2/L3 的全部对应关系：任一相序都算「转」（§5.4）
const PERMS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

export function simulate(c: Circuit): SimResult {
  const dsu = buildNodes(c);

  // 初始线圈状态从 state.energized 读取（自锁的双稳态靠它跨调用记忆）
  let coil = new Map<string, boolean>();
  for (const comp of c.components) {
    if (comp.type === 'contactor_coil' && comp.groupId) {
      coil.set(comp.groupId, !!comp.state.energized);
    }
  }

  let prevFp = fp(coil);
  const seen = new Set<string>([prevFp]);
  let finalStep = step(c, dsu, coil);
  let stable = false;
  let reason: SimResult['reason'];

  for (let i = 0; i < MAX_ITER; i++) {
    const s = step(c, dsu, coil);
    finalStep = s;
    const f = fp(s.newCoil);
    if (f === prevFp) {
      stable = true;
      coil = s.newCoil;
      break;
    }
    if (seen.has(f)) {
      reason = 'oscillation'; // §6 状态横跳 → 振荡（典型互锁接错）
      coil = s.newCoil;
      break;
    }
    seen.add(f);
    prevFp = f;
    coil = s.newCoil;
  }
  if (!stable && !reason) reason = 'max_iter';
  // 失稳（振荡/超迭代）时跳出循环的 finalStep 是用上一轮线圈状态算的，
  // 与最终 coil 不一致，会显示「线圈得电但触点断开」之类的矛盾状态；
  // 用最终 coil 再算一轮，保证输出自洽。
  if (!stable) finalStep = step(c, dsu, coil);

  return buildResult(c, dsu, finalStep, coil, stable, reason);
}

function buildResult(
  c: Circuit,
  dsu: DSU,
  s: Step,
  coil: Map<string, boolean>,
  stable: boolean,
  reason: SimResult['reason'],
): SimResult {
  // 各相/各极单独可达集：遍历同样不得穿过其它电位的极节点
  const reachCache = new Map<string, Set<NodeId>>();
  const reachFrom = (pot: string) => {
    let r = reachCache.get(pot);
    if (!r) {
      r = bfs(
        s.ps.filter((p) => p.potential === pot).map((p) => p.node),
        s.adjAll,
        poleStops(s.ps, (x) => x === pot),
      );
      reachCache.set(pot, r);
    }
    return r;
  };

  // §5.2 两端负载是否工作：剔除该负载自身的边后做 Menger 判定
  const hotStarts = s.ps.filter((p) => !isReturnPot(p.potential)).map((p) => p.node);
  const nStarts = s.ps.filter((p) => isReturnPot(p.potential)).map((p) => p.node);
  const worksPair = (comp: Component, a: NodeId, b: NodeId): boolean =>
    pairPowered(s.edges.filter((e) => e.owner !== comp.id), a, b, hotStarts, nStarts);

  // §5.4 三相电机：U/V/W 分别接到「某一个域」的三个相（任意相序）
  const feedingDomain = (t: NodeId[]): Domain | undefined =>
    s.domains.find((d) => {
      const rs = d.pots.map((pot) => reachFrom(pot));
      return PERMS.some((p) => t.every((node, i) => rs[p[i]].has(node)));
    });

  const motorRuns = (comp: Component): boolean => {
    if (comp.rules?.motorMode === 'simplified') {
      return worksPair(comp, nodeOf(dsu, comp.id, 'U'), nodeOf(dsu, comp.id, 'V'));
    }
    const t = ['U', 'V', 'W'].map((x) => nodeOf(dsu, comp.id, x));
    return feedingDomain(t) !== undefined;
  };

  const isLoadWorking = (comp: Component): boolean =>
    worksPair(comp, nodeOf(dsu, comp.id, 'L'), nodeOf(dsu, comp.id, 'N'));

  // §12 直流电机：DC+/DC- 分别可达某直流域的正负极（Menger，同 §5.2）
  const dcHot = s.ps.filter((p) => p.potential.endsWith('.DC+')).map((p) => p.node);
  const dcRet = s.ps.filter((p) => p.potential.endsWith('.DC-')).map((p) => p.node);
  const dcMotorRuns = (comp: Component): boolean =>
    pairPowered(
      s.edges.filter((e) => e.owner !== comp.id),
      nodeOf(dsu, comp.id, 'DC+'),
      nodeOf(dsu, comp.id, 'DC-'),
      dcHot,
      dcRet,
    );

  // ---- §12 电位求解：负载额定电阻 + 闭合触点近似 0Ω，读出电压/电流 ----
  const OHMS = {
    lamp: 1936,       // 220V 25W
    indicator: 4840,  // 220V 10W
    coil: 4840,
    fanUV: 807,       // 简化电机（风机）220V 60W
    motorPhase: 100,  // 三相电机每相（星形内点）
    dcMotor: 15,
    txPrimary: 3000,  // 变压器一次侧励磁（星形内点）
    contact: 0.001,   // 闭合触点 / 导线级
  };
  const fixed = new Map<string, Cx>();
  for (const p of s.ps) if (!fixed.has(p.node)) fixed.set(p.node, p.volt);
  const elems: RElem[] = [];
  for (const e of s.edges) {
    if (!e.isLoad) elems.push({ a: e.a, b: e.b, ohms: OHMS.contact });
  }
  for (const comp of c.components) {
    const n = (t: string) => nodeOf(dsu, comp.id, t);
    switch (comp.type) {
      case 'lamp':
        elems.push({ a: n('L'), b: n('N'), ohms: OHMS.lamp });
        break;
      case 'indicator':
        elems.push({ a: n('L'), b: n('N'), ohms: OHMS.indicator });
        break;
      case 'contactor_coil':
        elems.push({ a: n('A1'), b: n('A2'), ohms: OHMS.coil });
        break;
      case 'timer_coil':
        elems.push({ a: n('7'), b: n('8'), ohms: OHMS.coil });
        break;
      case 'motor':
        if (comp.rules?.motorMode === 'simplified') {
          elems.push({ a: n('U'), b: n('V'), ohms: OHMS.fanUV });
        } else {
          const star = `${comp.id}#star`;
          for (const t of ['U', 'V', 'W']) {
            elems.push({ a: n(t), b: star, ohms: OHMS.motorPhase });
          }
        }
        break;
      case 'dc_motor':
        elems.push({ a: n('DC+'), b: n('DC-'), ohms: OHMS.dcMotor });
        break;
      case 'transformer3': {
        const star = `${comp.id}#star`;
        for (const t of ['L1', 'L2', 'L3']) {
          elems.push({ a: n(t), b: star, ohms: OHMS.txPrimary });
        }
        break;
      }
    }
  }
  const net = solveNetwork(fixed, elems);
  const r1 = (x: number) => Math.round(x * 10) / 10;

  const out: SimComponentOut[] = c.components.map((comp) => {
    const o: SimComponentOut = { id: comp.id };
    const n = (t: string) => nodeOf(dsu, comp.id, t);
    switch (comp.type) {
      case 'lamp':
      case 'indicator': {
        o.working = isLoadWorking(comp);
        comp.state.working = o.working;
        const v = net.drop(n('L'), n('N'));
        o.volts = r1(v);
        o.amps = r1((v / (comp.type === 'lamp' ? OHMS.lamp : OHMS.indicator)) * 100) / 100;
        break;
      }
      case 'motor': {
        o.working = motorRuns(comp);
        comp.state.working = o.working;
        if (comp.rules?.motorMode === 'simplified') {
          const v = net.drop(n('U'), n('V'));
          o.volts = r1(v);
          o.speedPct = Math.min(100, Math.round((v / 220) * 100));
        } else {
          const t = ['U', 'V', 'W'].map(n);
          const vll = Math.max(
            net.drop(t[0], t[1]), net.drop(t[1], t[2]), net.drop(t[0], t[2]),
          );
          o.volts = r1(vll);
          const rated = (comp.rules?.ratedV as number | undefined) ?? 380;
          o.speedPct = Math.min(100, Math.round((vll / rated) * 100));
        }
        break;
      }
      case 'dc_motor': {
        o.working = dcMotorRuns(comp);
        comp.state.working = o.working;
        const v = net.drop(n('DC+'), n('DC-'));
        o.volts = r1(v);
        o.amps = r1((v / OHMS.dcMotor) * 10) / 10;
        const rated = (comp.rules?.ratedV as number | undefined) ?? 81;
        o.speedPct = Math.min(100, Math.round((v / rated) * 100));
        break;
      }
      case 'contactor_coil': {
        o.energized = !!coil.get(comp.groupId as string);
        comp.state.energized = o.energized; // 回写，供下次调用记忆
        o.volts = r1(net.drop(n('A1'), n('A2')));
        break;
      }
      case 'contactor_main':
      case 'contactor_no':
        o.closed = !!coil.get(comp.groupId as string);
        break;
      case 'contactor_nc':
        o.closed = !coil.get(comp.groupId as string);
        break;
      case 'fuse':
        o.faulted = !!comp.state.blown;
        break;
      case 'thermal_main':
      case 'thermal_nc':
        o.faulted = !!comp.state.tripped;
        break;
      case 'ammeter':
        o.amps = r1(net.drop(n('in'), n('out')) / OHMS.contact);
        break;
      case 'voltmeter':
        o.volts = r1(net.drop(n('in'), n('out')));
        break;
      case 'timer_coil':
        o.energized = worksPair(comp, n('7'), n('8'));
        comp.state.energized = o.energized; // 回写，UI 计时依据它启停
        o.volts = r1(net.drop(n('7'), n('8')));
        break;
      case 'timer_no':
        o.closed = !!comp.state.closed;
        break;
    }
    return o;
  });

  // §5.3 短路：去掉负载边后，不同电位的极相连即短路
  const adjNoLoad = adjacency(s.edges, false);
  const shorts: Array<{ nodes: [NodeId, NodeId] }> = [];
  const seenPair = new Set<string>();
  for (let i = 0; i < s.ps.length; i++) {
    for (let j = i + 1; j < s.ps.length; j++) {
      const pi = s.ps[i];
      const pj = s.ps[j];
      if (pi.potential === pj.potential) continue;
      if (connected(pi.node, pj.node, adjNoLoad)) {
        const key = [pi.node, pj.node].sort().join('|');
        if (!seenPair.has(key)) {
          seenPair.add(key);
          shorts.push({ nodes: [pi.node, pj.node] });
        }
      }
    }
  }

  const energizedNodes = [...new Set([...s.reachHot, ...s.reachN])];

  return {
    stable,
    reason,
    energizedNodes,
    components: out,
    shorts,
    errors: checkGeneral(c, dsu, s, shorts.length > 0),
  };
}

// ----------------------------------------------------------------------------
// §8 通用检查（任何模式生效）
// ----------------------------------------------------------------------------

function checkGeneral(
  c: Circuit,
  dsu: DSU,
  s: Step,
  hasShort: boolean,
): CheckError[] {
  const errors: CheckError[] = [];

  if (s.ps.length === 0) {
    errors.push({ code: 'no_power', message: '当前电路没有接入电源，任何用电器都不会工作。' });
  }

  if (hasShort) {
    errors.push({
      code: 'short_circuit',
      message: '检测到火线与零线（或两相之间）被无负载直接连接，存在短路风险。',
    });
  }

  // 悬空端子：未被任何导线引用
  const referenced = new Set<string>();
  for (const w of c.wires) {
    referenced.add(pin(w.from.componentId, w.from.terminal));
    referenced.add(pin(w.to.componentId, w.to.terminal));
  }
  for (const comp of c.components) {
    for (const t of comp.terminals) {
      // 变压器二次抽头是可选接线点：备用抽头空置是正常状态（实物同理）
      if (comp.type === 'transformer3' && /^[RST]\d$/.test(t.id)) continue;
      // 端子排：空置端子再正常不过，不算悬空
      if (comp.type === 'terminal_block') continue;
      if (!referenced.has(pin(comp.id, t.id))) {
        errors.push({
          code: 'floating_terminal',
          componentId: comp.id,
          message: `元件 ${comp.name ?? comp.id} 的端子 ${t.id} 悬空未接线。`,
        });
      }
    }
  }

  // 断路（结构性）：把所有开关/按钮/触点都视为接通再判可达。
  // 只有「无论怎么操作都成不了回路」才报错，开关没合、接触器未吸合等
  // 正常待机状态不算接线错误。
  if (s.ps.length > 0 && !hasShort) {
    const bestEdges = c.components.flatMap((comp) =>
      componentEdges(comp, dsu, new Map(), true),
    );
    const bestAdj = adjacency(bestEdges, true);
    // 最好情况下的极：基础极 + 全部转换器视为已激活的派生极（§12）
    const { ps: bestPs, domains: bestDomains } = basePoles(c, dsu);
    derivePoles(c, dsu, bestAdj, bestPs, bestDomains, true);
    const reachBest = (pot: string) =>
      bfs(
        bestPs.filter((p) => p.potential === pot).map((p) => p.node),
        bestAdj,
        poleStops(bestPs, (x) => x === pot),
      );
    // 两端负载的最好情况：同 §5.2，剔除该负载自身的边后做 Menger 判定
    const bestHot = bestPs.filter((p) => !isReturnPot(p.potential)).map((p) => p.node);
    const bestRet = bestPs.filter((p) => isReturnPot(p.potential)).map((p) => p.node);
    const bestPossible = (comp: Component, a: NodeId, b: NodeId): boolean =>
      pairPowered(bestEdges.filter((e) => e.owner !== comp.id), a, b, bestHot, bestRet);

    const wired = (id: string, terms: string[]) =>
      terms.every((t) => referenced.has(pin(id, t)));

    for (const comp of c.components) {
      // 两端负载：灯 / 指示灯 / 接触器线圈 / 简化电机 / 直流电机
      let pair: [string, string] | undefined;
      if (comp.type === 'lamp' || comp.type === 'indicator') pair = ['L', 'N'];
      else if (comp.type === 'contactor_coil') pair = ['A1', 'A2'];
      else if (comp.type === 'timer_coil') pair = ['7', '8'];
      else if (comp.type === 'dc_motor') pair = ['DC+', 'DC-'];
      else if (comp.type === 'motor' && comp.rules?.motorMode === 'simplified')
        pair = ['U', 'V'];

      if (pair) {
        if (!wired(comp.id, pair)) continue; // 悬空已单独报
        const a = nodeOf(dsu, comp.id, pair[0]);
        const b = nodeOf(dsu, comp.id, pair[1]);
        if (!bestPossible(comp, a, b)) {
          errors.push({
            code: 'open_circuit',
            componentId: comp.id,
            message:
              comp.type === 'contactor_coil'
                ? `接触器线圈 ${comp.name ?? comp.id} 无法形成回路（怎么操作都不会得电），检查 A1/A2 接线。`
                : `用电器 ${comp.name ?? comp.id} 无法形成完整回路，检查两端接线。`,
          });
        }
        continue;
      }

      // 三相电机：主回路未接通 / 缺相 / 接了重复相（可由任意三相域供电）
      if (comp.type === 'motor') {
        if (!wired(comp.id, ['U', 'V', 'W'])) continue;
        const t = ['U', 'V', 'W'].map((x) => nodeOf(dsu, comp.id, x));
        const canRun = bestDomains.some((d) => {
          const rs = d.pots.map(reachBest);
          return PERMS.some((p) => t.every((node, i) => rs[p[i]].has(node)));
        });
        if (canRun) continue;
        const bestPhases = bestDomains.flatMap((d) => d.pots.map(reachBest));
        const hits = t.filter((node) => bestPhases.some((ph) => ph.has(node))).length;
        if (hits === 0) {
          errors.push({
            code: 'open_circuit',
            componentId: comp.id,
            message: `电机 ${comp.name ?? comp.id} 的主回路未接通，三相电都到不了电机端子。`,
          });
        } else {
          errors.push({
            code: 'phase_loss',
            componentId: comp.id,
            message:
              hits < 3
                ? `电机 ${comp.name ?? comp.id} 缺相：只有部分相电能到达端子，三相电机无法正常启动（实际中会烧毁电机）。`
                : `电机 ${comp.name ?? comp.id} 有端子接到了同一相上，三相不齐，无法正常启动。`,
          });
        }
      }
    }
  }

  return errors;
}

// ----------------------------------------------------------------------------
// §8 语义判错辅助：并联 / 串联（基于电气节点）
// ----------------------------------------------------------------------------

function twoNodes(c: Circuit, dsu: DSU, id: string): [NodeId, NodeId] {
  const comp = c.components.find((x) => x.id === id);
  if (!comp || comp.terminals.length < 2) {
    throw new Error(`组件 ${id} 不是双端元件`);
  }
  return [
    nodeOf(dsu, id, comp.terminals[0].id),
    nodeOf(dsu, id, comp.terminals[1].id),
  ];
}

export function isParallel(c: Circuit, idA: string, idB: string): boolean {
  const dsu = buildNodes(c);
  const [a1, a2] = twoNodes(c, dsu, idA);
  const [b1, b2] = twoNodes(c, dsu, idB);
  const setA = new Set([a1, a2]);
  const setB = new Set([b1, b2]);
  return setA.size === setB.size && [...setA].every((x) => setB.has(x));
}

export function isSeries(c: Circuit, idA: string, idB: string): boolean {
  const dsu = buildNodes(c);
  const [a1, a2] = twoNodes(c, dsu, idA);
  const [b1, b2] = twoNodes(c, dsu, idB);
  const shared = new Set([a1, a2]).size; // 自身两端是否退化
  if (shared < 2) return false;
  const common = [a1, a2].filter((x) => x === b1 || x === b2);
  if (common.length !== 1) return false;
  // 另两端必须不同
  const otherA = a1 === common[0] ? a2 : a1;
  const otherB = b1 === common[0] ? b2 : b1;
  return otherA !== otherB;
}

// ----------------------------------------------------------------------------
// §8 语义判错：对照练习模板（仅练习模式调用）
// ----------------------------------------------------------------------------

function typeMessage(role: string, expected: string, actual: string): string {
  if (role === 'stop_button')
    return '停止按钮通常应使用常闭触点。当前用了常开，正常状态下控制回路无法导通。';
  if (role === 'start_button')
    return '启动按钮通常应使用常开触点。应在按下时才接通控制回路。';
  return `角色「${role}」的元件类型应为 ${expected}，当前为 ${actual}。`;
}

export function checkTemplate(c: Circuit, exp: Expected): CheckError[] {
  const errors: CheckError[] = [];
  const byRole = new Map<string, Component>();
  for (const comp of c.components) {
    if (comp.role) byRole.set(comp.role, comp);
  }

  // 元件存在性 + 类型正确性
  for (const req of exp.required) {
    const comp = byRole.get(req.role);
    if (!comp) {
      errors.push({ code: 'missing_component', message: `缺少必要元件：${req.role}。` });
      continue;
    }
    if (comp.type !== req.type) {
      errors.push({
        code: 'wrong_type',
        componentId: comp.id,
        message: typeMessage(req.role, req.type, comp.type),
      });
    }
  }

  // 拓扑约束：并联 / 串联
  for (const cons of exp.constraints ?? []) {
    const a = byRole.get(cons.a);
    const b = byRole.get(cons.b);
    if (!a || !b) continue; // 缺件已在上面报过
    if (cons.kind === 'parallel' && !isParallel(c, a.id, b.id)) {
      errors.push({
        code: 'wrong_topology',
        message: cons.message ?? `${cons.a} 应与 ${cons.b} 并联。`,
      });
    }
    if (cons.kind === 'series' && !isSeries(c, a.id, b.id)) {
      errors.push({
        code: 'wrong_topology',
        message: cons.message ?? `${cons.a} 应与 ${cons.b} 串联。`,
      });
    }
  }

  return errors;
}
