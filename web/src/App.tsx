import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  ConnectionMode,
  ConnectionLineType,
  Position,
  ViewportPortal,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { routeAll, type Port, type RouteReq } from './routing.ts';
import { CircuitNode, displayName, statusText } from './CircuitNode.tsx';
import { SchematicRef } from './SchematicRef.tsx';
import { CircuitCtx } from './circuitContext.ts';
import { DEFS, defaultState } from './componentDefs.ts';
import {
  DEFAULT_PRACTICE,
  PRACTICES,
  TIMER_DELAY_SECONDS,
  type Practice,
  type PresetItem,
} from './presets.ts';
import { simulate, checkTemplate } from '../../engine/src/engine.ts';
import type { Circuit, SimResult, CheckError } from '../../engine/src/types.ts';

const nodeTypes = { circuit: CircuitNode };

// 布线边：优先用 routing.ts 算好的正交绕障路径（data.path）；
// 个别找不到路的极端情况回退到平滑直角折线。
function RoutedEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style, markerEnd, data,
}: EdgeProps) {
  const routed = (data as any)?.path as string | undefined;
  const label = (data as any)?.label as string | undefined;
  const pos = (data as any)?.labelPos as { x: number; y: number } | undefined;
  // 线号/线径标注：白底描边小字，画在走线中点
  const tag = label && pos && (
    <text x={pos.x} y={pos.y - 4} textAnchor="middle" fontSize={10} fontWeight={600}
      fill="#475569" stroke="#ffffff" strokeWidth={3} paintOrder="stroke"
      style={{ pointerEvents: 'none' }}>
      {label}
    </text>
  );
  if (routed) {
    return (
      <>
        <BaseEdge id={id} path={routed} style={style} markerEnd={markerEnd} />
        {tag}
      </>
    );
  }
  const [path] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 5,
    offset: 12,
  });
  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {tag}
    </>
  );
}
const edgeTypes = { routed: RoutedEdge };

// 端子在画布上的绝对坐标与朝向（与 DEFS 里 Handle 的百分比定位一致）
function portOf(nodes: Node[], nodeId: string, handleId?: string | null): Port | null {
  if (!handleId) return null;
  const n = nodes.find((x) => x.id === nodeId);
  const def = n && DEFS[(n.data as any).type];
  const t = def?.terminals.find((tt) => tt.id === handleId);
  if (!n || !def || !t) return null;
  const pct = parseFloat((t.style.top ?? t.style.left) as string) / 100;
  switch (t.position) {
    case Position.Left: return { x: n.position.x, y: n.position.y + def.h * pct, side: 'left' };
    case Position.Right: return { x: n.position.x + def.w, y: n.position.y + def.h * pct, side: 'right' };
    case Position.Top: return { x: n.position.x + def.w * pct, y: n.position.y, side: 'top' };
    default: return { x: n.position.x + def.w * pct, y: n.position.y + def.h, side: 'bottom' };
  }
}

// 控制/触点线调色板：高辨识度、白底清晰，避开红(火线)蓝(零线)。
// 每根控制线取一个独立色，密集接线交叉时也能逐根追踪（参考教学图「两台电动机顺序」）。
const WIRE_PALETTE = [
  '#ea580c', // 橙
  '#16a34a', // 绿
  '#9333ea', // 紫
  '#0891b2', // 青
  '#db2777', // 品红
  '#ca8a04', // 金
  '#0d9488', // 蓝绿
  '#65a30d', // 黄绿
  '#7c3aed', // 紫罗兰
  '#b45309', // 棕
];

// 给线着色：直连电源端子的→火线/相红、零线蓝（功能色打底）；其余控制/触点线
// 每根取一个独立色（参考「两台电动机顺序」教学图），密集接线里也能一眼追踪谁连谁。
function computeWireColor(c: Connection, nodes: Node[], edges: Edge[]): string {
  const isPower = (t?: string) =>
    t === 'single_phase_power' || t === 'three_phase_power';
  const srcType = (nodes.find((n) => n.id === c.source)?.data as any)?.type;
  const tgtType = (nodes.find((n) => n.id === c.target)?.data as any)?.type;
  const hot = (h?: string | null) => !!h && /^L\d?$/.test(h);
  if ((isPower(srcType) && c.sourceHandle === 'N') || (isPower(tgtType) && c.targetHandle === 'N'))
    return '#2563eb';
  if ((isPower(srcType) && hot(c.sourceHandle)) || (isPower(tgtType) && hot(c.targetHandle)))
    return '#dc2626';
  // 控制线：按当前已有控制线数量顺序取色，使相邻新增的线颜色尽量错开
  const controlCount = edges.filter((e) => {
    const s = (e.style as any)?.stroke;
    return s && s !== '#dc2626' && s !== '#2563eb';
  }).length;
  return WIRE_PALETTE[controlCount % WIRE_PALETTE.length];
}

