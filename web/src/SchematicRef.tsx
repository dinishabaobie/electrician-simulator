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

// 三相主电路：三相 → KM 主触点（3 NO 联动）→ [FR 热元件] → 电机
// dx 横向平移；km/motorName 用于一张图里画多路主回路时的紧凑位号
function MainCircuit({ y0, overload, dx = 0, km, motorName }:
  { y0: number; overload?: boolean; dx?: number; km?: string; motorName?: string }) {
  const xs = [96, 132, 168].map((x) => x + dx);
  const top = y0;
  const cTop = y0 + 16;
  const cBot = cTop + 30;
  const frTop = cBot + 6;
  const frBot = overload ? frTop + 16 : cBot;
  const motorTop = frBot + 8;
  const mcx = xs[1];
  const mcy = motorTop + 20;
  return (
    <g>
      {xs.map((x, i) => (
        <g key={i}>
          <Dot x={x} y={top} c={HOT} />
          <line x1={x} y1={top} x2={x} y2={cTop} stroke={HOT} strokeWidth={2} />
          <NOV x={x} y={cTop} />
          {overload && (
            <g stroke={LINE} strokeWidth={2} fill="#fff">
              <line x1={x} y1={cBot} x2={x} y2={frTop} />
              <rect x={x - 5} y={frTop} width={10} height={16} />
            </g>
          )}
          <line x1={x} y1={frBot} x2={x} y2={motorTop} stroke={LINE} strokeWidth={2} />
          <line x1={x} y1={motorTop} x2={mcx} y2={mcy - 16} stroke={LINE} strokeWidth={2} />
        </g>
      ))}
      <T x={xs[0]} y={top - 6} t="L1" c={HOT} />
      <T x={xs[1]} y={top - 6} t="L2" c={HOT} />
      <T x={xs[2]} y={top - 6} t="L3" c={HOT} />
      {/* 联动虚线（同一接触器） */}
      <line x1={xs[0] + 6} y1={cTop + 18} x2={xs[2] + 6} y2={cTop + 18}
        stroke={LINE} strokeWidth={1.5} strokeDasharray="3 3" />
      {km
        ? <T x={xs[0] - 12} y={cTop + 16} t={km} a="end" />
        : <T x={xs[2] + 34} y={cTop + 4} t="KM 主触点" a="start" />}
      {overload && (km
        ? <T x={xs[0] - 12} y={frTop + 13} t={km.replace('KM', 'FR')} a="end" />
        : <T x={xs[2] + 34} y={frTop + 13} t="FR 热元件" a="start" />)}
      <Motor cx={mcx} cy={mcy} />
      {motorName && <T x={mcx} y={mcy + 31} t={motorName} />}
    </g>
  );
}

