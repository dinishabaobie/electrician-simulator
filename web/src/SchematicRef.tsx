import { useState } from 'react';

// 画布右上角的「参考原理图」面板：按当前练习显示一张干净的 SVG 电路原理图，
// 供学习者对照接线。符号用电工标准画法，配色与模拟器一致：火线红、零线蓝。

const HOT = '#dc2626'; // 火线 / 相
const NEU = '#2563eb'; // 零线 N
const LINE = '#334155'; // 元件 / 触点
const TXT = '#64748b';

function Dot({ x, y, c = LINE }: { x: number; y: number; c?: string }) {
  return <circle cx={x} cy={y} r={3} fill={c} />;
}
function T({ x, y, t, c = TXT, a = 'middle', s = 11 }:
  { x: number; y: number; t: string; c?: string; a?: 'start' | 'middle' | 'end'; s?: number }) {
  return <text x={x} y={y} textAnchor={a} fontSize={s} fill={c}>{t}</text>;
}

// 按钮的「按压执行器」：虚线 + 顶帽
function Push({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={LINE} strokeWidth={1.5} fill="none">
      <line x1={x} y1={y} x2={x} y2={y - 16} strokeDasharray="3 3" />
      <line x1={x - 6} y1={y - 16} x2={x + 6} y2={y - 16} />
    </g>
  );
}

// 水平常开触点（NO），左端入 (x,y)，宽 34；push=按钮
function NOH({ x, y, push, label }: { x: number; y: number; push?: boolean; label?: string }) {
  return (
    <g>
      <g stroke={LINE} strokeWidth={2} fill="none" strokeLinecap="round">
        <line x1={x} y1={y} x2={x + 8} y2={y} />
        <line x1={x + 8} y1={y} x2={x + 26} y2={y - 12} />
        <line x1={x + 26} y1={y} x2={x + 34} y2={y} />
      </g>
      {push && <Push x={x + 17} y={y - 6} />}
      <Dot x={x} y={y} />
      <Dot x={x + 34} y={y} />
      {label && <T x={x + 17} y={y + 18} t={label} />}
    </g>
  );
}

// 水平常闭触点（NC），左端入 (x,y)，宽 34；push=按钮
function NCH({ x, y, push, label }: { x: number; y: number; push?: boolean; label?: string }) {
  return (
    <g>
      <g stroke={LINE} strokeWidth={2} fill="none" strokeLinecap="round">
        <line x1={x} y1={y} x2={x + 8} y2={y} />
        <line x1={x + 8} y1={y} x2={x + 26} y2={y} />
        <line x1={x + 30} y1={y - 8} x2={x + 22} y2={y + 8} />
        <line x1={x + 26} y1={y} x2={x + 34} y2={y} />
      </g>
      {push && <Push x={x + 17} y={y} />}
      <Dot x={x} y={y} />
      <Dot x={x + 34} y={y} />
      {label && <T x={x + 17} y={y + 18} t={label} />}
    </g>
  );
}

// 线圈：矩形，左端入 (x,y)，总宽 56
function Coil({ x, y, label = 'KM' }: { x: number; y: number; label?: string }) {
  return (
    <g>
      <g stroke={LINE} strokeWidth={2} fill="none">
        <line x1={x} y1={y} x2={x + 6} y2={y} />
        <rect x={x + 6} y={y - 11} width={44} height={22} rx={2} fill="#fff" />
        <line x1={x + 50} y1={y} x2={x + 56} y2={y} />
      </g>
      <T x={x + 28} y={y + 4} t={label} c={LINE} />
    </g>
  );
}

// 灯：圆 + X
function Lamp({ cx, cy }: { cx: number; cy: number }) {
  const r = 13;
  const d = r * 0.7;
  return (
    <g stroke={LINE} strokeWidth={2} fill="none">
      <circle cx={cx} cy={cy} r={r} fill="#fff" />
      <line x1={cx - d} y1={cy - d} x2={cx + d} y2={cy + d} />
      <line x1={cx - d} y1={cy + d} x2={cx + d} y2={cy - d} />
    </g>
  );
}

// 电机：圆 + M 3~
function Motor({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={17} fill="#fff" stroke={LINE} strokeWidth={2} />
      <T x={cx} y={cy - 1} t="M" c={LINE} s={13} />
      <T x={cx} y={cy + 11} t="3~" s={8} />
    </g>
  );
}

// 竖直常开触点（NO），顶端入 (x,y)，高 30 —— 用于主触点
function NOV({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={LINE} strokeWidth={2} fill="none" strokeLinecap="round">
      <line x1={x} y1={y} x2={x} y2={y + 7} />
      <line x1={x} y1={y + 7} x2={x + 12} y2={y + 23} />
      <line x1={x} y1={y + 23} x2={x} y2={y + 30} />
    </g>
  );
}

