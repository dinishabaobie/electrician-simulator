import { useContext } from 'react';
import { Handle, type NodeProps } from '@xyflow/react';
import { DEFS } from './componentDefs.ts';
import { CircuitCtx } from './circuitContext.ts';
import { ComponentIcon, sizeOf } from './ComponentIcons.tsx';

// 给新手看的中文名（按角色更贴切，否则用元件类别名）
function displayName(d: any): string {
  switch (d.role) {
    case 'stop_button': return '停止按钮';
    case 'start_button': return '启动按钮';
    case 'coil': return '接触器线圈';
    case 'aux_no': return '辅助常开触点';
    case 'main': return '主触点';
    case 'motor': return '电机';
  }
  return DEFS[d.type]?.label ?? d.type;
}

// 电工图标准位号：接触器三件套共用 KM1，其余用元件自身编号
function displayTag(d: any, id: string): string {
  return d.groupId ?? id;
}

function statusText(d: any): string {
  const sim = d.sim ?? {};
  switch (d.type) {
    case 'single_phase_power':
    case 'three_phase_power':
      return d.state?.on === false ? '断电' : '有电';
    case 'switch':
      return d.state?.closed ? '合' : '断';
    case 'button_no':
    case 'button_nc':
      return d.state?.pressed ? '按下' : '松开';
    case 'contactor_coil':
      return sim.energized ? '得电' : '失电';
    case 'contactor_main':
    case 'contactor_no':
      return sim.closed ? '闭合' : '断开';
    case 'lamp':
      return sim.working ? '亮' : '灭';
    case 'motor':
      return sim.working ? '运行' : '停止';
    default:
      return '';
  }
}

export function CircuitNode({ id, data }: NodeProps) {
  const d = data as any;
  const def = DEFS[d.type];
  const { toggle, press } = useContext(CircuitCtx);
  const { w, h } = sizeOf(def);

  const lit = d.type === 'lamp' && d.sim?.working;
  const run = d.type === 'motor' && d.sim?.working;
  // 整个节点都可拖动：靠 React Flow 的拖拽阈值（nodeDragThreshold）区分
  // 「轻点 = 操作」和「按住拖动 = 移动」。所以这里不再加 nodrag、也不
  // stopPropagation——否则会把拖拽事件吃掉，导致按钮拖不动。
  const isInteractive = !!(def?.toggle || def?.momentary);
  const cls = ['node', `node-${d.type}`, lit ? 'is-lit' : '', run ? 'is-run' : ''].join(' ');

  // 开关：点击切换；按钮：按住生效（松开/移出即复位）
  const interactive: Record<string, unknown> = {};
  if (def?.toggle) interactive.onClick = () => toggle(id);
  if (def?.momentary) {
    interactive.onPointerDown = () => press(id, true);
    interactive.onPointerUp = () => press(id, false);
    interactive.onPointerLeave = () => press(id, false);
  }
  const title = def?.toggle ? '点击切换 合/断 · 按住拖动可移动'
    : def?.momentary ? '按住生效 · 按住拖动可移动' : '';

  return (
    <div className={cls} style={{ width: w, height: h }}>
      <span className="node-name">
        {displayName(d)}<i className="node-tag">{displayTag(d, id)}</i>
      </span>
      <div className="node-hit" title={title} {...interactive}>
        <ComponentIcon nid={id} type={d.type} def={def} state={d.state} sim={d.sim} />
      </div>
      <span className="node-status">{statusText(d)}</span>
      {def?.terminals.map((t) => (
        <Handle key={t.id} id={t.id} type="source" position={t.position}
          style={t.style} isConnectableStart isConnectableEnd />
      ))}
    </div>
  );
}
