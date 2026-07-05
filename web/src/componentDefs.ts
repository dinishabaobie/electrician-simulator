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
  if (type === 'switch') return { closed: false };
  if (type === 'button_no' || type === 'button_nc') return { pressed: false };
  if (type === 'thermal_main' || type === 'thermal_nc') return { tripped: false };
  return {};
}