// 三相主电路：三相 → KM 主触点（3 NO 联动）→ 电机
function MainCircuit({ y0 }: { y0: number }) {
  const xs = [96, 132, 168];
  const top = y0;
  const cTop = y0 + 16;
  const cBot = cTop + 30;
  const motorTop = cBot + 8;
  const mcx = 132;
  const mcy = motorTop + 20;
  return (
    <g>
      {xs.map((x, i) => (
        <g key={i}>
          <Dot x={x} y={top} c={HOT} />
          <line x1={x} y1={top} x2={x} y2={cTop} stroke={HOT} strokeWidth={2} />
          <NOV x={x} y={cTop} />
          <line x1={x} y1={cBot} x2={x} y2={motorTop} stroke={LINE} strokeWidth={2} />
          <line x1={x} y1={motorTop} x2={mcx} y2={mcy - 16} stroke={LINE} strokeWidth={2} />
        </g>
      ))}
      <T x={xs[0]} y={top - 6} t="L1" c={HOT} />
      <T x={xs[1]} y={top - 6} t="L2" c={HOT} />
      <T x={xs[2]} y={top - 6} t="L3" c={HOT} />
      {/* 联动虚线（同一接触器） */}
      <line x1={xs[0] + 6} y1={cTop + 18} x2={xs[2] + 6} y2={cTop + 18}
        stroke={LINE} strokeWidth={1.5} strokeDasharray="3 3" />
      <T x={xs[2] + 34} y={cTop + 4} t="KM 主触点" a="start" />
      <Motor cx={mcx} cy={mcy} />
    </g>
  );
}

// ── 三张原理图 ───────────────────────────────────────────────

function SingleLight() {
  const y = 50;
  return (
    <svg viewBox="0 0 300 92">
      <line x1={16} y1={y} x2={64} y2={y} stroke={HOT} strokeWidth={2} />
      <NOH x={64} y={y} label="开关" />
      <line x1={98} y1={y} x2={151} y2={y} stroke={HOT} strokeWidth={2} />
      <Lamp cx={164} cy={y} />
      <line x1={177} y1={y} x2={284} y2={y} stroke={NEU} strokeWidth={2} />
      <Dot x={16} y={y} c={HOT} />
      <Dot x={284} y={y} c={NEU} />
      <T x={16} y={y - 12} t="火线 L" c={HOT} a="start" />
      <T x={284} y={y - 12} t="零线 N" c={NEU} a="end" />
      <T x={164} y={y + 26} t="灯" />
    </svg>
  );
}

// 控制回路（点动 / 自锁共用骨架）。selfLock=true 时加并联自锁触点。
function ControlMotor({ selfLock }: { selfLock?: boolean }) {
  const y = 40;
  // 节点：A = 停止后 / 启动前；B = 启动后 / 线圈前
  const ax = 90;
  const bx = 134;
  return (
    <svg viewBox="0 0 300 250">
      {/* 控制回路 220V */}
      <line x1={16} y1={y} x2={44} y2={y} stroke={HOT} strokeWidth={2} />
      <NCH x={44} y={y} push label="停止" />
      <line x1={78} y1={y} x2={ax} y2={y} stroke={LINE} strokeWidth={2} />
      <NOH x={ax + 2} y={y} push label="启动" />
      <line x1={ax + 36} y1={y} x2={bx} y2={y} stroke={LINE} strokeWidth={2} />
      <Coil x={bx + 4} y={y} />
      <line x1={bx + 60} y1={y} x2={284} y2={y} stroke={NEU} strokeWidth={2} />
      <Dot x={16} y={y} c={HOT} />
      <Dot x={284} y={y} c={NEU} />
      <T x={16} y={y - 12} t="L1" c={HOT} a="start" />
      <T x={284} y={y - 12} t="N" c={NEU} a="end" />

      {/* 自锁：辅助常开触点与启动按钮并联 */}
      {selfLock && (
        <g>
          <line x1={ax} y1={y} x2={ax} y2={y + 26} stroke={LINE} strokeWidth={2} />
          <line x1={ax} y1={y + 26} x2={ax + 2} y2={y + 26} stroke={LINE} strokeWidth={2} />
          <NOH x={ax + 2} y={y + 26} label="KM 自锁" />
          <line x1={ax + 36} y1={y + 26} x2={bx} y2={y + 26} stroke={LINE} strokeWidth={2} />
          <line x1={bx} y1={y + 26} x2={bx} y2={y} stroke={LINE} strokeWidth={2} />
        </g>
      )}

      {/* 分隔 */}
      <line x1={12} y1={selfLock ? 96 : 84} x2={288} y2={selfLock ? 96 : 84}
        stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 4" />
      <T x={12} y={selfLock ? 110 : 98} t="控制回路 220V" a="start" s={10} />

      {/* 主回路 380V */}
      <MainCircuit y0={selfLock ? 128 : 116} />
    </svg>
  );
}

const DIAGRAMS: Record<string, { title: string; el: JSX.Element }> = {
  single_light: { title: '单灯单控 · 原理图', el: <SingleLight /> },
  point_control: { title: '接触器点动 · 原理图', el: <ControlMotor /> },
  self_lock: { title: '接触器自锁 · 原理图', el: <ControlMotor selfLock /> },
};

export function SchematicRef({ practiceKey }: { practiceKey: string }) {
  const [open, setOpen] = useState(true);
  const d = DIAGRAMS[practiceKey];
  if (!d) return null;
  return (
    <div className={`schematic-ref${open ? '' : ' collapsed'}`}>
      <header onClick={() => setOpen((v) => !v)}>
        <b>📐 {d.title}</b>
        <span className="toggle">{open ? '收起 ▴' : '展开 ▾'}</span>
      </header>
      <div className="body">{d.el}</div>
    </div>
  );
}
