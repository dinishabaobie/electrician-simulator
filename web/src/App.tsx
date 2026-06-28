import { useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  ConnectionMode,
  ConnectionLineType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { CircuitNode } from './CircuitNode.tsx';
import { SchematicRef } from './SchematicRef.tsx';
import { CircuitCtx } from './circuitContext.ts';
import { DEFS, defaultState } from './componentDefs.ts';
import { PRACTICES, type Practice, type PresetItem } from './presets.ts';
import { simulate, checkTemplate } from './engine/engine.ts';
import type { Circuit, SimResult, CheckError } from './engine/types.ts';

const nodeTypes = { circuit: CircuitNode };

// 平行线错开：同向多根线各占一条「车道」(lane)。lane 越大，直角拐弯离节点越远，
// 于是本会重叠的平行线像扇子一样阶梯散开（参考教学图 L2A/L2B/L2C 的走法）。
const LANE_SPACING = 13;
const LANE_MAX = 6; // 车道上限，防止线数过多时拐弯外扩太夸张
function StaggeredEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style, markerEnd, data,
}: EdgeProps) {
  const lane = Math.min(((data as any)?.lane ?? 0) as number, LANE_MAX);
  const [path] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 0,
    offset: 12 + lane * LANE_SPACING,
  });
  return <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />;
}
const edgeTypes = { staggered: StaggeredEdge };

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
      type: 'staggered',
      style: { stroke: computeWireColor(c, nodes, edges), strokeWidth: 2 },
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
      type: d.type,
      groupId: d.groupId,
      role: d.role,
      terminals: def.terminals.map((t) => ({ id: t.id })),
      state: { ...d.state },
      rules: def.isLoad ? { isLoad: true } : undefined,
    };
  });
  const wires = edges.map((e) => ({
    id: e.id,
    from: { componentId: e.source, terminal: e.sourceHandle ?? '' },
    to: { componentId: e.target, terminal: e.targetHandle ?? '' },
  }));
  return { schemaVersion: 1, components, wires };
}