// 两台电动机顺序启动（教材接法）：L → FR1常闭 → FR2常闭 → 节点③分两支；
// M1 支：SB12停 → SB11启（自锁）→ KM1；
// M2 支：SB22停 → SB21启（自锁）→ KM1顺序常开 → KM2。
// SB12 停 KM1 后顺序触点断开，KM2 级联跟停；SB22 只停 M2。
function SeqStart() {
  const y1 = 40;
  const y2 = 124;
  return (
    <svg viewBox="0 0 340 352">
      {/* 控制总线 + M1 支路 */}
      <line x1={16} y1={y1} x2={30} y2={y1} stroke={HOT} strokeWidth={2} />
      <NCH x={30} y={y1} label="FR1" />
      <line x1={64} y1={y1} x2={78} y2={y1} stroke={LINE} strokeWidth={2} />
      <NCH x={78} y={y1} label="FR2" />
      <line x1={112} y1={y1} x2={130} y2={y1} stroke={LINE} strokeWidth={2} />
      <NCH x={130} y={y1} push label="SB12" />
      <line x1={164} y1={y1} x2={176} y2={y1} stroke={LINE} strokeWidth={2} />
      <NOH x={176} y={y1} push label="SB11" />
      <line x1={210} y1={y1} x2={220} y2={y1} stroke={LINE} strokeWidth={2} />
      <Coil x={220} y={y1} label="KM1" />
      <line x1={276} y1={y1} x2={324} y2={y1} stroke={NEU} strokeWidth={2} />
      <Dot x={16} y={y1} c={HOT} />
      <Dot x={324} y={y1} c={NEU} />
      <T x={16} y={y1 - 12} t="L1" c={HOT} a="start" />
      <T x={324} y={y1 - 12} t="N" c={NEU} a="end" />

      {/* M1 自锁：与 SB11 并联 */}
      <line x1={172} y1={y1} x2={172} y2={y1 + 26} stroke={LINE} strokeWidth={2} />
      <NOH x={174} y={y1 + 26} label="KM1 自锁" />
      <line x1={208} y1={y1 + 26} x2={214} y2={y1 + 26} stroke={LINE} strokeWidth={2} />
      <line x1={214} y1={y1 + 26} x2={214} y2={y1} stroke={LINE} strokeWidth={2} />
      <Dot x={172} y={y1} />
      <Dot x={214} y={y1} />

      {/* M2 支路：从节点③（FR2 之后、SB12 之前）引出 */}
      <line x1={124} y1={y1} x2={124} y2={y2} stroke={LINE} strokeWidth={2} />
      <NCH x={126} y={y2} push label="SB22" />
      <line x1={160} y1={y2} x2={174} y2={y2} stroke={LINE} strokeWidth={2} />
      <NOH x={174} y={y2} push label="SB21" />
      <line x1={208} y1={y2} x2={218} y2={y2} stroke={LINE} strokeWidth={2} />
      <NOH x={218} y={y2} label="KM1 顺序" />
      <line x1={252} y1={y2} x2={258} y2={y2} stroke={LINE} strokeWidth={2} />
      <Coil x={258} y={y2} label="KM2" />
      <line x1={314} y1={y2} x2={324} y2={y2} stroke={NEU} strokeWidth={2} />
      <line x1={324} y1={y1} x2={324} y2={y2} stroke={NEU} strokeWidth={2} />
      <Dot x={124} y={y1} />

      {/* M2 自锁：与 SB21 并联 */}
      <line x1={168} y1={y2} x2={168} y2={y2 + 26} stroke={LINE} strokeWidth={2} />
      <NOH x={170} y={y2 + 26} label="KM2 自锁" />
      <line x1={204} y1={y2 + 26} x2={212} y2={y2 + 26} stroke={LINE} strokeWidth={2} />
      <line x1={212} y1={y2 + 26} x2={212} y2={y2} stroke={LINE} strokeWidth={2} />
      <Dot x={168} y={y2} />
      <Dot x={212} y={y2} />

      {/* 分隔 + 两路主回路（各带 FR 热元件） */}
      <line x1={12} y1={192} x2={328} y2={192} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 4" />
      <T x={12} y={205} t="控制回路 220V" a="start" s={10} />
      <MainCircuit y0={218} dx={-50} km="KM1" motorName="M1" overload />
      <MainCircuit y0={218} dx={104} km="KM2" motorName="M2" overload />
    </svg>
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

// 控制回路（点动 / 自锁共用骨架）。selfLock=true 加并联自锁触点；
// overload=true 加热继：控制回路串 FR 常闭，主回路串 FR 热元件。
function ControlMotor({ selfLock, overload }: { selfLock?: boolean; overload?: boolean }) {
  const y = 40;
  // 节点：A = 停止后 / 启动前；B = 启动后 / 线圈前
  const ax = 90;
  const bx = 134;
  return (
    <svg viewBox={`0 0 300 ${overload ? 262 : 250}`}>
      {/* 控制回路 220V */}
      <line x1={16} y1={y} x2={44} y2={y} stroke={HOT} strokeWidth={2} />
      <NCH x={44} y={y} push label="停止" />
      <line x1={78} y1={y} x2={ax} y2={y} stroke={LINE} strokeWidth={2} />
      <NOH x={ax + 2} y={y} push label="启动" />
      <line x1={ax + 36} y1={y} x2={bx} y2={y} stroke={LINE} strokeWidth={2} />
      <Coil x={bx + 4} y={y} />
      {overload ? (
        <g>
          <line x1={bx + 60} y1={y} x2={bx + 72} y2={y} stroke={LINE} strokeWidth={2} />
          <NCH x={bx + 72} y={y} label="FR" />
          <line x1={bx + 106} y1={y} x2={284} y2={y} stroke={NEU} strokeWidth={2} />
        </g>
      ) : (
        <line x1={bx + 60} y1={y} x2={284} y2={y} stroke={NEU} strokeWidth={2} />
      )}
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
      <MainCircuit y0={selfLock ? 128 : 116} overload={overload} />
    </svg>
  );
}

// 接触器互锁：两条支路各串对方常闭
function Interlock() {
  const y1 = 40;
  const y2 = 104;
  return (
    <svg viewBox="0 0 300 150">
      {[
        { y: y1, sel: 'SA2·1', nc: 'KM3 常闭', coil: 'KM2' },
        { y: y2, sel: 'SA2·2', nc: 'KM2 常闭', coil: 'KM3' },
      ].map((r) => (
        <g key={r.y}>
          <line x1={16} y1={r.y} x2={40} y2={r.y} stroke={HOT} strokeWidth={2} />
          <NOH x={40} y={r.y} label={r.sel} />
          <line x1={74} y1={r.y} x2={110} y2={r.y} stroke={LINE} strokeWidth={2} />
          <NCH x={110} y={r.y} label={r.nc} />
          <line x1={144} y1={r.y} x2={170} y2={r.y} stroke={LINE} strokeWidth={2} />
          <Coil x={170} y={r.y} label={r.coil} />
          <line x1={226} y1={r.y} x2={284} y2={r.y} stroke={NEU} strokeWidth={2} />
        </g>
      ))}
      <line x1={16} y1={y1} x2={16} y2={y2} stroke={HOT} strokeWidth={2} />
      <line x1={284} y1={y1} x2={284} y2={y2} stroke={NEU} strokeWidth={2} />
      <Dot x={16} y={y1} c={HOT} />
      <Dot x={284} y={y1} c={NEU} />
      <T x={16} y={y1 - 12} t="L" c={HOT} a="start" />
      <T x={284} y={y1 - 12} t="N" c={NEU} a="end" />
    </svg>
  );
}

// 断路器触点符号（水平，宽 34）：开关折线 + 触点端的 × 记号
function QFH({ x, y, label }: { x: number; y: number; label?: string }) {
  return (
    <g>
      <g stroke={LINE} strokeWidth={2} fill="none" strokeLinecap="round">
        <line x1={x} y1={y} x2={x + 8} y2={y} />
        <line x1={x + 8} y1={y} x2={x + 26} y2={y - 12} />
        <line x1={x + 26} y1={y} x2={x + 34} y2={y} />
        <line x1={x + 4} y1={y - 4} x2={x + 12} y2={y + 4} />
        <line x1={x + 4} y1={y + 4} x2={x + 12} y2={y - 4} />
      </g>
      <Dot x={x} y={y} />
      <Dot x={x + 34} y={y} />
      {label && <T x={x + 17} y={y + 18} t={label} />}
    </g>
  );
}

// 牵引机控制回路（简化）：QF1/QF2 断路器 + 启动控制（自锁+延时+风机）+ 选挡互锁 + 主回路示意
function Traction() {
  const y1 = 36;
  const yf = 78;   // 风机并联支路
  const y2 = 130;  // 选挡支路一
  const y3 = 172;  // 选挡支路二
  return (
    <svg viewBox="0 0 340 518">
      {/* 启动控制：QF2 → SB1(∥自锁) → SB2 → KT1 → KM1 线圈 */}
      <line x1={12} y1={y1} x2={20} y2={y1} stroke={HOT} strokeWidth={2} />
      <QFH x={20} y={y1} label="QF2" />
      <line x1={54} y1={y1} x2={66} y2={y1} stroke={LINE} strokeWidth={2} />
      <NOH x={66} y={y1} push label="SB1" />
      <line x1={100} y1={y1} x2={112} y2={y1} stroke={LINE} strokeWidth={2} />
      <NCH x={112} y={y1} push label="SB2" />
      <line x1={146} y1={y1} x2={152} y2={y1} stroke={LINE} strokeWidth={2} />
      <NOH x={152} y={y1} label="KT1 延时" />
      <line x1={186} y1={y1} x2={196} y2={y1} stroke={LINE} strokeWidth={2} />
      <Coil x={196} y={y1} label="KM1" />
      <line x1={252} y1={y1} x2={316} y2={y1} stroke={NEU} strokeWidth={2} />
      <Dot x={12} y={y1} c={HOT} />
      <Dot x={316} y={y1} c={NEU} />
      <T x={12} y={y1 - 12} t="L1(经QF1)" c={HOT} a="start" s={9} />
      <T x={316} y={y1 - 12} t="N" c={NEU} a="end" />
      {/* 自锁：与 SB1 并联 */}
      <line x1={66} y1={y1} x2={66} y2={y1 + 24} stroke={LINE} strokeWidth={2} />
      <NOH x={68} y={y1 + 24} label="KM1 自锁" />
      <line x1={102} y1={y1 + 24} x2={108} y2={y1 + 24} stroke={LINE} strokeWidth={2} />
      <line x1={108} y1={y1 + 24} x2={108} y2={y1} stroke={LINE} strokeWidth={2} />
      <Dot x={66} y={y1} />
      <Dot x={108} y={y1} />
      {/* 风机 MF1/MF2 与线圈并联 */}
      <line x1={192} y1={y1} x2={192} y2={yf} stroke={LINE} strokeWidth={2} />
      <line x1={192} y1={yf} x2={206} y2={yf} stroke={LINE} strokeWidth={2} />
      <circle cx={218} cy={yf} r={11} fill="#fff" stroke={LINE} strokeWidth={2} />
      <T x={218} y={yf + 4} t="MF" c={LINE} s={9} />
      <line x1={229} y1={yf} x2={316} y2={yf} stroke={NEU} strokeWidth={2} />
      <line x1={316} y1={y1} x2={316} y2={yf} stroke={NEU} strokeWidth={2} />
      <Dot x={192} y={y1} />
      <T x={250} y={yf - 6} t="轴流风机 ×2" s={9} />
      {/* 选挡互锁两支路（从 QF2 之后的母线引出） */}
      <line x1={60} y1={y1} x2={60} y2={y3} stroke={LINE} strokeWidth={2} />
      <Dot x={60} y={y1} />
      {[
        { y: y2, sel: 'SA2·1', nc: 'KM3', coil: 'KM2' },
        { y: y3, sel: 'SA2·2', nc: 'KM2', coil: 'KM3' },
      ].map((r) => (
        <g key={r.y}>
          <line x1={60} y1={r.y} x2={66} y2={r.y} stroke={LINE} strokeWidth={2} />
          <NOH x={66} y={r.y} label={r.sel} />
          <line x1={100} y1={r.y} x2={120} y2={r.y} stroke={LINE} strokeWidth={2} />
          <NCH x={120} y={r.y} label={`${r.nc} 互锁`} />
          <line x1={154} y1={r.y} x2={196} y2={r.y} stroke={LINE} strokeWidth={2} />
          <Coil x={196} y={r.y} label={r.coil} />
          <line x1={252} y1={r.y} x2={316} y2={r.y} stroke={NEU} strokeWidth={2} />
        </g>
      ))}
      <line x1={316} y1={yf} x2={316} y2={y3} stroke={NEU} strokeWidth={2} />
      {/* 主回路示意（单线图）：三相 → QF1 → KM1 → KM2/KM3 → 牵引电机 */}
      <line x1={12} y1={212} x2={328} y2={212} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 4" />
      <T x={12} y={225} t="主回路（单线表示三相；电压真模拟）" a="start" s={9} />
      <T x={170} y={244} t="三相 380V" c={HOT} s={9} />
      <line x1={170} y1={248} x2={170} y2={256} stroke={HOT} strokeWidth={2} />
      {/* QF1：竖向断路器（折线 + ×） */}
      <g stroke={LINE} strokeWidth={2} fill="none" strokeLinecap="round">
        <line x1={170} y1={256} x2={170} y2={262} />
        <line x1={170} y1={262} x2={182} y2={278} />
        <line x1={170} y1={278} x2={170} y2={284} />
        <line x1={166} y1={266} x2={174} y2={274} />
        <line x1={166} y1={274} x2={174} y2={266} />
      </g>
      <T x={186} y={274} t="QF1" a="start" s={10} />
      <line x1={170} y1={284} x2={170} y2={290} stroke={LINE} strokeWidth={2} />
      <NOV x={170} y={290} />
      <T x={182} y={308} t="KM1" a="start" s={10} />
      {/* T1 变压器（摆设）：双圆圈符号 */}
      <line x1={170} y1={320} x2={170} y2={326} stroke={LINE} strokeWidth={2} />
      <circle cx={170} cy={336} r={9} fill="none" stroke={LINE} strokeWidth={2} />
      <circle cx={170} cy={349} r={9} fill="none" stroke={LINE} strokeWidth={2} />
      <T x={186} y={346} t="T1 60/45/30V" a="start" s={9} />
      <line x1={170} y1={358} x2={170} y2={366} stroke={LINE} strokeWidth={2} />
      <line x1={130} y1={366} x2={210} y2={366} stroke={LINE} strokeWidth={2} />
      <line x1={130} y1={366} x2={130} y2={372} stroke={LINE} strokeWidth={2} />
      <line x1={210} y1={366} x2={210} y2={372} stroke={LINE} strokeWidth={2} />
      <NOV x={130} y={372} />
      <NOV x={210} y={372} />
      <T x={118} y={390} t="KM2" a="end" s={10} />
      <T x={222} y={390} t="KM3" a="start" s={10} />
      <line x1={130} y1={402} x2={130} y2={410} stroke={LINE} strokeWidth={2} />
      <line x1={210} y1={402} x2={210} y2={410} stroke={LINE} strokeWidth={2} />
      <line x1={130} y1={410} x2={210} y2={410} stroke={LINE} strokeWidth={2} />
      {/* 整流桥（摆设）：二极管符号 */}
      <line x1={170} y1={410} x2={170} y2={416} stroke={LINE} strokeWidth={2} />
      <g stroke={LINE} strokeWidth={1.6} fill="none">
        <path d="M164,418 L176,418 L170,428 Z" fill="#334155" stroke="none" />
        <line x1={164} y1={428} x2={176} y2={428} />
      </g>
      <T x={182} y={426} t="整流 V1~V6" a="start" s={9} />
      <line x1={170} y1={428} x2={170} y2={438} stroke={LINE} strokeWidth={2} />
      {/* 电流表 PA1 串联、电压表 PV1 跨接（摆设） */}
      <circle cx={170} cy={448} r={9} fill="#fff" stroke={LINE} strokeWidth={1.8} />
      <T x={170} y={452} t="A" c={LINE} s={10} />
      <T x={156} y={452} t="PA1" a="end" s={8} />
      <circle cx={228} cy={448} r={9} fill="#fff" stroke={LINE} strokeWidth={1.8} />
      <T x={228} y={452} t="V" c={LINE} s={10} />
      <T x={242} y={452} t="PV1" a="start" s={8} />
      <line x1={179} y1={448} x2={219} y2={448} stroke={LINE} strokeWidth={1} strokeDasharray="3 3" />
      <line x1={170} y1={457} x2={170} y2={464} stroke={LINE} strokeWidth={2} />
      <Motor cx={170} cy={481} />
      <T x={170} y={512} t="牵引电机" s={9} />
    </svg>
  );
}

const DIAGRAMS: Record<string, { title: string; el: JSX.Element }> = {
  single_light: { title: '单灯单控 · 原理图', el: <SingleLight /> },
  point_control: { title: '接触器点动 · 原理图', el: <ControlMotor /> },
  self_lock: { title: '接触器自锁 · 原理图', el: <ControlMotor selfLock /> },
  self_lock_overload: { title: '自锁 + 热保护 · 原理图', el: <ControlMotor selfLock overload /> },
  seq_start: { title: '两台电机顺序启动 · 原理图', el: <SeqStart /> },
  interlock: { title: '接触器互锁 · 原理图', el: <Interlock /> },
  traction: { title: '牵引机控制回路 · 原理图', el: <Traction /> },
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
