import { Position } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { ComponentType } from '../../engine/src/types.ts';

export interface TermDef {
  id: string;
  position: Position;
  style: CSSProperties;
}

export interface CompDef {
  type: ComponentType;   // 引擎元件类型（DEFS 的键是外观键，可与它不同，如 fan → motor）
  label: string;
  w: number;
  h: number;
  isLoad?: boolean;
  toggle?: boolean;      // 点击切换（开关）
  momentary?: boolean;   // 按住生效（按钮）
  rules?: Record<string, unknown>; // 传给引擎的 rules（如简化电机 motorMode）
  terminals: TermDef[];
}

const R = (top: string) => ({ position: Position.Right, style: { top } });
const L = (top: string) => ({ position: Position.Left, style: { top } });
const T = (left: string) => ({ position: Position.Top, style: { left } });
const B = (left: string) => ({ position: Position.Bottom, style: { left } });

export const DEFS: Record<string, CompDef> = {
  single_phase_power: {
    type: 'single_phase_power', label: '单相电源', w: 94, h: 66,
    terminals: [{ id: 'L', ...R('34%') }, { id: 'N', ...R('68%') }],
  },
  three_phase_power: {
    type: 'three_phase_power', label: '三相电源', w: 94, h: 116,
    terminals: [
      { id: 'L1', ...R('20%') }, { id: 'L2', ...R('38%') },
      { id: 'L3', ...R('56%') }, { id: 'N', ...R('82%') },
    ],
  },
  breaker: {
    type: 'breaker', label: '断路器 2P', w: 100, h: 96, toggle: true,
    terminals: [
      { id: 'in_L', ...T('33%') }, { id: 'in_N', ...T('66%') },
      { id: 'out_L', ...B('33%') }, { id: 'out_N', ...B('66%') },
    ],
  },
  breaker3: {
    type: 'breaker3', label: '断路器 3P', w: 134, h: 96, toggle: true,
    terminals: [
      { id: 'in_L1', ...T('25%') }, { id: 'in_L2', ...T('50%') }, { id: 'in_L3', ...T('75%') },
      { id: 'out_L1', ...B('25%') }, { id: 'out_L2', ...B('50%') }, { id: 'out_L3', ...B('75%') },
    ],
  },
  switch: {
    type: 'switch', label: '开关', w: 78, h: 74, toggle: true,
    terminals: [{ id: 'in', ...L('52%') }, { id: 'out', ...R('52%') }],
  },
  button_no: {
    type: 'button_no', label: '按钮·常开', w: 72, h: 78, momentary: true,
    terminals: [{ id: 'in', ...L('64%') }, { id: 'out', ...R('64%') }],
  },
  button_nc: {
    type: 'button_nc', label: '按钮·常闭', w: 72, h: 78, momentary: true,
    terminals: [{ id: 'in', ...L('64%') }, { id: 'out', ...R('64%') }],
  },
  contactor_coil: {
    type: 'contactor_coil', label: '接触器线圈', w: 94, h: 64,
    terminals: [{ id: 'A1', ...L('70%') }, { id: 'A2', ...R('70%') }],
  },
  contactor_main: {
    type: 'contactor_main', label: '主触点', w: 134, h: 84,
    terminals: [
      { id: 'L1', ...T('25%') }, { id: 'L2', ...T('50%') }, { id: 'L3', ...T('75%') },
      { id: 'T1', ...B('25%') }, { id: 'T2', ...B('50%') }, { id: 'T3', ...B('75%') },
    ],
  },
  contactor_no: {
    type: 'contactor_no', label: '辅助常开', w: 88, h: 60,
    terminals: [{ id: 'in', ...L('70%') }, { id: 'out', ...R('70%') }],
  },
  contactor_nc: {
    type: 'contactor_nc', label: '辅助常闭', w: 88, h: 60,
    terminals: [{ id: 'in', ...L('70%') }, { id: 'out', ...R('70%') }],
  },
  indicator: {
    type: 'indicator', label: '指示灯', w: 64, h: 78, isLoad: true,
    terminals: [{ id: 'L', ...B('35%') }, { id: 'N', ...B('65%') }],
  },
  // 轴流风机：引擎里是「简化电机」（单相负载，U/V 两端），外观独立
  fan: {
    type: 'motor', label: '轴流风机', w: 90, h: 84, isLoad: true,
    rules: { isLoad: true, motorMode: 'simplified' },
    terminals: [{ id: 'U', ...B('35%') }, { id: 'V', ...B('65%') }],
  },
  // 三相变压器（v2 真元件）：380V△ 一次；二次三组抽头 60V / 45V / 30V（线Y）
  transformer: {
    type: 'transformer3', label: '变压器 60/45/30V', w: 220, h: 118,
    rules: { tapVolts: [60, 45, 30] },
    terminals: [
      { id: 'L1', ...T('30%') }, { id: 'L2', ...T('50%') }, { id: 'L3', ...T('70%') },
      { id: 'R1', ...B('5%') }, { id: 'S1', ...B('15%') }, { id: 'T1', ...B('25%') },
      { id: 'R2', ...B('40%') }, { id: 'S2', ...B('50%') }, { id: 'T2', ...B('60%') },
      { id: 'R3', ...B('75%') }, { id: 'S3', ...B('85%') }, { id: 'T3', ...B('95%') },
    ],
  },
  // 三相整流桥（v2 真元件）：AC 进，DC+ / DC- 出（DC ≈ 1.35 × 线电压）
  rectifier: {
    type: 'rectifier3', label: '整流桥', w: 134, h: 110,
    terminals: [
      { id: 'L1', ...T('25%') }, { id: 'L2', ...T('50%') }, { id: 'L3', ...T('75%') },
      { id: 'DC+', ...B('30%') }, { id: 'DC-', ...B('70%') },
    ],
  },
  // 直流电机（v2 真元件）：转速 ∝ 电压（额定 81V = 60V 抽头整流后）
  dc_motor: {
    type: 'dc_motor', label: '直流电机', w: 126, h: 86, isLoad: true,
    rules: { isLoad: true, ratedV: 81 },
    terminals: [{ id: 'DC+', ...T('35%') }, { id: 'DC-', ...T('65%') }],
  },
  // 接线端子排 JX1：五对直通（左进右出），空置端子不算悬空
  terminal_block: {
    type: 'terminal_block', label: '接线端子排', w: 96, h: 158,
    terminals: [
      { id: 'in_L1', ...L('12%') }, { id: 'out_L1', ...R('12%') },
      { id: 'in_L2', ...L('31%') }, { id: 'out_L2', ...R('31%') },
      { id: 'in_L3', ...L('50%') }, { id: 'out_L3', ...R('50%') },
      { id: 'in_N', ...L('69%') }, { id: 'out_N', ...R('69%') },
      { id: 'in_PE', ...L('88%') }, { id: 'out_PE', ...R('88%') },
    ],
  },
  // 保护接地 PE（装饰）：单端子接地符号
  earth: {
    type: 'earth', label: '保护接地', w: 64, h: 60,
    terminals: [{ id: 'T', ...T('50%') }],
  },
  // 分流器 RS1：近似 0Ω 串联（引擎按电流表处理，可读支路电流）
  shunt: {
    type: 'ammeter', label: '分流器', w: 96, h: 56,
    terminals: [{ id: 'in', ...L('55%') }, { id: 'out', ...R('55%') }],
  },
  // 时间继电器本体（ZN96）：7/8 供电，得电自动计时，延时到联动闭合同组延时触点
  timer_coil: {
    type: 'timer_coil', label: '时间继电器', w: 100, h: 92,
    terminals: [{ id: '7', ...L('72%') }, { id: '8', ...R('72%') }],
  },
  // 通电延时闭合触点：ZN96 计时到点自动闭合；本体断电立即断开复位
  timer_no: {
    type: 'timer_no', label: '延时触点', w: 88, h: 60,
    terminals: [{ id: 'in', ...L('70%') }, { id: 'out', ...R('70%') }],
  },
  // 电流表（v2 真元件）：近似 0Ω 串联，显示支路电流
  ammeter: {
    type: 'ammeter', label: '电流表', w: 74, h: 88,
    terminals: [{ id: 'in', ...T('50%') }, { id: 'out', ...B('50%') }],
  },
  // 电压表（v2 真元件）：开路跨接，显示两端电压
  voltmeter: {
    type: 'voltmeter', label: '电压表', w: 74, h: 88,
    terminals: [{ id: 'in', ...L('35%') }, { id: 'out', ...L('65%') }],
  },
  thermal_main: {
    type: 'thermal_main', label: '热继·热元件', w: 134, h: 84, toggle: true,
    terminals: [
      { id: 'L1', ...T('25%') }, { id: 'L2', ...T('50%') }, { id: 'L3', ...T('75%') },
      { id: 'T1', ...B('25%') }, { id: 'T2', ...B('50%') }, { id: 'T3', ...B('75%') },
    ],
  },
  thermal_nc: {
    type: 'thermal_nc', label: '热继·常闭', w: 88, h: 60, toggle: true,
    terminals: [{ id: 'in', ...L('70%') }, { id: 'out', ...R('70%') }],
  },
  lamp: {
    type: 'lamp', label: '灯泡', w: 74, h: 88, isLoad: true,
    terminals: [{ id: 'L', ...B('34%') }, { id: 'N', ...B('66%') }],
  },
  motor: {
    type: 'motor', label: '电机', w: 126, h: 86, isLoad: true,
    terminals: [{ id: 'U', ...T('28%') }, { id: 'V', ...T('50%') }, { id: 'W', ...T('72%') }],
  },
};

export function defaultState(type: string): Record<string, unknown> {
  if (type === 'single_phase_power' || type === 'three_phase_power') return { on: true };
  if (type === 'switch' || type === 'breaker' || type === 'breaker3') return { closed: false };
  if (type === 'button_no' || type === 'button_nc') return { pressed: false };
  if (type === 'thermal_main' || type === 'thermal_nc') return { tripped: false };
  return {};
}
