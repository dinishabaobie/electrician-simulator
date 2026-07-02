import type { Expected } from '../../engine/src/types.ts';

export interface PresetItem {
  id: string;
  type: string;
  x: number;
  y: number;
  groupId?: string;
  role?: string;
}

// 预设接线：[元件id, 端子id] → [元件id, 端子id]
export interface PresetWire {
  from: [string, string];
  to: [string, string];
}

export interface Practice {
  key: string;
  name: string;
  goal: string;
  items: PresetItem[];
  wires?: PresetWire[]; // 标准答案接线，加载时自动连好（不填则空白让用户自接）
  template?: Expected; // 练习模式语义判错模板
}

export const PRACTICES: Practice[] = [
  {
    key: 'single_light',
    name: '单灯单控',
    goal: '接成 L → 开关 → 灯泡 → N，点开关让灯亮灭。',
    items: [
      // 坐标经过对齐：PWR.L 与 SW.in 同行、SW.out 与 LP.L 同列，答案接线横平竖直
      { id: 'PWR', type: 'single_phase_power', x: 40, y: 160 },
      { id: 'SW', type: 'switch', x: 320, y: 144 },
      { id: 'LP', type: 'lamp', x: 373, y: 250 },
    ],
    wires: [
      // L → 开关 → 灯 → N
      { from: ['PWR', 'L'], to: ['SW', 'in'] },
      { from: ['SW', 'out'], to: ['LP', 'L'] },
      { from: ['LP', 'N'], to: ['PWR', 'N'] },
    ],
  },
  {
    key: 'point_control',
    name: '接触器点动',
    goal: '控制回路 L1→停止(常闭)→启动(常开)→线圈→N；主回路 三相→主触点→电机。按住启动电机转，松开即停。',
    items: [
      { id: 'PWR', type: 'three_phase_power', x: 30, y: 150 },
      { id: 'SB1', type: 'button_nc', x: 250, y: 40, role: 'stop_button' },
      { id: 'SB2', type: 'button_no', x: 420, y: 40, role: 'start_button' },
      { id: 'KM_C', type: 'contactor_coil', x: 590, y: 45, groupId: 'KM1', role: 'coil' },
      { id: 'KM_M', type: 'contactor_main', x: 320, y: 260, groupId: 'KM1', role: 'main' },
      { id: 'M', type: 'motor', x: 320, y: 430, role: 'motor' },
    ],
    wires: [
      // 控制回路：L1 → 停止(NC) → 启动(NO) → 线圈A1；线圈A2 → N
      { from: ['PWR', 'L1'], to: ['SB1', 'in'] },
      { from: ['SB1', 'out'], to: ['SB2', 'in'] },
      { from: ['SB2', 'out'], to: ['KM_C', 'A1'] },
      { from: ['KM_C', 'A2'], to: ['PWR', 'N'] },
      // 主回路：三相 → 主触点 → 电机
      { from: ['PWR', 'L1'], to: ['KM_M', 'L1'] },
      { from: ['PWR', 'L2'], to: ['KM_M', 'L2'] },
      { from: ['PWR', 'L3'], to: ['KM_M', 'L3'] },
      { from: ['KM_M', 'T1'], to: ['M', 'U'] },
      { from: ['KM_M', 'T2'], to: ['M', 'V'] },
      { from: ['KM_M', 'T3'], to: ['M', 'W'] },
    ],
    template: {
      required: [
        { role: 'stop_button', type: 'button_nc' },
        { role: 'start_button', type: 'button_no' },
        { role: 'coil', type: 'contactor_coil' },
        { role: 'main', type: 'contactor_main' },
        { role: 'motor', type: 'motor' },
      ],
    },
  },
  {
    key: 'self_lock',
    name: '接触器自锁',
    goal: '在启动按钮上并联一个接触器辅助常开触点。按启动后松开仍保持运行，按停止才停。',
    items: [
      { id: 'PWR', type: 'three_phase_power', x: 30, y: 150 },
      { id: 'SB1', type: 'button_nc', x: 240, y: 30, role: 'stop_button' },
      { id: 'SB2', type: 'button_no', x: 410, y: 30, role: 'start_button' },
      { id: 'KM_A', type: 'contactor_no', x: 410, y: 150, groupId: 'KM1', role: 'aux_no' },
      { id: 'KM_C', type: 'contactor_coil', x: 590, y: 35, groupId: 'KM1', role: 'coil' },
      { id: 'KM_M', type: 'contactor_main', x: 320, y: 280, groupId: 'KM1', role: 'main' },
      { id: 'M', type: 'motor', x: 320, y: 450, role: 'motor' },
    ],
    wires: [
      // 控制回路：L1 → 停止(NC) → 启动(NO) → 线圈A1；线圈A2 → N
      { from: ['PWR', 'L1'], to: ['SB1', 'in'] },
      { from: ['SB1', 'out'], to: ['SB2', 'in'] },
      { from: ['SB2', 'out'], to: ['KM_C', 'A1'] },
      { from: ['KM_C', 'A2'], to: ['PWR', 'N'] },
      // 自锁：辅助常开触点 KM_A 与启动按钮 SB2 并联
      { from: ['SB1', 'out'], to: ['KM_A', 'in'] },
      { from: ['KM_A', 'out'], to: ['KM_C', 'A1'] },
      // 主回路：三相 → 主触点 → 电机
      { from: ['PWR', 'L1'], to: ['KM_M', 'L1'] },
      { from: ['PWR', 'L2'], to: ['KM_M', 'L2'] },
      { from: ['PWR', 'L3'], to: ['KM_M', 'L3'] },
      { from: ['KM_M', 'T1'], to: ['M', 'U'] },
      { from: ['KM_M', 'T2'], to: ['M', 'V'] },
      { from: ['KM_M', 'T3'], to: ['M', 'W'] },
    ],
    template: {
      required: [
        { role: 'stop_button', type: 'button_nc' },
        { role: 'start_button', type: 'button_no' },
        { role: 'coil', type: 'contactor_coil' },
        { role: 'aux_no', type: 'contactor_no' },
        { role: 'main', type: 'contactor_main' },
        { role: 'motor', type: 'motor' },
      ],
      constraints: [
        {
          kind: 'parallel',
          a: 'start_button',
          b: 'aux_no',
          message: '自锁触点应与启动按钮并联，而不是串联。',
        },
      ],
    },
  },
];
