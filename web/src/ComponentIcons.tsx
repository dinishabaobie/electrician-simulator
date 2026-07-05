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
  tag?: string; // 电工位号（接触器 groupId，如 KM1），缺省显示 KM
}

export function ComponentIcon({ nid, type, def, state, sim, tag }: Props) {
  const km = tag ?? 'KM';
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
          <text x={cx} y={h - 18} textAnchor="middle" fontSize="11" fontWeight="700" fill="#e5e7eb">{km}</text>
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
          <text x={14} y={cy + 3} fontSize="8" fontWeight="700" fill="#e5e7eb">{km}</text>
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
          <text x={cx} y={h - 16} textAnchor="middle" fontSize="9" fontWeight="700" fill="#e5e7eb">{km}</text>
          <circle cx={cx - 26} cy={(h * 70) / 100} r={4} fill={`url(#${g('screw')})`} />
          <circle cx={cx + 26} cy={(h * 70) / 100} r={4} fill={`url(#${g('screw')})`} />
        </>,
        contactorDefs(g),
      );

    // ---- 三相变压器：一次侧上，双抽头二次侧下（60V / 30V）----
    case 'transformer': {
      return wrap(
        <>
          {def.terminals.map((t) => {
            const p = parseFloat((t.style.top ?? t.style.left) as string) / 100;
            const x = w * p;
            const top = t.position === 'top';
            return (
              <g key={t.id}>
                <line x1={x} y1={top ? 0 : h} x2={x} y2={top ? 16 : h - 16} stroke={WIRE} strokeWidth={2.4} />
                <circle cx={x} cy={top ? 16 : h - 16} r={4} fill={`url(#${g('screw')})`} />
              </g>
            );
          })}
          <rect x={8} y={18} width={w - 16} height={h - 36} rx={5} fill={`url(#${g('tcase')})`} stroke="#475569" strokeWidth={1.2} />
          {/* 铭牌行（全部收进壳体内，避开端子引线） */}
          <text x={cx} y={31} textAnchor="middle" fontSize="8" fontWeight="700" fill="#e5e7eb">T1 · 380V 线△ − 60V/45V/30V 线Y</text>
          {/* 铁芯 + 一次/二次绕组（居中紧凑） */}
          <rect x={cx - 3} y={38} width={6} height={40} fill="#8a97a5" />
          <line x1={cx - 6} y1={38} x2={cx - 6} y2={78} stroke="#6b7785" strokeWidth={1.2} />
          <line x1={cx + 6} y1={38} x2={cx + 6} y2={78} stroke="#6b7785" strokeWidth={1.2} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <circle cx={cx - 15} cy={45 + i * 13} r={6} fill="none" stroke="#e8b339" strokeWidth={2.2} />
              <circle cx={cx + 15} cy={45 + i * 13} r={6} fill="none" stroke="#e8b339" strokeWidth={2.2} />
            </g>
          ))}
          {/* 抽头分组标注：壳体内底部，正对各自的三个出线端子 */}
          <text x={w * 0.15} y={h - 24} textAnchor="middle" fontSize="8" fontWeight="700" fill="#e8b339">60V</text>
          <text x={w * 0.5} y={h - 24} textAnchor="middle" fontSize="8" fontWeight="700" fill="#a3b2c4">45V·备用</text>
          <text x={w * 0.85} y={h - 24} textAnchor="middle" fontSize="8" fontWeight="700" fill="#93c5fd">30V</text>
        </>,
        <defs>
          <linearGradient id={g('tcase')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b6675" /><stop offset="100%" stopColor="#39414d" />
          </linearGradient>
          <radialGradient id={g('screw')} cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#f1f5f9" /><stop offset="100%" stopColor="#94a3b8" />
          </radialGradient>
        </defs>,
      );
    }

    // ---- 三相整流桥：AC 三进，DC+/DC− 两出 ----
    case 'rectifier': {
      const diode = (x: number, y: number, k: string) => (
        <g key={k} stroke="#cbd5e1" strokeWidth={1.4} fill="none">
          <path d={`M${x - 5},${y - 5} L${x + 5},${y - 5} L${x},${y + 3} Z`} fill="#cbd5e1" stroke="none" />
          <line x1={x - 5} y1={y + 3} x2={x + 5} y2={y + 3} />
          <line x1={x} y1={y - 9} x2={x} y2={y - 5} />
          <line x1={x} y1={y + 3} x2={x} y2={y + 8} />
        </g>
      );
      const acCols = [0.25, 0.5, 0.75].map((p) => p * w);
      const dcCols = [0.3, 0.7].map((p) => p * w);
      return wrap(
        <>
          {acCols.map((x, i) => (
            <g key={i}>
              <line x1={x} y1={0} x2={x} y2={16} stroke={WIRE} strokeWidth={2.4} />
              <circle cx={x} cy={16} r={4} fill={`url(#${g('screw')})`} />
            </g>
          ))}
          {dcCols.map((x, i) => (
            <g key={i}>
              <line x1={x} y1={h} x2={x} y2={h - 16} stroke={WIRE} strokeWidth={2.4} />
              <circle cx={x} cy={h - 16} r={4} fill={`url(#${g('screw')})`} />
            </g>
          ))}
          <rect x={8} y={18} width={w - 16} height={h - 36} rx={5} fill={`url(#${g('rcase')})`} stroke="#475569" strokeWidth={1.2} />
          <line x1={16} y1={34} x2={w - 16} y2={34} stroke="#94a3b8" strokeWidth={1.2} />
          <line x1={16} y1={h - 34} x2={w - 16} y2={h - 34} stroke="#94a3b8" strokeWidth={1.2} />
          {acCols.map((x, i) => diode(x, 47, `u${i}`))}
          {acCols.map((x, i) => diode(x, h - 47, `d${i}`))}
          <text x={dcCols[0]} y={h - 20} textAnchor="middle" fontSize="7" fontWeight="700" fill="#fca5a5">DC+</text>
          <text x={dcCols[1]} y={h - 20} textAnchor="middle" fontSize="7" fontWeight="700" fill="#93c5fd">DC−</text>
          <text x={w - 14} y={cy + 2} textAnchor="end" fontSize="7" fill="#94a3b8">V1~V6</text>
        </>,
        <defs>
          <linearGradient id={g('rcase')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4b5563" /><stop offset="100%" stopColor="#2f3742" />
          </linearGradient>
          <radialGradient id={g('screw')} cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#f1f5f9" /><stop offset="100%" stopColor="#94a3b8" />
          </radialGradient>
        </defs>,
      );
    }

    // ---- 直流电机：机身同电机，铭牌 DC，转速百分比 ----
    case 'dc_motor': {
      const runD = !!sim?.working;
      const accent = runD ? '#1f9d55' : '#5b6675';
      return wrap(
        <>
          {leads(def, w, h, { 'DC+': [(w * 35) / 100, 22], 'DC-': [(w * 65) / 100, 22] })}
          <rect x={cx - 22} y={14} width={44} height={14} rx={2} fill="#2f3742" />
          <rect x={14} y={30} width={w - 38} height={42} rx={9} fill={`url(#${g('steel')})`} stroke="#5b6675" strokeWidth={1.2} />
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={i} x1={24 + i * 10} y1={32} x2={24 + i * 10} y2={70} stroke="#7c8794" strokeWidth={1} opacity={0.6} />
          ))}
          <ellipse cx={16} cy={51} rx={7} ry={21} fill="#aeb9c4" stroke="#5b6675" strokeWidth={1} />
          <rect x={w - 24} y={47} width={16} height={8} rx={1.5} fill="#9aa3ad" stroke="#6b7785" strokeWidth={0.8} />
          <rect x={26} y={70} width={14} height={7} rx={1} fill="#3f4651" />
          <rect x={w - 54} y={70} width={14} height={7} rx={1} fill="#3f4651" />
          <circle cx={cx} cy={51} r={13} fill="#283039" stroke={accent} strokeWidth={2} />
          <text x={cx} y={50} textAnchor="middle" fontSize="13" fontWeight="700" fill={runD ? '#5ee49b' : '#cbd5e1'}>M</text>
          <text x={cx} y={61} textAnchor="middle" fontSize="7" fill={runD ? '#5ee49b' : '#9aa3ad'}>DC</text>
          {/* 励磁绕组（装饰）：机身左侧的励磁线圈 */}
          <g stroke={runD ? '#e8b339' : '#8a97a5'} strokeWidth={1.8} fill="none">
            {[0, 1, 2].map((i) => (
              <circle key={i} cx={26} cy={40 + i * 11} r={4.5} />
            ))}
          </g>
          <text x={26} y={78} textAnchor="middle" fontSize="6" fill="#64748b">励磁</text>
          {runD && (
            <text x={cx + 15} y={40} fontSize="10" fill="#1f9d55">
              ↻{sim?.speedPct ?? 0}%
            </text>
          )}
        </>,
        <defs>
          <linearGradient id={g('steel')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={runD ? '#dcfce7' : '#eef2f5'} />
            <stop offset="45%" stopColor={runD ? '#b7e8c9' : '#c2ccd6'} />
            <stop offset="100%" stopColor={runD ? '#86c79f' : '#8a97a5'} />
          </linearGradient>
        </defs>,
      );
    }

    // ---- 接线端子排 JX1：橙色端子座 + 五行螺钉 ----
    case 'terminal_block': {
      const rows = [
        { p: 0.12, t: 'L1', c: '#eab308' },
        { p: 0.31, t: 'L2', c: '#22c55e' },
        { p: 0.5, t: 'L3', c: '#dc2626' },
        { p: 0.69, t: 'N', c: '#2563eb' },
        { p: 0.88, t: 'PE', c: '#16a34a' },
      ];
      return wrap(
        <>
          <rect x={10} y={4} width={w - 20} height={h - 8} rx={4} fill={`url(#${g('tb')})`} stroke="#b45309" strokeWidth={1.2} />
          {rows.map((r) => (
            <g key={r.t}>
              <line x1={0} y1={h * r.p} x2={14} y2={h * r.p} stroke={WIRE} strokeWidth={2.2} />
              <line x1={w - 14} y1={h * r.p} x2={w} y2={h * r.p} stroke={WIRE} strokeWidth={2.2} />
              <circle cx={0} cy={h * r.p} r={3} fill="#cbd5e1" stroke="#64748b" strokeWidth={1} />
              <circle cx={w} cy={h * r.p} r={3} fill="#cbd5e1" stroke="#64748b" strokeWidth={1} />
              <rect x={16} y={h * r.p - 8} width={w - 32} height={16} rx={2} fill="#fde7c0" stroke="#d97706" strokeWidth={0.8} />
              <circle cx={24} cy={h * r.p} r={4} fill={`url(#${g('screw')})`} />
              <circle cx={w - 24} cy={h * r.p} r={4} fill={`url(#${g('screw')})`} />
              <text x={cx} y={h * r.p + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill={r.c}>{r.t}</text>
            </g>
          ))}
        </>,
        <defs>
          <linearGradient id={g('tb')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fbbf6d" /><stop offset="100%" stopColor="#e79235" />
          </linearGradient>
          <radialGradient id={g('screw')} cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#f1f5f9" /><stop offset="100%" stopColor="#94a3b8" />
          </radialGradient>
        </defs>,
      );
    }

    // ---- 保护接地 PE：标准接地符号 ----
    case 'earth':
      return wrap(
        <>
          <line x1={cx} y1={0} x2={cx} y2={26} stroke="#16a34a" strokeWidth={2.6} />
          <circle cx={cx} cy={0} r={3} fill="#cbd5e1" stroke="#64748b" strokeWidth={1} />
          <line x1={cx - 16} y1={26} x2={cx + 16} y2={26} stroke="#16a34a" strokeWidth={3} strokeLinecap="round" />
          <line x1={cx - 10} y1={34} x2={cx + 10} y2={34} stroke="#16a34a" strokeWidth={3} strokeLinecap="round" />
          <line x1={cx - 4} y1={42} x2={cx + 4} y2={42} stroke="#16a34a" strokeWidth={3} strokeLinecap="round" />
          <text x={cx} y={h - 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#16a34a">PE</text>
        </>,
      );

    // ---- 分流器 RS1：锰铜排 + 两端螺栓 ----
    case 'shunt':
      return wrap(
        <>
          {leads(def, w, h, { in: [14, (h * 55) / 100], out: [w - 14, (h * 55) / 100] })}
          <rect x={12} y={cy - 8} width={w - 24} height={16} rx={2} fill={`url(#${g('cu')})`} stroke="#9a7b2e" strokeWidth={1} />
          <rect x={26} y={cy - 5} width={w - 52} height={10} fill="#f4e3b2" stroke="#c9a13e" strokeWidth={0.8} />
          <circle cx={19} cy={cy} r={4.5} fill={`url(#${g('screw')})`} />
          <circle cx={w - 19} cy={cy} r={4.5} fill={`url(#${g('screw')})`} />
          <text x={cx} y={cy - 12} textAnchor="middle" fontSize="8" fontWeight="700" fill="#7b5a12">RS1 分流器</text>
          <text x={cx} y={h - 2} textAnchor="middle" fontSize="7" fill="#64748b">75mV / 额定电流</text>
        </>,
        <defs>
          <linearGradient id={g('cu')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e7c873" /><stop offset="100%" stopColor="#b18a2f" />
          </linearGradient>
          <radialGradient id={g('screw')} cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#f1f5f9" /><stop offset="100%" stopColor="#94a3b8" />
          </radialGradient>
        </defs>,
      );

    // ---- 时间继电器 ZN96：数码窗显示倒计时 ----
    case 'timer_coil': {
      const en = !!sim?.energized;
      const remain = state?.remain as number | undefined;
      const display = en ? (remain !== undefined && remain > 0 ? `${remain}s` : 'OK') : '--';
      return wrap(
        <>
          {leads(def, w, h, { 7: [cx - 34, (h * 72) / 100], 8: [cx + 34, (h * 72) / 100] })}
          <rect x={cx - 36} y={6} width={72} height={h - 20} rx={5} fill={`url(#${g('case')})`} stroke="#11161c" strokeWidth={1} />
          {/* 数码显示窗 */}
          <rect x={cx - 24} y={14} width={48} height={22} rx={3} fill="#0b1220" stroke="#1e293b" strokeWidth={1} />
          <text x={cx} y={30} textAnchor="middle" fontSize="13" fontWeight="700"
            fill={en ? (remain !== undefined && remain > 0 ? '#fbbf24' : '#37e07f') : '#334155'}
            style={{ fontFamily: 'ui-monospace, monospace' }}>
            {display}
          </text>
          <circle cx={cx - 22} cy={46} r={4} fill={en ? '#37e07f' : '#1c2530'} stroke={en ? '#0d6b36' : '#000'} strokeWidth={1} />
          <text x={cx - 14} y={49} fontSize="7" fill="#94a3b8">PWR</text>
          <text x={cx + 24} y={49} textAnchor="end" fontSize="8" fontWeight="700" fill="#e5e7eb">ZN96</text>
          <text x={cx - 30} y={h - 6} fontSize="7" fill="#64748b">7</text>
          <text x={cx + 30} y={h - 6} textAnchor="end" fontSize="7" fill="#64748b">8</text>
          <circle cx={cx - 34} cy={(h * 72) / 100} r={4} fill={`url(#${g('screw')})`} />
          <circle cx={cx + 34} cy={(h * 72) / 100} r={4} fill={`url(#${g('screw')})`} />
        </>,
        contactorDefs(g),
      );
    }

    // ---- 通电延时闭合触点：常开触点 + 延时弧symbol ----
    case 'timer_no': {
      const closedT = !!sim?.closed;
      return wrap(
        <>
          {leads(def, w, h, { in: [cx - 26, (h * 70) / 100], out: [cx + 26, (h * 70) / 100] })}
          <rect x={cx - 30} y={8} width={60} height={h - 22} rx={4} fill={`url(#${g('case')})`} stroke="#11161c" strokeWidth={1} />
          <circle cx={cx - 14} cy={cy - 2} r={3} fill="#cbd5e1" />
          <circle cx={cx + 14} cy={cy - 2} r={3} fill="#cbd5e1" />
          <line x1={cx - 14} y1={cy - 2} x2={closedT ? cx + 14 : cx + 8} y2={closedT ? cy - 2 : cy - 12}
            stroke={closedT ? '#37e07f' : '#9aa7b3'} strokeWidth={3} strokeLinecap="round" />
          {/* 延时符号：触点上方的小弧 */}
          <path d={`M${cx - 6},${cy - 14} a8,8 0 0 1 12,0`} fill="none" stroke="#fbbf24" strokeWidth={1.6} />
          <text x={cx} y={h - 16} textAnchor="middle" fontSize="9" fontWeight="700" fill="#e5e7eb">{km}</text>
          <circle cx={cx - 26} cy={(h * 70) / 100} r={4} fill={`url(#${g('screw')})`} />
          <circle cx={cx + 26} cy={(h * 70) / 100} r={4} fill={`url(#${g('screw')})`} />
        </>,
        contactorDefs(g),
      );
    }

    // ---- 电流表 / 电压表：圆表盘，指针随读数摆动 ----
    case 'ammeter':
    case 'voltmeter': {
      const isA = type === 'ammeter';
      const val = isA ? (sim?.amps ?? 0) : (sim?.volts ?? 0);
      const full = isA ? 10 : 100; // 满量程 10A / 100V
      const ang = Math.max(-50, Math.min(50, -50 + (val / full) * 100));
      const rad = (ang * Math.PI) / 180;
      return wrap(
        <>
          {def.terminals.map((t) => {
            const p = parseFloat((t.style.top ?? t.style.left) as string) / 100;
            const x = t.position === 'left' ? 0 : t.position === 'right' ? w : w * p;
            const y = t.position === 'top' ? 0 : t.position === 'bottom' ? h : h * p;
            return (
              <g key={t.id}>
                <line x1={x} y1={y} x2={cx} y2={cy - 2} stroke={WIRE} strokeWidth={2.2} strokeLinecap="round" />
                <circle cx={x} cy={y} r={3} fill="#cbd5e1" stroke="#64748b" strokeWidth={1} />
              </g>
            );
          })}
          <circle cx={cx} cy={cy - 2} r={26} fill={`url(#${g('dial')})`} stroke="#94a3b8" strokeWidth={2} />
          {[-50, -25, 0, 25, 50].map((a) => (
            <line key={a}
              x1={cx + 20 * Math.sin((a * Math.PI) / 180)} y1={cy - 2 - 20 * Math.cos((a * Math.PI) / 180)}
              x2={cx + 23 * Math.sin((a * Math.PI) / 180)} y2={cy - 2 - 23 * Math.cos((a * Math.PI) / 180)}
              stroke="#64748b" strokeWidth={1.2} />
          ))}
          {/* 刻度数字：0 / 半量程 / 满量程 */}
          <text x={cx - 17} y={cy + 3} textAnchor="middle" fontSize="5.5" fill="#64748b">0</text>
          <text x={cx} y={cy - 17} textAnchor="middle" fontSize="5.5" fill="#64748b">{full / 2}</text>
          <text x={cx + 17} y={cy + 3} textAnchor="middle" fontSize="5.5" fill="#64748b">{full}</text>
          {/* 指针：读数 → 偏角 */}
          <line x1={cx} y1={cy - 2}
            x2={cx + 21 * Math.sin(rad)} y2={cy - 2 - 21 * Math.cos(rad)}
            stroke="#dc2626" strokeWidth={1.6} />
          <circle cx={cx} cy={cy - 2} r={2.5} fill="#334155" />
          {/* 单位与读数都放进表盘内，避开上下端子引线 */}
          <text x={cx} y={cy + 8} textAnchor="middle" fontSize="8" fill="#64748b">
            {isA ? 'A' : 'V'}
          </text>
          <text x={cx} y={cy + 19} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0f766e">
            {val}
          </text>
        </>,
        <defs>
          <radialGradient id={g('dial')} cx="40%" cy="35%" r="80%">
            <stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#dbe3ea" />
          </radialGradient>
        </defs>,
      );
    }

    // ---- 断路器（DZ47 风格：白壳 + 拨杆，合闸绿窗 / 分闸红窗）----
    case 'breaker':
    case 'breaker3': {
      const onB = !!state?.closed;
      const pcts = type === 'breaker3' ? [0.25, 0.5, 0.75] : [0.33, 0.66];
      const cols = pcts.map((p) => p * w);
      const leverY = onB ? 30 : 52;
      return wrap(
        <>
          {cols.map((x, i) => (
            <g key={i}>
              <line x1={x} y1={0} x2={x} y2={16} stroke={WIRE} strokeWidth={2.4} />
              <line x1={x} y1={h} x2={x} y2={h - 16} stroke={WIRE} strokeWidth={2.4} />
              <circle cx={x} cy={16} r={4} fill={`url(#${g('screw')})`} />
              <circle cx={x} cy={h - 16} r={4} fill={`url(#${g('screw')})`} />
            </g>
          ))}
          <rect x={8} y={18} width={w - 16} height={h - 36} rx={4} fill={`url(#${g('shell')})`} stroke="#aab4be" strokeWidth={1.2} />
          {/* 分极槽线 */}
          {cols.slice(1).map((x, i) => (
            <line key={i} x1={(x + cols[i]) / 2} y1={20} x2={(x + cols[i]) / 2} y2={h - 20}
              stroke="#c6cfd8" strokeWidth={1} />
          ))}
          {/* 每极一个拨杆 + 状态窗 */}
          {cols.map((x, i) => (
            <g key={i}>
              <rect x={x - 7} y={26} width={14} height={h - 52} rx={2} fill="#e5eaef" stroke="#b6c0ca" strokeWidth={0.8} />
              <rect x={x - 5.5} y={leverY - 8} width={11} height={16} rx={2}
                fill={onB ? '#1f9d55' : '#d64545'} stroke="#11161c" strokeWidth={0.6} />
              <rect x={x - 3} y={h - 30} width={6} height={5} rx={1} fill={onB ? '#37e07f' : '#ef4444'} />
            </g>
          ))}
          <text x={w / 2} y={h - 22} textAnchor="middle" fontSize="7" fill="#7b8794">
            {onB ? 'ON 合' : 'OFF 分'}
          </text>
        </>,
        <defs>
          <linearGradient id={g('shell')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbfdfe" /><stop offset="100%" stopColor="#dde5ec" />
          </linearGradient>
          <radialGradient id={g('screw')} cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#f1f5f9" /><stop offset="100%" stopColor="#94a3b8" />
          </radialGradient>
        </defs>,
      );
    }

    // ---- 辅助常闭（线圈失电时闭合，得电断开；闭合导通显绿）----
    case 'contactor_nc':
      return wrap(
        <>
          {leads(def, w, h, { in: [cx - 26, (h * 70) / 100], out: [cx + 26, (h * 70) / 100] })}
          <rect x={cx - 30} y={8} width={60} height={h - 22} rx={4} fill={`url(#${g('case')})`} stroke="#11161c" strokeWidth={1} />
          <circle cx={cx - 14} cy={cy - 2} r={3} fill="#cbd5e1" />
          <circle cx={cx + 14} cy={cy - 2} r={3} fill="#cbd5e1" />
          <line x1={cx - 14} y1={cy - 2} x2={closed ? cx + 14 : cx + 8} y2={closed ? cy - 2 : cy - 12}
            stroke={closed ? '#37e07f' : '#9aa7b3'} strokeWidth={3} strokeLinecap="round" />
          {/* NC 标记：触点上方一道小竖杠（电工符号里常闭的斜杠意象） */}
          <line x1={cx + 17} y1={cy - 10} x2={cx + 11} y2={cy + 2} stroke="#e5e7eb" strokeWidth={1.4} />
          <text x={cx} y={h - 16} textAnchor="middle" fontSize="9" fontWeight="700" fill="#e5e7eb">{km}</text>
          <circle cx={cx - 26} cy={(h * 70) / 100} r={4} fill={`url(#${g('screw')})`} />
          <circle cx={cx + 26} cy={(h * 70) / 100} r={4} fill={`url(#${g('screw')})`} />
        </>,
        contactorDefs(g),
      );

    // ---- 指示灯（面板圆形信号灯）----
    case 'indicator': {
      const litI = !!sim?.working;
      const tx = (p: number) => (w * p) / 100;
      return wrap(
        <>
          {litI && <circle cx={cx} cy={30} r={26} fill={`url(#${g('iglow')})`} />}
          <circle cx={cx} cy={30} r={16} fill="#cdd6df" />
          <circle cx={cx} cy={30} r={12} fill={litI ? `url(#${g('ilens')})` : '#5b6675'} stroke={litI ? '#e6a700' : '#94a3b8'} strokeWidth={1.2} />
          <ellipse cx={cx - 4} cy={26} rx={3.5} ry={2.2} fill="#fff" opacity={0.5} />
          <rect x={cx - 8} y={45} width={16} height={12} rx={2} fill="#3f4651" />
          <path d={`M${cx - 4},57 L${tx(35)},${h}`} fill="none" stroke={WIRE} strokeWidth={2.4} strokeLinecap="round" />
          <path d={`M${cx + 4},57 L${tx(65)},${h}`} fill="none" stroke={WIRE} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={tx(35)} cy={h} r={3} fill="#cbd5e1" stroke="#64748b" strokeWidth={1} />
          <circle cx={tx(65)} cy={h} r={3} fill="#cbd5e1" stroke="#64748b" strokeWidth={1} />
        </>,
        <defs>
          <radialGradient id={g('ilens')} cx="40%" cy="35%" r="80%">
            <stop offset="0%" stopColor="#fff7cc" /><stop offset="60%" stopColor="#ffd23f" />
            <stop offset="100%" stopColor="#e6a700" />
          </radialGradient>
          <radialGradient id={g('iglow')} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe98a" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#ffe98a" stopOpacity={0} />
          </radialGradient>
        </defs>,
      );
    }

    // ---- 轴流风机（圆形风罩 + 叶片，运行显绿并出风符号）----
    case 'fan': {
      const runF = !!sim?.working;
      const tx = (p: number) => (w * p) / 100;
      const bcy = 34;
      return wrap(
        <>
          <rect x={cx - 30} y={6} width={60} height={56} rx={6} fill="#2f3742" stroke="#11161c" strokeWidth={1} />
          <circle cx={cx} cy={bcy} r={23} fill="#1c2530" stroke={runF ? '#1f9d55' : '#5b6675'} strokeWidth={2} />
          {/* 叶片 */}
          {[0, 120, 240].map((a) => (
            <path key={a} d={`M${cx},${bcy} q10,-14 2,-19`} fill="none"
              stroke={runF ? '#5ee49b' : '#8a97a5'} strokeWidth={3.4} strokeLinecap="round"
              transform={`rotate(${a + (runF ? 25 : 0)} ${cx} ${bcy})`} />
          ))}
          <circle cx={cx} cy={bcy} r={4} fill={runF ? '#37e07f' : '#7c8794'} />
          {runF && <text x={cx + 25} y={16} fontSize="11" fill="#1f9d55">↻</text>}
          <path d={`M${cx - 6},62 L${tx(35)},${h}`} fill="none" stroke={WIRE} strokeWidth={2.4} strokeLinecap="round" />
          <path d={`M${cx + 6},62 L${tx(65)},${h}`} fill="none" stroke={WIRE} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={tx(35)} cy={h} r={3} fill="#cbd5e1" stroke="#64748b" strokeWidth={1} />
          <circle cx={tx(65)} cy={h} r={3} fill="#cbd5e1" stroke="#64748b" strokeWidth={1} />
        </>,
      );
    }

    // ---- 热继电器·三相热元件（灰蓝壳 + 双金属片，动作后红色断开）----
    case 'thermal_main': {
      const tripped = !!state?.tripped;
      const fr = tag ?? 'FR';
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
          <rect x={10} y={20} width={w - 20} height={h - 40} rx={5} fill={`url(#${g('frcase')})`} stroke="#334155" strokeWidth={1} />
          {cols.map((x, i) => (
            <g key={i}>
              {/* 双金属片：正常时直通，过载动作后弹开变红 */}
              <line x1={x} y1={24} x2={tripped ? x + 9 : x} y2={h - 24}
                stroke={tripped ? '#ef4444' : '#37e07f'} strokeWidth={3} strokeLinecap="round" />
              <rect x={x - 4.5} y={cy - 6} width={9} height={12} rx={1.5}
                fill="none" stroke={tripped ? '#ef4444' : '#94a3b8'} strokeWidth={1.4} />
            </g>
          ))}
          <line x1={cols[0]} y1={cy} x2={cols[2]} y2={cy} stroke="#64748b" strokeWidth={1.2} strokeDasharray="3 3" />
          <text x={14} y={cy + 3} fontSize="8" fontWeight="700" fill="#e5e7eb">{fr}</text>
          {tripped && <text x={w - 14} y={cy + 3} textAnchor="end" fontSize="8" fontWeight="700" fill="#fca5a5">过载</text>}
        </>,
        thermalDefs(g),
      );
    }

    // ---- 热继电器·控制常闭（正常闭合，动作后断开）----
    case 'thermal_nc': {
      const tripped = !!state?.tripped;
      const fr = tag ?? 'FR';
      return wrap(
        <>
          {leads(def, w, h, { in: [cx - 26, (h * 70) / 100], out: [cx + 26, (h * 70) / 100] })}
          <rect x={cx - 30} y={8} width={60} height={h - 22} rx={4} fill={`url(#${g('frcase')})`} stroke="#334155" strokeWidth={1} />
          <circle cx={cx - 14} cy={cy - 2} r={3} fill="#cbd5e1" />
          <circle cx={cx + 14} cy={cy - 2} r={3} fill="#cbd5e1" />
          <line x1={cx - 14} y1={cy - 2} x2={tripped ? cx + 8 : cx + 14} y2={tripped ? cy - 12 : cy - 2}
            stroke={tripped ? '#ef4444' : '#37e07f'} strokeWidth={3} strokeLinecap="round" />
          <text x={cx} y={h - 16} textAnchor="middle" fontSize="9" fontWeight="700" fill="#e5e7eb">{fr}</text>
          <circle cx={cx - 26} cy={(h * 70) / 100} r={4} fill={`url(#${g('screw')})`} />
          <circle cx={cx + 26} cy={(h * 70) / 100} r={4} fill={`url(#${g('screw')})`} />
        </>,
        thermalDefs(g),
      );
    }

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

function thermalDefs(g: (s: string) => string) {
  return (
    <defs>
      <linearGradient id={g('frcase')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#526075" />
        <stop offset="50%" stopColor="#3b4759" />
        <stop offset="100%" stopColor="#2b3443" />
      </linearGradient>
      <radialGradient id={g('screw')} cx="40%" cy="35%" r="75%">
        <stop offset="0%" stopColor="#f1f5f9" />
        <stop offset="100%" stopColor="#94a3b8" />
      </radialGradient>
    </defs>
  );
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