// 把练习的预设接线（标准答案）构建成带配色的边，加载时直接显示连好的电路。
function buildPresetEdges(p: Practice, nodes: Node[]): Edge[] {
  const edges: Edge[] = [];
  (p.wires ?? []).forEach((w, i) => {
    const c: Connection = {
      source: w.from[0], sourceHandle: w.from[1],
      target: w.to[0], targetHandle: w.to[1],
    };
    edges.push({
      id: `preset-${i}`,
      source: c.source!, target: c.target!,
      sourceHandle: c.sourceHandle, targetHandle: c.targetHandle,
      type: 'routed',
      style: { stroke: computeWireColor(c, nodes, edges), strokeWidth: 2 },
      data: w.label ? { label: w.label } : undefined,
    });
  });
  return edges;
}

function nodeFromPreset(it: PresetItem): Node {
  return {
    id: it.id,
    type: 'circuit',
    position: { x: it.x, y: it.y },
    data: { type: it.type, state: defaultState(it.type), groupId: it.groupId, role: it.role },
  };
}

function buildCircuit(nodes: Node[], edges: Edge[]): Circuit {
  const components = nodes.map((n) => {
    const d = n.data as any;
    const def = DEFS[d.type];
    return {
      id: n.id,
      type: def.type, // 外观键（如 fan）映射到引擎类型（motor）
      groupId: d.groupId,
      role: d.role,
      terminals: def.terminals.map((t) => ({ id: t.id })),
      state: { ...d.state },
      rules: (def.rules as any) ?? (def.isLoad ? { isLoad: true } : undefined),
    };
  });
  const wires = edges.map((e) => ({
    id: e.id,
    from: { componentId: e.source, terminal: e.sourceHandle ?? '' },
    to: { componentId: e.target, terminal: e.targetHandle ?? '' },
  }));
  return { schemaVersion: 1, components, wires };
}

