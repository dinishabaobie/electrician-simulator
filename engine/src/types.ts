// 电工模拟器 · 模拟引擎类型定义
// 对应《电路连通性判定规约》§1

export type Vec2 = { x: number; y: number };

export interface Terminal {
  id: string;
  offset?: Vec2;
}

export type ComponentType =
  | 'single_phase_power'
  | 'three_phase_power'
  | 'breaker'
  | 'breaker3'
  | 'fuse'
  | 'thermal_main'
  | 'thermal_nc'
  | 'switch'
  | 'button_no'
  | 'button_nc'
  | 'contactor_coil'
  | 'contactor_main'
  | 'contactor_no'
  | 'contactor_nc'
  | 'lamp'
  | 'indicator'
  | 'motor'
  // v2 电压模型元件
  | 'transformer3'   // 三相变压器：一次 L1~L3，二次三组抽头 R1S1T1 / R2S2T2 / R3S3T3
  | 'rectifier3'     // 三相整流桥：L1~L3 → DC+ / DC-
  | 'dc_motor'       // 直流电机：DC+ / DC-，转速 ∝ 电压
  | 'ammeter'        // 电流表（近似 0Ω 串联，读支路电流）
  | 'voltmeter'      // 电压表（开路跨接，读两端电压）
  | 'timer_coil'     // 时间继电器本体（ZN96）：端子 7/8 供电，得电开始计时（计时在 UI 层）
  | 'timer_no'       // 通电延时闭合触点：延时到（state.closed=true）才导通，断电复位
  | 'terminal_block' // 接线端子排：五对直通（L1/L2/L3/N/PE），空置端子不算悬空
  | 'earth';         // 保护接地符号：单端子，无边（装饰）

export interface ComponentState {
  // 用户/可操作状态
  on?: boolean;        // 电源是否有电
  closed?: boolean;    // 开关/空开是否合
  pressed?: boolean;   // 按钮是否按下
  blown?: boolean;     // 熔断器是否熔断
  tripped?: boolean;   // 热继是否动作
  // 引擎派生状态（引擎回写）
  energized?: boolean; // 线圈是否得电（自锁需跨调用持久化）
  working?: boolean;   // 灯亮 / 电机转
  remain?: number;     // 时间继电器：剩余秒数（UI 层维护，引擎不读）
}

export interface Component {
  id: string;
  type: ComponentType;
  name?: string;
  position?: Vec2;
  terminals: Terminal[];
  state: ComponentState;
  rules?: {
    isLoad?: boolean;
    motorMode?: 'three_phase' | 'simplified';
    tapVolts?: number[];         // transformer3：各组抽头的线电压（默认 [60, 45, 30]）
    ratedV?: number;             // dc_motor：额定电压（转速百分比的基准）
    [k: string]: unknown;
  };
  groupId?: string;    // 接触器/热继：线圈与触点同组
  role?: string;       // 练习模式：该元件在模板里承担的角色，如 'stop_button'
}

// 练习模板：用于练习模式的语义判错（对照预期结构）
export interface ExpectedComponent {
  role: string;
  type: ComponentType;
}

export type ExpectedConstraint =
  | { kind: 'parallel'; a: string; b: string; message?: string }
  | { kind: 'series'; a: string; b: string; message?: string };

export interface Expected {
  required: ExpectedComponent[];
  constraints?: ExpectedConstraint[];
}

export interface Wire {
  id: string;
  from: { componentId: string; terminal: string };
  to: { componentId: string; terminal: string };
}

export interface Circuit {
  schemaVersion: number;
  components: Component[];
  wires: Wire[];
}

export type NodeId = string;

export type CheckCode =
  | 'floating_terminal'
  | 'open_circuit'
  | 'phase_loss'
  | 'short_circuit'
  | 'no_power'
  | 'wrong_type'
  | 'wrong_topology'
  | 'missing_component';

export interface CheckError {
  code: CheckCode;
  message: string;
  componentId?: string;
}

export interface SimComponentOut {
  id: string;
  working?: boolean;
  closed?: boolean;
  energized?: boolean;
  faulted?: boolean;
  // v2 电压模型读数
  volts?: number;    // 负载两端 / 电压表电压（有效值近似）
  amps?: number;     // 流过电流（负载 / 电流表）
  speedPct?: number; // 电机转速百分比（相对额定电压）
}

export interface SimResult {
  stable: boolean;
  reason?: 'oscillation' | 'max_iter';
  energizedNodes: NodeId[];
  components: SimComponentOut[];
  shorts: Array<{ nodes: [NodeId, NodeId] }>;
  errors: CheckError[];
}