export default function App() {
  const [practice, setPractice] = useState<Practice>(PRACTICES[0]);
  const initialNodes = PRACTICES[0].items.map(nodeFromPreset);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  // 画布初始留空白，让学习者自己接线；正确接线由「正确答案」按钮按需画出
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [result, setResult] = useState<SimResult | null>(null);
  const [semantic, setSemantic] = useState<CheckError[] | null>(null);
  // 悬停描线：聚焦某根线或某个元件相连的线，其余变淡，便于在密集接线里分辨
  const [hoverEdgeId, setHoverEdgeId] = useState<string | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);

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
  function handleNodesChange(changes: any[]) {
    if (changes.some((c) => c.type === 'remove')) snapshot();
    onNodesChange(changes);
  }
  function handleEdgesChange(changes: any[]) {
    if (changes.some((c) => c.type === 'remove')) snapshot();
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
      { ...c, type: 'staggered', style: { stroke: computeWireColor(c, nodes, edges), strokeWidth: 2 } },
      edges,
    );
    setEdges(next);
    recompute(nodes, next);
  }

  function toggle(id: string) {
    const next = nodes.map((n) =>
      n.id === id
        ? { ...n, data: { ...n.data, state: { ...(n.data as any).state, closed: !(n.data as any).state.closed } } }
        : n,
    );
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
    setPractice(p);
    const nds = p.items.map(nodeFromPreset);
    setNodes(nds);
    setEdges([]); // 留空白让用户自接；正确接线点「正确答案」按需显示
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

  // 派生展示用的线：统一用自动直角边；悬停时叠加聚焦高亮（聚焦线加粗置顶、其余变淡）。
  // 源数据 edges 不变，判错/模拟仍用原始 edges。
  const displayEdges = useMemo(() => {
    const focusing = hoverEdgeId !== null || hoverNodeId !== null;
    // 平行线错开：按「共享端点」给每根线排车道号——同一源引出 / 同一目标汇入的线
    // 各占递增车道，错开走线不挤成一束。取两端拥挤度较大者作为车道号。
    const srcSeen = new Map<string, number>();
    const tgtSeen = new Map<string, number>();
    return edges.map((e) => {
      const s = srcSeen.get(e.source) ?? 0;
      srcSeen.set(e.source, s + 1);
      const t = tgtSeen.get(e.target) ?? 0;
      tgtSeen.set(e.target, t + 1);
      const data = { ...(e.data ?? {}), lane: Math.max(s, t) };
      if (!focusing) return { ...e, type: 'staggered', data };
      const active = hoverEdgeId
        ? e.id === hoverEdgeId
        : e.source === hoverNodeId || e.target === hoverNodeId;
      return {
        ...e,
        type: 'staggered',
        data,
        zIndex: active ? 1000 : 0,
        style: {
          ...e.style,
          strokeWidth: active ? 4 : 2,
          opacity: active ? 1 : 0.12,
        },
      };
    });
  }, [edges, hoverEdgeId, hoverNodeId]);

  const allOk =
    result &&
    result.errors.length === 0 &&
    result.shorts.length === 0 &&
    (semantic === null || semantic.length === 0);

  return (
    <CircuitCtx.Provider value={actions}>
      <div className="app">
        <aside className="palette">
          <h1>电工模拟器</h1>
          <div className="palette-group">
            <div className="palette-title">选择练习</div>
            {PRACTICES.map((p) => (
              <button
                key={p.key}
                className={p.key === practice.key ? 'active' : ''}
                onClick={() => loadPractice(p)}
              >
                {p.name}
              </button>
            ))}
          </div>
          <p className="hint goal">🎯 {practice.goal}</p>
          <div className="palette-group">
            <button className="primary" onClick={() => recompute(nodes, edges)}>▶ 运行模拟</button>
            <button onClick={check}>🔍 检查电路</button>
            <button className="answer" onClick={showAnswer}>✅ 正确答案</button>
            <button onClick={undo} disabled={histLen === 0}>↶ 撤回</button>
            <button onClick={() => loadPractice(practice)}>↺ 重置</button>
          </div>
          <div className="tips">
            接线：从端子（小圆点）拖到另一个端子，端子不分方向。平行线会自动错开走，不挤成一束。<br />
            开关：点击切换合/断。<br />
            按钮：按住生效，松开复位。<br />
            删线：选中线后按 Delete 键。
          </div>
          <div className="legend">
            <div><span className="sw" style={{ background: '#dc2626' }} />火线 / 相</div>
            <div><span className="sw" style={{ background: '#2563eb' }} />零线 N</div>
            <div>
              <span className="sw sw-rainbow" />控制 / 触点线（每根独立色）
            </div>
          </div>
        </aside>

        <main className="canvas">
          <ReactFlow
            nodes={nodes}
            edges={displayEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeDragStart={() => snapshot()}
            onConnect={onConnect}
            onEdgeMouseEnter={(_, edge) => setHoverEdgeId(edge.id)}
            onEdgeMouseLeave={() => setHoverEdgeId(null)}
            onNodeMouseEnter={(_, node) => setHoverNodeId(node.id)}
            onNodeMouseLeave={() => setHoverNodeId(null)}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodeDragThreshold={5}
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.SmoothStep}
            defaultEdgeOptions={{ type: 'staggered', style: { strokeWidth: 2 } }}
            snapToGrid
            snapGrid={[16, 16]}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
          <SchematicRef practiceKey={practice.key} />
        </main>

        <aside className="panel">
          <h2>运行状态</h2>
          {!result && <p className="muted">尚未运行。接好线后点「运行模拟」。</p>}
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
                  .map((c) => (
                    <li key={c.id}>
                      {c.id}：
                      {c.working !== undefined && (c.working ? '✅ 工作' : '⚪ 未工作')}
                      {c.energized !== undefined && (c.energized ? '🔵 得电' : '⚪ 失电')}
                    </li>
                  ))}
              </ul>

              <h3>检查结果 {allOk ? '✅' : '⚠️'}</h3>
              {allOk && <p className="ok">没有发现问题。</p>}
              <ul className="error-list">
                {result.shorts.length > 0 && (
                  <li className="err">⛔ 短路风险（火线/相与零线无负载直连）。</li>
                )}
                {result.errors.map((e, i) => (
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
      </div>
    </CircuitCtx.Provider>
  );
}
