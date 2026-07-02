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
}

const edge = (a: NodeId, b: NodeId, isLoad: boolean): Edge => ({ a, b, isLoad });

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
  const coilOn = comp.groupId ? !!coilEnergized.get(comp.groupId) : false;

  switch (comp.type) {
    case 'switch':
      return bestCase || comp.state.closed ? [edge(n('in'), n('out'), false)] : [];
    case 'breaker':
      return bestCase || comp.state.closed
        ? [edge(n('in_L'), n('out_L'), false), edge(n('in_N'), n('out_N'), false)]
        : [];
    case 'button_no':
      return bestCase || comp.state.pressed ? [edge(n('in'), n('out'), false)] : [];
    case 'button_nc':
      return bestCase || !comp.state.pressed ? [edge(n('in'), n('out'), false)] : [];
    case 'fuse':
      return !comp.state.blown ? [edge(n('in'), n('out'), false)] : [];
    case 'thermal_main':
      return !comp.state.tripped ? [edge(n('in'), n('out'), false)] : [];
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
    default:
      return []; // 电源：不是边，是极
  }
}

// ----------------------------------------------------------------------------
// §5.1 电源极
// ----------------------------------------------------------------------------

interface Pole {
  node: NodeId;
  potential: string; // 'L' | 'N' | 'L1' | 'L2' | 'L3'
}

