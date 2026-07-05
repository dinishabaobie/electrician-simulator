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
  {
    key: 'self_lock_overload',
    name: '自锁 + 热保护',
    goal: '在自锁电路上加热继电器 FR：热元件串入主回路，常闭触点串入控制回路。点击 FR 模拟过载动作——电机停转且不会自行重启；再点击复位后需重新按启动。',
    items: [
      { id: 'PWR', type: 'three_phase_power', x: 30, y: 150 },
      { id: 'SB1', type: 'button_nc', x: 240, y: 30, role: 'stop_button' },
      { id: 'SB2', type: 'button_no', x: 410, y: 30, role: 'start_button' },
      { id: 'KM_A', type: 'contactor_no', x: 410, y: 150, groupId: 'KM1', role: 'aux_no' },
      { id: 'KM_C', type: 'contactor_coil', x: 560, y: 35, groupId: 'KM1', role: 'coil' },
      { id: 'FR_NC', type: 'thermal_nc', x: 730, y: 37, groupId: 'FR1', role: 'overload_nc' },
      { id: 'KM_M', type: 'contactor_main', x: 320, y: 280, groupId: 'KM1', role: 'main' },
      { id: 'FR_M', type: 'thermal_main', x: 320, y: 430, groupId: 'FR1', role: 'overload_main' },
      { id: 'M', type: 'motor', x: 320, y: 580, role: 'motor' },
    ],
    wires: [
      // 控制回路：L1 → 停止(NC) → 启动(NO) → 线圈 → FR常闭 → N
      { from: ['PWR', 'L1'], to: ['SB1', 'in'] },
      { from: ['SB1', 'out'], to: ['SB2', 'in'] },
      { from: ['SB2', 'out'], to: ['KM_C', 'A1'] },
      { from: ['KM_C', 'A2'], to: ['FR_NC', 'in'] },
      { from: ['FR_NC', 'out'], to: ['PWR', 'N'] },
      // 自锁：辅助常开触点 KM_A 与启动按钮 SB2 并联
      { from: ['SB1', 'out'], to: ['KM_A', 'in'] },
      { from: ['KM_A', 'out'], to: ['KM_C', 'A1'] },
      // 主回路：三相 → 主触点 → FR 热元件 → 电机
      { from: ['PWR', 'L1'], to: ['KM_M', 'L1'] },
      { from: ['PWR', 'L2'], to: ['KM_M', 'L2'] },
      { from: ['PWR', 'L3'], to: ['KM_M', 'L3'] },
      { from: ['KM_M', 'T1'], to: ['FR_M', 'L1'] },
      { from: ['KM_M', 'T2'], to: ['FR_M', 'L2'] },
      { from: ['KM_M', 'T3'], to: ['FR_M', 'L3'] },
      { from: ['FR_M', 'T1'], to: ['M', 'U'] },
      { from: ['FR_M', 'T2'], to: ['M', 'V'] },
      { from: ['FR_M', 'T3'], to: ['M', 'W'] },
    ],
    template: {
      required: [
        { role: 'stop_button', type: 'button_nc' },
        { role: 'start_button', type: 'button_no' },
        { role: 'coil', type: 'contactor_coil' },
        { role: 'aux_no', type: 'contactor_no' },
        { role: 'overload_nc', type: 'thermal_nc' },
        { role: 'main', type: 'contactor_main' },
        { role: 'overload_main', type: 'thermal_main' },
        { role: 'motor', type: 'motor' },
      ],
      constraints: [
        {
          kind: 'parallel',
          a: 'start_button',
          b: 'aux_no',
          message: '自锁触点应与启动按钮并联，而不是串联。',
        },
        {
          kind: 'series',
          a: 'overload_nc',
          b: 'coil',
          message: '热继常闭触点应串联在控制回路里（通常接在线圈与零线之间），过载时才能切断线圈。',
        },
      ],
    },
  },
  {
    key: 'seq_start',
    name: '两台电机顺序启动',
    goal: '教材接法：FR1、FR2 常闭串在控制总线（任一台过载两台全停）；SB12 停 M1——顺序触点会让 M2 级联跟停；SB22 单独停 M2；M2 支路串 KM1 辅助常开（顺序联锁），必须先启动 M1 才能启动 M2。',
    items: [
      { id: 'PWR', type: 'three_phase_power', x: 30, y: 150 },
      // 控制总线：L1 → FR1 常闭 → FR2 常闭 → 分成两条支路
      { id: 'FR1_NC', type: 'thermal_nc', x: 170, y: 37, groupId: 'FR1', role: 'overload_nc_m1' },
      { id: 'FR2_NC', type: 'thermal_nc', x: 310, y: 37, groupId: 'FR2', role: 'overload_nc_m2' },
      // M1 支路：SB12 停止 → SB11 启动（自锁）→ KM1 线圈
      { id: 'SB12', type: 'button_nc', x: 450, y: 30, role: 'stop_m1' },
      { id: 'SB11', type: 'button_no', x: 610, y: 30, role: 'start_m1' },
      { id: 'KM1_A', type: 'contactor_no', x: 610, y: 150, groupId: 'KM1', role: 'self_lock_m1' },
      { id: 'KM1_C', type: 'contactor_coil', x: 770, y: 35, groupId: 'KM1', role: 'coil_m1' },
      // M2 支路：SB22 停止 → SB21 启动（自锁）→ KM1 顺序触点 → KM2 线圈
      { id: 'SB22', type: 'button_nc', x: 450, y: 290, role: 'stop_m2' },
      { id: 'SB21', type: 'button_no', x: 610, y: 290, role: 'start_m2' },
      { id: 'KM2_A', type: 'contactor_no', x: 610, y: 410, groupId: 'KM2', role: 'self_lock_m2' },
      { id: 'KM1_B', type: 'contactor_no', x: 770, y: 292, groupId: 'KM1', role: 'seq_no' },
      { id: 'KM2_C', type: 'contactor_coil', x: 930, y: 297, groupId: 'KM2', role: 'coil_m2' },
      // 两路主回路（各带 FR 热元件）
      { id: 'KM1_M', type: 'contactor_main', x: 160, y: 560, groupId: 'KM1', role: 'main_m1' },
      { id: 'FR1_M', type: 'thermal_main', x: 160, y: 710, groupId: 'FR1', role: 'overload_main_m1' },
      { id: 'M1', type: 'motor', x: 160, y: 860, role: 'motor_m1' },
      { id: 'KM2_M', type: 'contactor_main', x: 480, y: 560, groupId: 'KM2', role: 'main_m2' },
      { id: 'FR2_M', type: 'thermal_main', x: 480, y: 710, groupId: 'FR2', role: 'overload_main_m2' },
      { id: 'M2', type: 'motor', x: 480, y: 860, role: 'motor_m2' },
    ],
    wires: [
      // 控制总线：L1 → FR1 → FR2 → 节点③（两支路公共点）
      { from: ['PWR', 'L1'], to: ['FR1_NC', 'in'] },
      { from: ['FR1_NC', 'out'], to: ['FR2_NC', 'in'] },
      { from: ['FR2_NC', 'out'], to: ['SB12', 'in'] },
      { from: ['FR2_NC', 'out'], to: ['SB22', 'in'] },
      // M1 支路：SB12(NC) → SB11(NO) ∥ KM1 自锁 → KM1 线圈 → N
      { from: ['SB12', 'out'], to: ['SB11', 'in'] },
      { from: ['SB11', 'out'], to: ['KM1_C', 'A1'] },
      { from: ['KM1_C', 'A2'], to: ['PWR', 'N'] },
      { from: ['SB12', 'out'], to: ['KM1_A', 'in'] },
      { from: ['KM1_A', 'out'], to: ['KM1_C', 'A1'] },
      // M2 支路：SB22(NC) → SB21(NO) ∥ KM2 自锁 → KM1 顺序触点 → KM2 线圈 → N
      { from: ['SB22', 'out'], to: ['SB21', 'in'] },
      { from: ['SB21', 'out'], to: ['KM1_B', 'in'] },
      { from: ['SB22', 'out'], to: ['KM2_A', 'in'] },
      { from: ['KM2_A', 'out'], to: ['KM1_B', 'in'] },
      { from: ['KM1_B', 'out'], to: ['KM2_C', 'A1'] },
      { from: ['KM2_C', 'A2'], to: ['PWR', 'N'] },
      // 主回路一：三相 → KM1 主触点 → FR1 热元件 → M1
      { from: ['PWR', 'L1'], to: ['KM1_M', 'L1'] },
      { from: ['PWR', 'L2'], to: ['KM1_M', 'L2'] },
      { from: ['PWR', 'L3'], to: ['KM1_M', 'L3'] },
      { from: ['KM1_M', 'T1'], to: ['FR1_M', 'L1'] },
      { from: ['KM1_M', 'T2'], to: ['FR1_M', 'L2'] },
      { from: ['KM1_M', 'T3'], to: ['FR1_M', 'L3'] },
      { from: ['FR1_M', 'T1'], to: ['M1', 'U'] },
      { from: ['FR1_M', 'T2'], to: ['M1', 'V'] },
      { from: ['FR1_M', 'T3'], to: ['M1', 'W'] },
      // 主回路二：三相 → KM2 主触点 → FR2 热元件 → M2
      { from: ['PWR', 'L1'], to: ['KM2_M', 'L1'] },
      { from: ['PWR', 'L2'], to: ['KM2_M', 'L2'] },
      { from: ['PWR', 'L3'], to: ['KM2_M', 'L3'] },
      { from: ['KM2_M', 'T1'], to: ['FR2_M', 'L1'] },
      { from: ['KM2_M', 'T2'], to: ['FR2_M', 'L2'] },
      { from: ['KM2_M', 'T3'], to: ['FR2_M', 'L3'] },
      { from: ['FR2_M', 'T1'], to: ['M2', 'U'] },
      { from: ['FR2_M', 'T2'], to: ['M2', 'V'] },
      { from: ['FR2_M', 'T3'], to: ['M2', 'W'] },
    ],
    template: {
      required: [
        { role: 'stop_m1', type: 'button_nc' },
        { role: 'stop_m2', type: 'button_nc' },
        { role: 'start_m1', type: 'button_no' },
        { role: 'start_m2', type: 'button_no' },
        { role: 'coil_m1', type: 'contactor_coil' },
        { role: 'coil_m2', type: 'contactor_coil' },
        { role: 'self_lock_m1', type: 'contactor_no' },
        { role: 'self_lock_m2', type: 'contactor_no' },
        { role: 'seq_no', type: 'contactor_no' },
        { role: 'overload_nc_m1', type: 'thermal_nc' },
        { role: 'overload_nc_m2', type: 'thermal_nc' },
        { role: 'main_m1', type: 'contactor_main' },
        { role: 'main_m2', type: 'contactor_main' },
        { role: 'overload_main_m1', type: 'thermal_main' },
        { role: 'overload_main_m2', type: 'thermal_main' },
        { role: 'motor_m1', type: 'motor' },
        { role: 'motor_m2', type: 'motor' },
      ],
      constraints: [
        {
          kind: 'parallel',
          a: 'start_m1',
          b: 'self_lock_m1',
          message: 'KM1 自锁触点应与启动按钮 SB11 并联。',
        },
        {
          kind: 'parallel',
          a: 'start_m2',
          b: 'self_lock_m2',
          message: 'KM2 自锁触点应与启动按钮 SB21 并联。',
        },
        {
          kind: 'series',
          a: 'seq_no',
          b: 'coil_m2',
          message: '顺序联锁触点（KM1 辅助常开）应串联在 KM2 线圈支路里，保证 M1 先启动、M1 停时 M2 跟停。',
        },
      ],
    },
  },
  {
    key: 'interlock',
    name: '接触器互锁',
    goal: '两条支路各串对方的辅助常闭：KM2 吸合时它的常闭断开，KM3 就进不来（反之亦然），保证两个接触器永不同时吸合。先合一个挡，再试另一个挡体会互锁；换挡要先退出当前挡。（实物中两个开关是一个联动手柄，不会同时合上）',
    items: [
      { id: 'PWR', type: 'single_phase_power', x: 30, y: 120 },
      // 挡位一：SA2·1 → KM3 常闭（互锁）→ KM2 线圈
      { id: 'SA2_1', type: 'switch', x: 240, y: 40, role: 'sel_km2' },
      { id: 'KM3_NC', type: 'contactor_nc', x: 410, y: 48, groupId: 'KM3', role: 'nc_of_km3' },
      { id: 'KM2_C', type: 'contactor_coil', x: 580, y: 46, groupId: 'KM2', role: 'coil_km2' },
      // 挡位二：SA2·2 → KM2 常闭（互锁）→ KM3 线圈
      { id: 'SA2_2', type: 'switch', x: 240, y: 240, role: 'sel_km3' },
      { id: 'KM2_NC', type: 'contactor_nc', x: 410, y: 248, groupId: 'KM2', role: 'nc_of_km2' },
      { id: 'KM3_C', type: 'contactor_coil', x: 580, y: 246, groupId: 'KM3', role: 'coil_km3' },
    ],
    wires: [
      { from: ['PWR', 'L'], to: ['SA2_1', 'in'] },
      { from: ['SA2_1', 'out'], to: ['KM3_NC', 'in'] },
      { from: ['KM3_NC', 'out'], to: ['KM2_C', 'A1'] },
      { from: ['KM2_C', 'A2'], to: ['PWR', 'N'] },
      { from: ['PWR', 'L'], to: ['SA2_2', 'in'] },
      { from: ['SA2_2', 'out'], to: ['KM2_NC', 'in'] },
      { from: ['KM2_NC', 'out'], to: ['KM3_C', 'A1'] },
      { from: ['KM3_C', 'A2'], to: ['PWR', 'N'] },
    ],
    template: {
      required: [
        { role: 'sel_km2', type: 'switch' },
        { role: 'sel_km3', type: 'switch' },
        { role: 'nc_of_km2', type: 'contactor_nc' },
        { role: 'nc_of_km3', type: 'contactor_nc' },
        { role: 'coil_km2', type: 'contactor_coil' },
        { role: 'coil_km3', type: 'contactor_coil' },
      ],
      constraints: [
        {
          kind: 'series',
          a: 'nc_of_km3',
          b: 'coil_km2',
          message: 'KM2 支路里应串 KM3 的辅助常闭（互锁）。',
        },
        {
          kind: 'series',
          a: 'nc_of_km2',
          b: 'coil_km3',
          message: 'KM3 支路里应串 KM2 的辅助常闭（互锁）。',
        },
      ],
    },
  },
  {
    key: 'traction',
    name: '牵引机控制回路',
    goal: '火车牵引机（简化）：HL1~3 电源指示；合 KT1（模拟延时到）→ 按 SB1 → KM1 吸合自锁、风机 MF1/MF2 转；SA2 选挡使 KM2 或 KM3 吸合（互锁，永不同时）；KM1 与任一挡都吸合时牵引电机才转。变压/整流为示意，不参与模拟。',
    items: [
      { id: 'PWR', type: 'three_phase_power', x: 30, y: 30 },
      // 电源指示灯：电源正下方一列，就近取三相
      { id: 'HL1', type: 'indicator', x: 60, y: 200, role: 'pilot1' },
      { id: 'HL2', type: 'indicator', x: 60, y: 320, role: 'pilot2' },
      { id: 'HL3', type: 'indicator', x: 60, y: 440, role: 'pilot3' },
      // 启动控制行：SB1(NO) ∥ KM1 自锁 → SB2(NC) → KT1 延时触点 → KM1 线圈 ∥ 风机
      { id: 'SB1', type: 'button_no', x: 280, y: 40, role: 'start_button' },
      { id: 'KM1_A', type: 'contactor_no', x: 280, y: 170, groupId: 'KM1', role: 'aux_no' },
      { id: 'SB2', type: 'button_nc', x: 430, y: 40, role: 'stop_button' },
      { id: 'KT1', type: 'switch', x: 560, y: 51, role: 'delay' },
      { id: 'KM1_C', type: 'contactor_coil', x: 700, y: 45, groupId: 'KM1', role: 'coil' },
      { id: 'MF1', type: 'fan', x: 890, y: 30, role: 'fan1' },
      { id: 'MF2', type: 'fan', x: 1020, y: 30, role: 'fan2' },
      // 选挡两行：与 SB1 同列（火线竖向串接），线圈 A2 与 KM1 线圈对齐成零线母线
      { id: 'SA2_1', type: 'switch', x: 280, y: 300, role: 'sel_km2' },
      { id: 'KM3_NC', type: 'contactor_nc', x: 500, y: 296, groupId: 'KM3', role: 'nc_of_km3' },
      { id: 'KM2_C', type: 'contactor_coil', x: 700, y: 294, groupId: 'KM2', role: 'coil_km2' },
      { id: 'SA2_2', type: 'switch', x: 280, y: 460, role: 'sel_km3' },
      { id: 'KM2_NC', type: 'contactor_nc', x: 500, y: 456, groupId: 'KM2', role: 'nc_of_km2' },
      { id: 'KM3_C', type: 'contactor_coil', x: 700, y: 454, groupId: 'KM3', role: 'coil_km3' },
      // 主回路（示意）：电源下方左侧走廊直落
      { id: 'KM1_M', type: 'contactor_main', x: 140, y: 640, groupId: 'KM1', role: 'main' },
      { id: 'KM2_M', type: 'contactor_main', x: 60, y: 810, groupId: 'KM2', role: 'main_km2' },
      { id: 'KM3_M', type: 'contactor_main', x: 300, y: 810, groupId: 'KM3', role: 'main_km3' },
      { id: 'M', type: 'motor', x: 170, y: 980, role: 'traction_motor' },
    ],
    wires: [
      // 电源指示：相线就近直落，零线在灯之间竖向串接
      { from: ['PWR', 'L1'], to: ['HL1', 'L'] },
      { from: ['PWR', 'L2'], to: ['HL2', 'L'] },
      { from: ['PWR', 'L3'], to: ['HL3', 'L'] },
      { from: ['PWR', 'N'], to: ['HL1', 'N'] },
      { from: ['HL1', 'N'], to: ['HL2', 'N'] },
      { from: ['HL2', 'N'], to: ['HL3', 'N'] },
      // 火线母线：L1 → SB1，往下逐个串接（同一电气节点，走线短）
      { from: ['PWR', 'L1'], to: ['SB1', 'in'] },
      { from: ['SB1', 'in'], to: ['KM1_A', 'in'] },
      { from: ['KM1_A', 'in'], to: ['SA2_1', 'in'] },
      { from: ['SA2_1', 'in'], to: ['SA2_2', 'in'] },
      // 启动控制链
      { from: ['KM1_A', 'out'], to: ['SB2', 'in'] },
      { from: ['SB1', 'out'], to: ['SB2', 'in'] },
      { from: ['SB2', 'out'], to: ['KT1', 'in'] },
      { from: ['KT1', 'out'], to: ['KM1_C', 'A1'] },
      // 风机与 KM1 线圈并联（火线、零线各自串接）
      { from: ['KT1', 'out'], to: ['MF1', 'U'] },
      { from: ['MF1', 'U'], to: ['MF2', 'U'] },
      { from: ['KM1_C', 'A2'], to: ['MF1', 'V'] },
      { from: ['MF1', 'V'], to: ['MF2', 'V'] },
      // 选挡互锁两支路
      { from: ['SA2_1', 'out'], to: ['KM3_NC', 'in'] },
      { from: ['KM3_NC', 'out'], to: ['KM2_C', 'A1'] },
      { from: ['SA2_2', 'out'], to: ['KM2_NC', 'in'] },
      { from: ['KM2_NC', 'out'], to: ['KM3_C', 'A1'] },
      // 零线母线：三个线圈 A2 对齐竖向串接，只留一根回电源 N
      { from: ['KM3_C', 'A2'], to: ['KM2_C', 'A2'] },
      { from: ['KM2_C', 'A2'], to: ['KM1_C', 'A2'] },
      { from: ['KM1_C', 'A2'], to: ['PWR', 'N'] },
      // 主回路（示意）：相线沿指示灯左侧走廊直落
      { from: ['PWR', 'L1'], to: ['KM1_M', 'L1'] },
      { from: ['PWR', 'L2'], to: ['KM1_M', 'L2'] },
      { from: ['PWR', 'L3'], to: ['KM1_M', 'L3'] },
      { from: ['KM1_M', 'T1'], to: ['KM2_M', 'L1'] },
      { from: ['KM1_M', 'T2'], to: ['KM2_M', 'L2'] },
      { from: ['KM1_M', 'T3'], to: ['KM2_M', 'L3'] },
      { from: ['KM1_M', 'T1'], to: ['KM3_M', 'L1'] },
      { from: ['KM1_M', 'T2'], to: ['KM3_M', 'L2'] },
      { from: ['KM1_M', 'T3'], to: ['KM3_M', 'L3'] },
      { from: ['KM2_M', 'T1'], to: ['M', 'U'] },
      { from: ['KM2_M', 'T2'], to: ['M', 'V'] },
      { from: ['KM2_M', 'T3'], to: ['M', 'W'] },
      { from: ['KM3_M', 'T1'], to: ['M', 'U'] },
      { from: ['KM3_M', 'T2'], to: ['M', 'V'] },
      { from: ['KM3_M', 'T3'], to: ['M', 'W'] },
    ],
    template: {
      required: [
        { role: 'start_button', type: 'button_no' },
        { role: 'stop_button', type: 'button_nc' },
        { role: 'aux_no', type: 'contactor_no' },
        { role: 'delay', type: 'switch' },
        { role: 'coil', type: 'contactor_coil' },
        { role: 'sel_km2', type: 'switch' },
        { role: 'sel_km3', type: 'switch' },
        { role: 'nc_of_km2', type: 'contactor_nc' },
        { role: 'nc_of_km3', type: 'contactor_nc' },
        { role: 'coil_km2', type: 'contactor_coil' },
        { role: 'coil_km3', type: 'contactor_coil' },
        { role: 'main', type: 'contactor_main' },
        { role: 'main_km2', type: 'contactor_main' },
        { role: 'main_km3', type: 'contactor_main' },
        { role: 'traction_motor', type: 'motor' },
      ],
      constraints: [
        {
          kind: 'parallel',
          a: 'start_button',
          b: 'aux_no',
          message: '自锁触点应与启动按钮 SB1 并联。',
        },
        {
          kind: 'series',
          a: 'delay',
          b: 'coil',
          message: 'KT1 延时触点应串联在 KM1 线圈回路里（延时到才允许合闸）。',
        },
        {
          kind: 'series',
          a: 'nc_of_km3',
          b: 'coil_km2',
          message: 'KM2 支路里应串 KM3 的辅助常闭（互锁）。',
        },
        {
          kind: 'series',
          a: 'nc_of_km2',
          b: 'coil_km3',
          message: 'KM3 支路里应串 KM2 的辅助常闭（互锁）。',
        },
      ],
    },
  },
];
