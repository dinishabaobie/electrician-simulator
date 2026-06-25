// 写实风元件图形（SVG + 渐变光影），随状态变化。
import type { CompDef, TermDef } from './componentDefs.ts';

export function sizeOf(def: CompDef) {
  return { w: def.w, h: def.h };
}

function termXY(t: TermDef, w: number, h: number) {
  const p = parseFloat((t.style.top ?? t.style.left) as string);
  switch (t.position) {
    case 'left': return { x: 0, y: (h * p) / 100 };
    case 'right': return { x: w, y: (h * p) / 100 };
    case 'top': return { x: (w * p) / 100, y: 0 };
    default: return { x: (w * p) / 100, y: h };
  }
}

const WIRE = '#3f4651';

// 端子引线：从元件锚点拉到端子位置，端头一个金属焊点
function leads(def: CompDef, w: number, h: number, anchors: Record<string, [number, number]>) {
  return def.terminals.map((t) => {
    const { x, y } = termXY(t, w, h);
    const a = anchors[t.id];
    if (!a) return null;
    return (
      <g key={t.id}>
        <line x1={x} y1={y} x2={a[0]} y2={a[1]} stroke={WIRE} strokeWidth={2.4} strokeLinecap="round" />
        <circle cx={x} cy={y} r={3} fill="#cbd5e1" stroke="#64748b" strokeWidth={1} />
      </g>
    );
  });
}

interface Props {
  nid: string;
  type: string;
  def: CompDef;
  state: any;
  sim: any;
}