function poles(c: Circuit, dsu: DSU): Pole[] {
  const list: Pole[] = [];
  for (const comp of c.components) {
    if (comp.type === 'single_phase_power' && comp.state.on) {
      list.push({ node: nodeOf(dsu, comp.id, 'L'), potential: 'L' });
      list.push({ node: nodeOf(dsu, comp.id, 'N'), potential: 'N' });
    }
    if (comp.type === 'three_phase_power' && comp.state.on) {
      list.push({ node: nodeOf(dsu, comp.id, 'L1'), potential: 'L1' });
      list.push({ node: nodeOf(dsu, comp.id, 'L2'), potential: 'L2' });
      list.push({ node: nodeOf(dsu, comp.id, 'L3'), potential: 'L3' });
      list.push({ node: nodeOf(dsu, comp.id, 'N'), potential: 'N' });
    }
  }
  return list;
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

function bfs(starts: NodeId[], adj: Adj): Set<NodeId> {
  const seen = new Set<NodeId>(starts);
  const q = [...starts];
  while (q.length) {
    const x = q.shift() as NodeId;
    for (const y of adj.get(x) ?? []) {
      if (!seen.has(y)) {
        seen.add(y);
        q.push(y);
      }
    }
  }
  return seen;
}

function connected(a: NodeId, b: NodeId, adj: Adj): boolean {
  if (a === b) return true;
  return bfs([a], adj).has(b);
}

// ----------------------------------------------------------------------------
// §2 单轮计算
// ----------------------------------------------------------------------------

interface Step {
  edges: Edge[];
  adjAll: Adj;
  ps: Pole[];
  reachHot: Set<NodeId>;
  reachN: Set<NodeId>;
  newCoil: Map<string, boolean>;
}

function step(c: Circuit, dsu: DSU, coil: Map<string, boolean>): Step {
  const edges = c.components.flatMap((comp) => componentEdges(comp, dsu, coil));
  const adjAll = adjacency(edges, true);
  const ps = poles(c, dsu);

  const hotNodes = ps.filter((p) => p.potential !== 'N').map((p) => p.node);
  const nNodes = ps.filter((p) => p.potential === 'N').map((p) => p.node);
  const reachHot = bfs(hotNodes, adjAll);
  const reachN = bfs(nNodes, adjAll);

  // §5.2 重新判定各线圈是否得电
  const newCoil = new Map<string, boolean>();
  for (const comp of c.components) {
    if (comp.type === 'contactor_coil' && comp.groupId) {
      const a = nodeOf(dsu, comp.id, 'A1');
      const b = nodeOf(dsu, comp.id, 'A2');
      const on =
        (reachHot.has(a) && reachN.has(b)) || (reachHot.has(b) && reachN.has(a));
      newCoil.set(comp.groupId, on);
    }
  }
  return { edges, adjAll, ps, reachHot, reachN, newCoil };
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
  // 各相单独可达集（§5.4 三相电机）
  const reachFrom = (pot: string) =>
    bfs(s.ps.filter((p) => p.potential === pot).map((p) => p.node), s.adjAll);
  const reachL1 = reachFrom('L1');
  const reachL2 = reachFrom('L2');
  const reachL3 = reachFrom('L3');
  const phaseReaches = [reachL1, reachL2, reachL3];

  const motorRuns = (comp: Component): boolean => {
    if (comp.rules?.motorMode === 'simplified') {
      const a = nodeOf(dsu, comp.id, 'U');
      const b = nodeOf(dsu, comp.id, 'V');
      return (
        (s.reachHot.has(a) && s.reachN.has(b)) ||
        (s.reachHot.has(b) && s.reachN.has(a))
      );
    }
    const t = [
      nodeOf(dsu, comp.id, 'U'),
      nodeOf(dsu, comp.id, 'V'),
      nodeOf(dsu, comp.id, 'W'),
    ];
    return PERMS.some((p) =>
      t.every((node, i) => phaseReaches[p[i]].has(node)),
    );
  };

  const isLoadWorking = (comp: Component): boolean => {
    const a = nodeOf(dsu, comp.id, 'L');
    const b = nodeOf(dsu, comp.id, 'N');
    return (
      (s.reachHot.has(a) && s.reachN.has(b)) ||
      (s.reachHot.has(b) && s.reachN.has(a))
    );
  };

  const out: SimComponentOut[] = c.components.map((comp) => {
    const o: SimComponentOut = { id: comp.id };
    switch (comp.type) {
      case 'lamp':
      case 'indicator':
        o.working = isLoadWorking(comp);
        comp.state.working = o.working;
        break;
      case 'motor':
        o.working = motorRuns(comp);
        comp.state.working = o.working;
        break;
      case 'contactor_coil':
        o.energized = !!coil.get(comp.groupId as string);
        comp.state.energized = o.energized; // 回写，供下次调用记忆
        break;
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
    const reachBest = (pots: string[]) =>
      bfs(s.ps.filter((p) => pots.includes(p.potential)).map((p) => p.node), bestAdj);
    const bestHot = reachBest(['L', 'L1', 'L2', 'L3']);
    const bestN = reachBest(['N']);
    const bestPhases = [reachBest(['L1']), reachBest(['L2']), reachBest(['L3'])];

    const wired = (id: string, terms: string[]) =>
      terms.every((t) => referenced.has(pin(id, t)));

    for (const comp of c.components) {
      // 两端负载：灯 / 指示灯 / 接触器线圈 / 简化电机
      let pair: [string, string] | undefined;
      if (comp.type === 'lamp' || comp.type === 'indicator') pair = ['L', 'N'];
      else if (comp.type === 'contactor_coil') pair = ['A1', 'A2'];
      else if (comp.type === 'motor' && comp.rules?.motorMode === 'simplified')
        pair = ['U', 'V'];

      if (pair) {
        if (!wired(comp.id, pair)) continue; // 悬空已单独报
        const a = nodeOf(dsu, comp.id, pair[0]);
        const b = nodeOf(dsu, comp.id, pair[1]);
        const possible =
          (bestHot.has(a) && bestN.has(b)) || (bestHot.has(b) && bestN.has(a));
        if (!possible) {
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

      // 三相电机：主回路未接通 / 缺相 / 接了重复相
      if (comp.type === 'motor') {
        if (!wired(comp.id, ['U', 'V', 'W'])) continue;
        const t = ['U', 'V', 'W'].map((x) => nodeOf(dsu, comp.id, x));
        const canRun = PERMS.some((p) => t.every((node, i) => bestPhases[p[i]].has(node)));
        if (canRun) continue;
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
