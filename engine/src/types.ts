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
  | 'motor';

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
}

export interface Component {
  id: string;
  type: ComponentType;
  name?: string;
  position?: Vec2;
  terminals: Terminal[];
  state: ComponentState;
  rules?: { isLoad?: boolean; motorMode?: 'three_phase' | 'simplified'; [k: string]: unknown };
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
}

export interface SimResult {
  stable: boolean;
  reason?: 'oscillation' | 'max_iter';
  energizedNodes: NodeId[];
  components: SimComponentOut[];
  shorts: Array<{ nodes: [NodeId, NodeId] }>;
  errors: CheckError[];
}