export function ComponentIcon({ nid, type, def, state, sim }: Props) {
  const { w, h } = sizeOf(def);
  const cx = w / 2;
  const cy = h / 2;
  const g = (s: string) => `${nid}-${s}`;
  const on = !!sim?.energized;
  const closed = !!sim?.closed;
  const lit = !!sim?.working && type === 'lamp';
  const run = !!sim?.working && type === 'motor';

  const wrap = (children: any, defs?: any) => (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="icon-svg" style={{ overflow: 'visible' }}>
      {defs}
      {children}
    </svg>
  );

  switch (type) {
    // ---- 真实灯泡：玻璃壳 + 钨丝 + 螺口铜底 ----
    case 'lamp': {
      const tx = (p: number) => (w * p) / 100;
      return wrap(
        <>
          {lit && <circle cx={cx} cy={32} r={34} fill={`url(#${g('glow')})`} />}
          <circle cx={cx} cy={32} r={21} fill={`url(#${g('glass')})`} stroke={lit ? '#e6a700' : '#aebac4'} strokeWidth={1.5} />
          {/* 钨丝 */}
          <path d={`M${cx - 8},34 L${cx - 4},24 L${cx},34 L${cx + 4},24 L${cx + 8},34`}
            fill="none" stroke={lit ? '#ff7a00' : '#9aa3ad'} strokeWidth={lit ? 2.2 : 1.6} strokeLinejoin="round" />
          <line x1={cx - 8} y1={34} x2={cx - 8} y2={47} stroke={lit ? '#ffae42' : '#9aa3ad'} strokeWidth={1.4} />
          <line x1={cx + 8} y1={34} x2={cx + 8} y2={47} stroke={lit ? '#ffae42' : '#9aa3ad'} strokeWidth={1.4} />
          {/* 玻璃高光 */}
          <ellipse cx={cx - 7} cy={25} rx={4} ry={7} fill="#ffffff" opacity={0.55} />
          {/* 颈部 */}
          <path d={`M${cx - 13},47 L${cx - 10},57 L${cx + 10},57 L${cx + 13},47 Z`} fill="#e9eef2" stroke="#aebac4" strokeWidth={1} />
          {/* 螺口铜底 */}
          <rect x={cx - 11} y={56} width={22} height={15} rx={2} fill={`url(#${g('brass')})`} stroke="#9a7b2e" strokeWidth={0.8} />
          <line x1={cx - 11} y1={60} x2={cx + 11} y2={60} stroke="#9a7b2e" strokeWidth={0.8} opacity={0.6} />
          <line x1={cx - 11} y1={64} x2={cx + 11} y2={64} stroke="#9a7b2e" strokeWidth={0.8} opacity={0.6} />
          <ellipse cx={cx} cy={72} rx={6} ry={2.4} fill="#3a3a3a" />
          {/* 引线到底部端子 */}
          <path d={`M${cx - 7},71 L${tx(34)},${h}`} fill="none" stroke={WIRE} strokeWidth={2.4} strokeLinecap="round" />
          <path d={`M${cx + 7},71 L${tx(66)},${h}`} fill="none" stroke={WIRE} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={tx(34)} cy={h} r={3} fill="#cbd5e1" stroke="#64748b" strokeWidth={1} />
          <circle cx={tx(66)} cy={h} r={3} fill="#cbd5e1" stroke="#64748b" strokeWidth={1} />
        </>,
        <defs>
          <radialGradient id={g('glass')} cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor={lit ? '#fff7cc' : '#ffffff'} />
            <stop offset="55%" stopColor={lit ? '#ffe35c' : '#eef3f6'} />
            <stop offset="100%" stopColor={lit ? '#ffcf33' : '#d6dee4'} />
          </radialGradient>
          <radialGradient id={g('glow')} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff3b0" stopOpacity={0.95} />
            <stop offset="60%" stopColor="#ffdf6b" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#ffdf6b" stopOpacity={0} />
          </radialGradient>
          <linearGradient id={g('brass')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e7c873" />
            <stop offset="50%" stopColor="#c9a13e" />
            <stop offset="100%" stopColor="#a9842c" />
          </linearGradient>
        </defs>,
      );
    }

    // ---- 真实电机：钢制机身 + 散热筋 + 轴 + 接线盒 ----
    case 'motor': {
      const accent = run ? '#1f9d55' : '#5b6675';
      return wrap(
        <>
          {leads(def, w, h, { U: [(w * 28) / 100, 22], V: [cx, 22], W: [(w * 72) / 100, 22] })}
          {/* 接线盒 */}
          <rect x={cx - 22} y={14} width={44} height={14} rx={2} fill="#2f3742" />
          {/* 机身 */}
          <rect x={14} y={30} width={w - 38} height={42} rx={9} fill={`url(#${g('steel')})`} stroke="#5b6675" strokeWidth={1.2} />
          {/* 散热筋 */}
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={i} x1={24 + i * 10} y1={32} x2={24 + i * 10} y2={70} stroke="#7c8794" strokeWidth={1} opacity={0.6} />
          ))}
          {/* 端盖 */}
          <ellipse cx={16} cy={51} rx={7} ry={21} fill={`url(#${g('steelEnd')})`} stroke="#5b6675" strokeWidth={1} />
          <ellipse cx={w - 24} cy={51} rx={6} ry={20} fill={`url(#${g('steelEnd')})`} stroke="#5b6675" strokeWidth={1} />
          {/* 轴 */}
          <rect x={w - 24} y={47} width={16} height={8} rx={1.5} fill="#9aa3ad" stroke="#6b7785" strokeWidth={0.8} />
          {/* 底脚 */}
          <rect x={26} y={70} width={14} height={7} rx={1} fill="#3f4651" />
          <rect x={w - 54} y={70} width={14} height={7} rx={1} fill="#3f4651" />
          {/* 铭牌 */}
          <circle cx={cx} cy={51} r={13} fill="#283039" stroke={accent} strokeWidth={2} />
          <text x={cx} y={50} textAnchor="middle" fontSize="13" fontWeight="700" fill={run ? '#5ee49b' : '#cbd5e1'}>M</text>
          <text x={cx} y={61} textAnchor="middle" fontSize="7" fill={run ? '#5ee49b' : '#9aa3ad'}>3~</text>
          {run && <text x={cx + 16} y={40} fontSize="11" fill="#1f9d55">↻</text>}
        </>,
        <defs>
          <linearGradient id={g('steel')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={run ? '#dcfce7' : '#eef2f5'} />
            <stop offset="45%" stopColor={run ? '#b7e8c9' : '#c2ccd6'} />
            <stop offset="100%" stopColor={run ? '#86c79f' : '#8a97a5'} />
          </linearGradient>
          <linearGradient id={g('steelEnd')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#aeb9c4" />
            <stop offset="100%" stopColor="#7c8794" />
          </linearGradient>
        </defs>,
      );
    }

    // ---- 真实墙壁开关（翘板）----
    case 'switch': {
      const onState = !!state?.closed;
      return wrap(
        <>
          {leads(def, w, h, { in: [16, cy + 2], out: [w - 16, cy + 2] })}
          <rect x={14} y={8} width={w - 28} height={h - 18} rx={7} fill={`url(#${g('plate')})`} stroke="#c2ccd6" strokeWidth={1.2} />
          {/* 翘板 */}
          <rect x={24} y={16} width={w - 48} height={h - 34} rx={5} fill={onState ? `url(#${g('rockOn')})` : `url(#${g('rockOff')})`} stroke="#9aa7b3" strokeWidth={1} />
          <line x1={cx} y1={onState ? 20 : 18} x2={cx} y2={onState ? h - 22 : h - 24} stroke={onState ? '#138a47' : '#8893a0'} strokeWidth={1} opacity={0.5} />
          <text x={cx} y={onState ? 27 : cy - 2} textAnchor="middle" fontSize="9" fontWeight="700" fill={onState ? '#0d6b36' : '#b3bcc6'}>I</text>
          <text x={cx} y={onState ? cy + 12 : h - 18} textAnchor="middle" fontSize="9" fontWeight="700" fill={onState ? '#9fb6a8' : '#6b7785'}>O</text>
        </>,
        <defs>
          <linearGradient id={g('plate')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbfdfe" /><stop offset="100%" stopColor="#dde5ec" />
          </linearGradient>
          <linearGradient id={g('rockOn')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d27e" /><stop offset="100%" stopColor="#13934e" />
          </linearGradient>
          <linearGradient id={g('rockOff')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f4f7fa" /><stop offset="100%" stopColor="#cfd8e0" />
          </linearGradient>
        </defs>,
      );
    }

    // ---- 真实面板按钮（启动绿/停止红，按下凹陷）----
    case 'button_no':
    case 'button_nc': {
      const pressed = !!state?.pressed;
      const nc = type === 'button_nc';
      const base = nc ? (pressed ? '#b91c1c' : '#dc2626') : (pressed ? '#15803d' : '#16a34a');
      const capY = pressed ? 22 : 16;
      return wrap(
        <>
          {leads(def, w, h, { in: [cx - 18, (h * 64) / 100], out: [cx + 18, (h * 64) / 100] })}
          {/* 安装座 */}
          <ellipse cx={cx} cy={50} rx={24} ry={9} fill="#cdd6df" />
          <rect x={cx - 24} y={36} width={48} height={16} fill="#cdd6df" />
          <ellipse cx={cx} cy={36} rx={24} ry={9} fill={`url(#${g('collar')})`} stroke="#94a3b1" strokeWidth={1} />
          {/* 按钮帽 */}
          <ellipse cx={cx} cy={capY + 12} rx={18} ry={7} fill={pressed ? base : '#0008'} opacity={pressed ? 1 : 0.18} />
          <ellipse cx={cx} cy={capY} rx={18} ry={9} fill={`url(#${g('cap')})`} stroke={base} strokeWidth={1} />
          <ellipse cx={cx - 4} cy={capY - 2} rx={7} ry={3} fill="#ffffff" opacity={0.35} />
          <text x={cx} y={h - 4} textAnchor="middle" fontSize="8" fill="#64748b">{nc ? '停止 NC' : '启动 NO'}</text>
        </>,
        <defs>
          <linearGradient id={g('collar')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#eef2f6" /><stop offset="100%" stopColor="#aab4be" />
          </linearGradient>
          <radialGradient id={g('cap')} cx="40%" cy="30%" r="80%">
            <stop offset="0%" stopColor={nc ? '#ff6b6b' : '#4ade80'} />
            <stop offset="60%" stopColor={base} />
            <stop offset="100%" stopColor={nc ? '#991b1b' : '#0d6b36'} />
          </radialGradient>
        </defs>,
      );
    }

    // ---- 接触器线圈（黑色塑壳 + 银螺钉 + 得电指示灯）----
    case 'contactor_coil':
      return wrap(
        <>
          {leads(def, w, h, { A1: [cx - 30, (h * 70) / 100], A2: [cx + 30, (h * 70) / 100] })}
          <rect x={cx - 32} y={8} width={64} height={h - 22} rx={4} fill={`url(#${g('case')})`} stroke="#11161c" strokeWidth={1} />
          <rect x={cx - 26} y={13} width={52} height={3} rx={1.5} fill="#11161c" opacity={0.5} />
          <circle cx={cx} cy={cy - 2} r={6} fill={on ? '#37e07f' : '#1c2530'} stroke={on ? '#0d6b36' : '#000'} strokeWidth={1} />
          {on && <circle cx={cx} cy={cy - 2} r={10} fill="#37e07f" opacity={0.3} />}
          <text x={cx} y={h - 18} textAnchor="middle" fontSize="11" fontWeight="700" fill="#e5e7eb">KM</text>
          <circle cx={cx - 30} cy={(h * 70) / 100} r={4} fill={`url(#${g('screw')})`} />
          <circle cx={cx + 30} cy={(h * 70) / 100} r={4} fill={`url(#${g('screw')})`} />
          <text x={cx - 30} y={h - 2} textAnchor="middle" fontSize="7" fill="#64748b">A1</text>
          <text x={cx + 30} y={h - 2} textAnchor="middle" fontSize="7" fill="#64748b">A2</text>
        </>,
        contactorDefs(g),
      );

    // ---- 主触点（黑壳 + 3 对动触桥，吸合时绿色接通）----
    case 'contactor_main': {
      const cols = [0.25, 0.5, 0.75].map((p) => p * w);
      return wrap(
        <>
          {cols.map((x, i) => (
            <g key={i}>
              <line x1={x} y1={0} x2={x} y2={18} stroke={WIRE} strokeWidth={2.4} />
              <line x1={x} y1={h} x2={x} y2={h - 18} stroke={WIRE} strokeWidth={2.4} />
              <circle cx={x} cy={18} r={4} fill={`url(#${g('screw')})`} />
              <circle cx={x} cy={h - 18} r={4} fill={`url(#${g('screw')})`} />
            </g>
          ))}
          <rect x={10} y={20} width={w - 20} height={h - 40} rx={5} fill={`url(#${g('case')})`} stroke="#11161c" strokeWidth={1} />
          {cols.map((x, i) => (
            <line key={i} x1={x} y1={24} x2={closed ? x : x + 9} y2={h - 24}
              stroke={closed ? '#37e07f' : '#7c8794'} strokeWidth={3} strokeLinecap="round" />
          ))}
          <line x1={cols[0]} y1={cy} x2={cols[2]} y2={cy} stroke="#566373" strokeWidth={1.2} strokeDasharray="3 3" />
          <text x={14} y={cy + 3} fontSize="8" fontWeight="700" fill="#e5e7eb">KM</text>
        </>,
        contactorDefs(g),
      );
    }

    // ---- 辅助常开 ----
    case 'contactor_no':
      return wrap(
        <>
          {leads(def, w, h, { in: [cx - 26, (h * 70) / 100], out: [cx + 26, (h * 70) / 100] })}
          <rect x={cx - 30} y={8} width={60} height={h - 22} rx={4} fill={`url(#${g('case')})`} stroke="#11161c" strokeWidth={1} />
          <circle cx={cx - 14} cy={cy - 2} r={3} fill="#cbd5e1" />
          <circle cx={cx + 14} cy={cy - 2} r={3} fill="#cbd5e1" />
          <line x1={cx - 14} y1={cy - 2} x2={closed ? cx + 14 : cx + 8} y2={closed ? cy - 2 : cy - 12}
            stroke={closed ? '#37e07f' : '#9aa7b3'} strokeWidth={3} strokeLinecap="round" />
          <text x={cx} y={h - 16} textAnchor="middle" fontSize="9" fontWeight="700" fill="#e5e7eb">KM</text>
          <circle cx={cx - 26} cy={(h * 70) / 100} r={4} fill={`url(#${g('screw')})`} />
          <circle cx={cx + 26} cy={(h * 70) / 100} r={4} fill={`url(#${g('screw')})`} />
        </>,
        contactorDefs(g),
      );

    // ---- 单相电源：插座面板 ----
    case 'single_phase_power':
      return wrap(
        <>
          {leads(def, w, h, { L: [w - 26, (h * 34) / 100], N: [w - 26, (h * 68) / 100] })}
          <rect x={8} y={8} width={w - 34} height={h - 16} rx={7} fill={`url(#${g('plate')})`} stroke="#c2ccd6" strokeWidth={1.2} />
          <circle cx={(w - 26) / 2 + 4} cy={cy} r={16} fill="#eef2f6" stroke="#b8c2cc" strokeWidth={1} />
          <rect x={(w - 26) / 2 - 2} y={cy - 8} width={3} height={9} rx={1} fill="#3f4651" />
          <rect x={(w - 26) / 2 + 8} y={cy - 8} width={3} height={9} rx={1} fill="#3f4651" />
          <rect x={(w - 26) / 2 + 2} y={cy + 4} width={3} height={6} rx={1} fill="#3f4651" />
          <text x={w - 22} y={(h * 34) / 100 - 4} textAnchor="end" fontSize="8" fontWeight="700" fill="#dc2626">L</text>
          <text x={w - 22} y={(h * 68) / 100 + 12} textAnchor="end" fontSize="8" fontWeight="700" fill="#2563eb">N</text>
          <text x={cx - 4} y={h - 4} textAnchor="middle" fontSize="7" fill="#64748b">~220V</text>
        </>,
        <defs>
          <linearGradient id={g('plate')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbfdfe" /><stop offset="100%" stopColor="#dde5ec" />
          </linearGradient>
        </defs>,
      );

    // ---- 三相电源：配电端子排 ----
    case 'three_phase_power': {
      const ys = [20, 38, 56, 82].map((p) => (h * p) / 100);
      const colors = ['#eab308', '#22c55e', '#dc2626', '#2563eb'];
      const labels = ['L1', 'L2', 'L3', 'N'];
      return wrap(
        <>
          {leads(def, w, h, { L1: [w - 24, ys[0]], L2: [w - 24, ys[1]], L3: [w - 24, ys[2]], N: [w - 24, ys[3]] })}
          <rect x={8} y={8} width={w - 32} height={h - 16} rx={6} fill={`url(#${g('box')})`} stroke="#475569" strokeWidth={1.2} />
          {ys.map((y, i) => (
            <g key={i}>
              <rect x={w - 40} y={y - 6} width={16} height={12} rx={2} fill={colors[i]} stroke="#1f2937" strokeWidth={0.6} />
              <circle cx={w - 32} cy={y} r={3} fill={`url(#${g('screw')})`} />
              <text x={w - 22} y={y - 7} textAnchor="end" fontSize="7" fontWeight="700" fill={colors[i]}>{labels[i]}</text>
            </g>
          ))}
          <text x={22} y={cy - 4} fontSize="10" fontWeight="700" fill="#e5e7eb">3N~</text>
          <text x={22} y={cy + 10} fontSize="9" fill="#cbd5e1">380V</text>
        </>,
        <defs>
          <linearGradient id={g('box')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b6675" /><stop offset="100%" stopColor="#374151" />
          </linearGradient>
          <radialGradient id={g('screw')} cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#f1f5f9" /><stop offset="100%" stopColor="#94a3b8" />
          </radialGradient>
        </defs>,
      );
    }

    default:
      return wrap(<rect x={4} y={4} width={w - 8} height={h - 8} rx={4} fill="#fff" stroke={WIRE} />);
  }
}

function contactorDefs(g: (s: string) => string) {
  return (
    <defs>
      <linearGradient id={g('case')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3b424c" />
        <stop offset="50%" stopColor="#262b33" />
        <stop offset="100%" stopColor="#171b21" />
      </linearGradient>
      <radialGradient id={g('screw')} cx="40%" cy="35%" r="75%">
        <stop offset="0%" stopColor="#f1f5f9" />
        <stop offset="100%" stopColor="#94a3b8" />
      </radialGradient>
    </defs>
  );
}
