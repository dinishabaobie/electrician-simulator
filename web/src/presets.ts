import type { Expected } from './engine/types.ts';

export interface PresetItem {
  id: string;
  type: string;
  x: number;
  y: number;
  groupId?: string;
  role?: string;
}

export interface Practice {
  key: string;
  name: string;
  goal: string;
  items: PresetItem[];
  template?: Expected; // 练习模式语义判错模板
}

export const PRACTICES: Practice[] = [
  {
    key: 'single_light',
    name: '单灯单控',
    goal: '接成 L → 开关 → 灯泡 → N，点开关让灯亮灭。',
    items: [
      { id: 'PWR', type: 'single_phase_power', x: 40, y: 160 },
      { id: 'SW', type: 'switch', x: 320, y: 90 },
      { id: 'LP', type: 'lamp', x: 320, y: 250 },
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
      { id: 'KM_C', type: 'contactor_coil', x: 590, y: 40, groupId: 'KM1', role: 'coil' },
      { id: 'KM_M', type: 'contactor_main', x: 320, y: 260, groupId: 'KM1', role: 'main' },
      { id: 'M', type: 'motor', x: 320, y: 430, role: 'motor' },
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
      { id: 'KM_C', type: 'contactor_coil', x: 590, y: 30, groupId: 'KM1', role: 'coil' },
      { id: 'KM_M', type: 'contactor_main', x: 320, y: 280, groupId: 'KM1', role: 'main' },
      { id: 'M', type: 'motor', x: 320, y: 450, role: 'motor' },
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
