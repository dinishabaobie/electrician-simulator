import { Position } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { ComponentType } from '../../engine/src/types.ts';

export interface TermDef {
  id: string;
  position: Position;
  style: CSSProperties;
}

export interface CompDef {
  type: ComponentType;
  label: string;
  w: number;
  h: number;
  isLoad?: boolean;
  toggle?: boolean;      // 点击切换（开关）
  momentary?: boolean;   // 按住生效（按钮）
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
  return {};
}