const INITIAL_NODES = DEFAULT_PRACTICE.items.map(nodeFromPreset);
// 侧栏分组：按 category 首次出现的顺序排列
const CATEGORIES = [...new Set(PRACTICES.map((p) => p.category))];
// 手势方案与操作提示都由这一个判定驱动，即使判错两者也保持一致
const IS_MAC =
  typeof navigator !== 'undefined' &&
  /mac|iphone|ipad/i.test(
    (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
      navigator.platform,
  );

export default function App() {
  const [practice, setPractice] = useState<Practice>(DEFAULT_PRACTICE);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(INITIAL_NODES);
  // 画布初始留空白，让学习者自己接线；正确接线由「正确布线」按钮按需画出
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [result, setResult] = useState<SimResult | null>(null);
  const [semantic, setSemantic] = useState<CheckError[] | null>(null);
  // 悬停描线：聚焦某根线或某个元件相连的线，其余变淡，便于在密集接线里分辨
  const [hoverEdgeId, setHoverEdgeId] = useState<string | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  // 侧栏折叠：收起左侧操作栏 / 右侧状态栏，给画布让出全部宽度
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  // 练习分组折叠：默认只展开当前练习所在的组
  const [openCats, setOpenCats] = useState<Set<string>>(
    () => new Set([DEFAULT_PRACTICE.category]),
  );
  function toggleCat(cat: string) {
    setOpenCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  // 时间继电器（ZN96）：引擎判「本体得电」，UI 负责计时——得电后倒数，
  // 到点把同组延时触点闭合并重算；本体失电立即复位（断开触点、清计时）。
  const timersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  // 撤回历史：只记录结构性编辑（接线 / 删除 / 拖动），不记录开关按钮等运行操作
  const past = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const [histLen, setHistLen] = useState(0);

  function snapshot() {
    past.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    if (past.current.length > 50) past.current.shift();
    setHistLen(past.current.length);
  }
  function undo() {
    const prev = past.current.pop();
    setHistLen(past.current.length);
    if (!prev) return;
    setEdges(prev.edges);
    recompute(prev.nodes, prev.edges);
  }
  // 删除节点时 React Flow 会同时回调节点删除和关联边删除，
  // 用微任务标记去重，保证一次 Delete 只拍一张快照（撤回一步到位）。
  const snapDone = useRef(false);
  function snapshotOnce() {
    if (snapDone.current) return;
    snapDone.current = true;
    queueMicrotask(() => (snapDone.current = false));
    snapshot();
  }
  // 删除后待 React Flow 把变更写进 state，再用最终的 nodes/edges 重跑模拟，
  // 否则剪断电线灯还亮着（结果面板/节点状态都停留在删除前）。
  const needsRecompute = useRef(false);
  useEffect(() => {
    if (!needsRecompute.current) return;
    needsRecompute.current = false;
    recompute(nodes, edges);
  }, [nodes, edges]);
  function handleNodesChange(changes: any[]) {
    if (changes.some((c) => c.type === 'remove')) {
      snapshotOnce();
      needsRecompute.current = true;
    }
    onNodesChange(changes);
  }
  function handleEdgesChange(changes: any[]) {
    if (changes.some((c) => c.type === 'remove')) {
      snapshotOnce();
      needsRecompute.current = true;
    }
    onEdgesChange(changes);
  }

  // 跑一次模拟，把结果写回节点；关键：把线圈 energized 持久化进 state，
  // 自锁的双稳态才能跨一次次点击被记住。
  function recompute(nds: Node[], eds: Edge[]) {
    const r = simulate(buildCircuit(nds, eds));
    setResult(r);
    setSemantic(null);
    const byId = new Map(r.components.map((c) => [c.id, c]));
    setNodes(
      nds.map((n) => {
        const d = n.data as any;
        const sim = byId.get(n.id);
        const state = { ...d.state };
        if (d.type === 'contactor_coil') state.energized = !!sim?.energized;
        return { ...n, data: { ...d, state, sim } };
      }),
    );
  }

  function onConnect(c: Connection) {
    snapshot();
    const next = addEdge(
      { ...c, type: 'routed', style: { stroke: computeWireColor(c, nodes, edges), strokeWidth: 2 } },
      edges,
    );
    setEdges(next);
    recompute(nodes, next);
  }

  function toggle(id: string) {
    const src = nodes.find((n) => n.id === id)?.data as any;
    if (!src) return;
    // 热继：点击 = 模拟过载动作/复位。热元件与常闭触点是同一个热继电器
    // （共享 groupId），动作/复位必须联动（规约 §4）。
    const isThermal = src.type === 'thermal_main' || src.type === 'thermal_nc';
    const next = nodes.map((n) => {
      const d = n.data as any;
      if (isThermal) {
        const linked =
          n.id === id ||
          ((d.type === 'thermal_main' || d.type === 'thermal_nc') &&
            !!src.groupId && d.groupId === src.groupId);
        if (!linked) return n;
        return { ...n, data: { ...d, state: { ...d.state, tripped: !src.state.tripped } } };
      }
      if (n.id !== id) return n;
      return { ...n, data: { ...d, state: { ...d.state, closed: !d.state.closed } } };
    });
    recompute(next, edges);
  }

  function press(id: string, down: boolean) {
    const next = nodes.map((n) =>
      n.id === id
        ? { ...n, data: { ...n.data, state: { ...(n.data as any).state, pressed: down } } }
        : n,
    );
    recompute(next, edges);
  }

  function loadPractice(p: Practice) {
    clearAllTimers();
    setPractice(p);
    const nds = p.items.map(nodeFromPreset);
    setNodes(nds);
    setEdges([]); // 留空白让用户自接；正确接线点「正确布线」按需显示
    setResult(null);
    setSemantic(null);
    past.current = [];
    setHistLen(0);
  }

  // 显示标准答案：把预设的正确接线画到画布上并运行（可用「撤回」还原回自己的接法）
  function showAnswer() {
    snapshot();
    const eds = buildPresetEdges(practice, nodes);
    setEdges(eds);
    recompute(nodes, eds);
  }

  function check() {
    if (!practice.template) {
      setSemantic([]);
      return;
    }
    setSemantic(checkTemplate(buildCircuit(nodes, edges), practice.template));
  }

  const actions = useMemo(() => ({ toggle, press }), [nodes, edges]);

  nodesRef.current = nodes;
  edgesRef.current = edges;

  function clearTimer(gid: string) {
    const t = timersRef.current.get(gid);
    if (t !== undefined) {
      clearInterval(t);
      timersRef.current.delete(gid);
    }
  }
  function clearAllTimers() {
    for (const t of timersRef.current.values()) clearInterval(t);
    timersRef.current.clear();
  }

  // 观察模拟结果，驱动各 ZN96 的计时状态机
  useEffect(() => {
    if (!result) return;
    const byId = new Map(result.components.map((c) => [c.id, c]));
    for (const coilNode of nodes) {
      const d = coilNode.data as any;
      if (d.type !== 'timer_coil') continue;
      const gid = (d.groupId as string) ?? coilNode.id;
      const energized = !!byId.get(coilNode.id)?.energized;
      const running = timersRef.current.has(gid);
      const contactClosed = nodes.some((x) => {
        const xd = x.data as any;
        return xd.type === 'timer_no' && xd.groupId === gid && xd.state?.closed;
      });

      if (energized && !contactClosed && !running) {
        // 开始计时：每秒更新剩余秒数，到 0 闭合同组延时触点并重算
        let remain = TIMER_DELAY_SECONDS;
        const setRemain = (v: number | undefined) =>
          setNodes((nds) =>
            nds.map((n) =>
              n.id === coilNode.id
                ? { ...n, data: { ...n.data, state: { ...(n.data as any).state, remain: v } } }
                : n,
            ),
          );
        setRemain(remain);
        const int = setInterval(() => {
          remain -= 1;
          if (remain > 0) {
            setRemain(remain);
            return;
          }
          clearTimer(gid);
          const next = nodesRef.current.map((n) => {
            const nd = n.data as any;
            if (nd.type === 'timer_no' && nd.groupId === gid) {
              return { ...n, data: { ...nd, state: { ...nd.state, closed: true } } };
            }
            if (n.id === coilNode.id) {
              return { ...n, data: { ...nd, state: { ...nd.state, remain: 0 } } };
            }
            return n;
          });
          recompute(next, edgesRef.current);
        }, 1000);
        timersRef.current.set(gid, int);
      }

      if (!energized && (running || contactClosed)) {
        // 断电复位：停计时、断开触点、清剩余秒数
        clearTimer(gid);
        const next = nodesRef.current.map((n) => {
          const nd = n.data as any;
          if (nd.type === 'timer_no' && nd.groupId === gid && nd.state?.closed) {
            return { ...n, data: { ...nd, state: { ...nd.state, closed: false } } };
          }
          if (n.id === coilNode.id && nd.state?.remain !== undefined) {
            return { ...n, data: { ...nd, state: { ...nd.state, remain: undefined } } };
          }
          return n;
        });
        recompute(next, edgesRef.current);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // 正交绕障布线：节点位置或接线变化时整体重排（先布的线占道，后布的自动分道）。
  // 用签名字符串做依赖，模拟结果写回节点（位置不变）时不会白算。
  const posSig = nodes.map((n) => `${n.id}:${n.position.x},${n.position.y}`).join('|');
  const edgeSig = edges.map((e) => `${e.id}:${e.source}.${e.sourceHandle}->${e.target}.${e.targetHandle}`).join('|');
  const routes = useMemo(() => {
    const obstacles = nodes.flatMap((n) => {
      const def = DEFS[(n.data as any).type];
      return def ? [{ x: n.position.x, y: n.position.y, w: def.w, h: def.h }] : [];
    });
    const reqs: RouteReq[] = [];
    for (const e of edges) {
      const from = portOf(nodes, e.source, e.sourceHandle);
      const to = portOf(nodes, e.target, e.targetHandle);
      if (from && to) reqs.push({ id: e.id, from, to });
    }
    return routeAll(reqs, obstacles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posSig, edgeSig]);

  // 接点圆点：≥2 根线汇到同一端子时画实心点（电气图习惯：有点=相连，无点=交叉）
  const junctions = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of edges) {
      for (const key of [`${e.source}#${e.sourceHandle}`, `${e.target}#${e.targetHandle}`]) {
        count.set(key, (count.get(key) ?? 0) + 1);
      }
    }
    const dots: Array<{ key: string; x: number; y: number }> = [];
    for (const [key, n] of count) {
      if (n < 2) continue;
      const [nid, handle] = key.split('#');
      const p = portOf(nodes, nid, handle);
      if (p) dots.push({ key, x: p.x, y: p.y });
    }
    return dots;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posSig, edgeSig]);

  // 派生展示用的线：带上布线路径；悬停时叠加聚焦高亮（聚焦线加粗置顶、其余变淡）。
  // 源数据 edges 不变，判错/模拟仍用原始 edges。
  const displayEdges = useMemo(() => {
    const focusing = hoverEdgeId !== null || hoverNodeId !== null;
    return edges.map((e) => {
      const rt = routes.get(e.id);
      const data: Record<string, unknown> = { ...(e.data ?? {}), path: rt?.d };
      // 线号标注位置：走线折线的中间顶点
      if ((e.data as any)?.label && rt?.points?.length) {
        const mid = rt.points[Math.floor(rt.points.length / 2)];
        data.labelPos = { x: mid.x, y: mid.y };
      }
      if (!focusing) return { ...e, type: 'routed', data };
      const active = hoverEdgeId
        ? e.id === hoverEdgeId
        : e.source === hoverNodeId || e.target === hoverNodeId;
      return {
        ...e,
        type: 'routed',
        data,
        zIndex: active ? 1000 : 0,
        style: {
          ...e.style,
          strokeWidth: active ? 4 : 2,
          opacity: active ? 1 : 0.12,
        },
      };
    });
  }, [edges, routes, hoverEdgeId, hoverNodeId]);

  const allOk =
    (!result || (result.errors.length === 0 && result.shorts.length === 0)) &&
    (semantic === null || semantic.length === 0);

  return (
    <CircuitCtx.Provider value={actions}>
      <div className="app">
        {showLeft && (
        <aside className="palette">
          <h1>电工模拟器</h1>
          <div className="palette-group practice-list">
            <div className="palette-title">选择练习</div>
            {CATEGORIES.map((cat) => {
              const items = PRACTICES.filter((p) => p.category === cat);
              const open = openCats.has(cat);
              return (
                <div key={cat} className="practice-cat">
                  <button
                    className={`cat-header${open ? ' open' : ''}`}
                    onClick={() => toggleCat(cat)}
                  >
                    <span className="caret">▸</span>
                    {cat}
                    <span className="cat-count">{items.length}</span>
                  </button>
                  {open &&
                    items.map((p) => (
                      <button
                        key={p.key}
                        className={p.key === practice.key ? 'active' : ''}
                        onClick={() => loadPractice(p)}
                      >
                        {p.name}
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
          <div className="tips goal">
            <div className="section-label">练习目标</div>
            {practice.goal}
          </div>
          <div className="palette-group action-group">
            <div className="palette-title">布线操作</div>
            <button className="check" onClick={check}>🔍 检查电路</button>
            <button className="answer" onClick={showAnswer}>✅ 正确布线</button>
            <div className="utility-actions">
              <button onClick={undo} disabled={histLen === 0}>↶ 撤回</button>
              <button onClick={() => loadPractice(practice)}>↺ 重置</button>
            </div>
          </div>
          <div className="tips">
            <div className="section-label">操作提示</div>
            接线：从端子（小圆点）拖到另一个端子，端子不分方向。走线自动绕开元件、平行线自动分道；实心圆点表示多线相连。<br />
            {IS_MAC ? (
              <>画布：双指滑动平移，双指捏合缩放，空白处拖动也可平移。<br /></>
            ) : (
              <>画布：鼠标滚轮缩放，空白处按住左键拖动平移，也可用左下角 ＋ / － 缩放。<br /></>
            )}
            开关：点击切换合/断。<br />
            按钮：按住生效，松开复位。<br />
            删线：选中线后按 Delete 键。
          </div>
          <div className="legend">
            <div className="section-label">线缆标识</div>
            <div><span className="sw" style={{ background: '#dc2626' }} />火线 / 相</div>
            <div><span className="sw" style={{ background: '#2563eb' }} />零线 N</div>
            <div>
              <span className="sw sw-rainbow" />控制 / 触点线（每根独立色）
            </div>
          </div>
        </aside>
        )}

        <main className="canvas">
          <button
            className="side-toggle left"
            onClick={() => setShowLeft((v) => !v)}
            title={showLeft ? '收起左侧栏' : '展开左侧栏'}
          >
            {showLeft ? '◀' : '▶'}
          </button>
          <button
            className="side-toggle right"
            onClick={() => setShowRight((v) => !v)}
            title={showRight ? '收起右侧栏' : '展开右侧栏'}
          >
            {showRight ? '▶' : '◀'}
          </button>
          <ReactFlow
            nodes={nodes}
            edges={displayEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeDragStart={(_, node) => {
              snapshot();
              // 拖动按钮时 pointerdown 已触发「按下」，复位掉，别让电机在拖动中转起来
              if ((node.data as any)?.state?.pressed) press(node.id, false);
            }}
            onConnect={onConnect}
            onEdgeMouseEnter={(_, edge) => setHoverEdgeId(edge.id)}
            onEdgeMouseLeave={() => setHoverEdgeId(null)}
            onNodeMouseEnter={(_, node) => setHoverNodeId(node.id)}
            onNodeMouseLeave={() => setHoverNodeId(null)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodeDragThreshold={5}
            panOnScroll={IS_MAC}
            zoomOnScroll={!IS_MAC}
            zoomOnPinch
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.SmoothStep}
            defaultEdgeOptions={{ type: 'routed', style: { strokeWidth: 2 } }}
            snapToGrid
            snapGrid={[16, 16]}
            fitView
          >
            <Background gap={22} size={1.4} color="#c9d5e4" />
            <Controls />
            <ViewportPortal>
              {junctions.map((d) => (
                <div
                  key={d.key}
                  style={{
                    position: 'absolute',
                    left: d.x - 3.5,
                    top: d.y - 3.5,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#0f172a',
                    pointerEvents: 'none',
                    zIndex: 1000,
                  }}
                />
              ))}
            </ViewportPortal>
          </ReactFlow>
          <SchematicRef practiceKey={practice.key} />
        </main>

        {showRight && (
        <aside className="panel">
          <h2>运行状态</h2>
          {!result && (
            <div className="empty-state">
              <span className="empty-icon">🔌</span>
              <p>电路还没有通电</p>
              <p className="sub">从任意端子拖出第一根线，各元件的运行状态会实时显示在这里。</p>
            </div>
          )}
          {result && (
            <>
              {result.reason && (
                <p className="err">
                  ⚠️ 电路状态无法稳定（{result.reason === 'oscillation' ? '振荡' : '超出迭代'}），
                  可能存在互锁/反馈接线错误。
                </p>
              )}
              <ul className="status-list">
                {result.components
                  .filter((c) => c.working !== undefined || c.energized !== undefined)
                  .map((c) => {
                    const d = nodes.find((n) => n.id === c.id)?.data as any;
                    const on = !!(c.working || c.energized);
                    return (
                      <li key={c.id} className={on ? 'on' : ''}>
                        <span className="st-dot" />
                        <span className="st-name">
                          {d ? displayName(d) : c.id}
                          <i className="st-tag">{d?.groupId ?? c.id}</i>
                        </span>
                        <span className="st-state">
                          {d ? statusText(d) : on ? '工作' : '未工作'}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </>
          )}
          {/* 检查结果不依赖模拟是否跑过：空画布上点「检查电路」也要能看到反馈 */}
          {(result || semantic !== null) && (
            <>
              <h3>检查结果 {allOk ? '✅' : '⚠️'}</h3>
              {allOk && <p className="ok">没有发现问题。</p>}
              <ul className="error-list">
                {result && result.shorts.length > 0 && (
                  <li className="err">⛔ 短路风险（火线/相与零线无负载直连）。</li>
                )}
                {result?.errors.map((e, i) => (
                  <li key={`g${i}`} className={e.code === 'short_circuit' ? 'err' : 'warn'}>
                    {e.message}
                  </li>
                ))}
                {semantic?.map((e, i) => (
                  <li key={`s${i}`} className="warn">📋 {e.message}</li>
                ))}
              </ul>
              {semantic !== null && semantic.length === 0 && practice.template && (
                <p className="ok">📋 接线符合本练习的标准结构。</p>
              )}
            </>
          )}
        </aside>
        )}
      </div>
    </CircuitCtx.Provider>
  );
}
