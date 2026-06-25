// 验证 web 层 recompute 的“线圈 energized 跨调用持久化”逻辑：
// 每次都从 node 状态新建 Circuit（模拟 App.buildCircuit），自锁才需要把 energized 写回。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/engine/engine.ts';
import type { Circuit, Component } from '../src/engine/types.ts';

const TERMS: Record<string, string[]> = {
  three_phase_power: ['L1', 'L2', 'L3', 'N'],
  button_nc: ['in', 'out'],
  button_no: ['in', 'out'],
  contactor_coil: ['A1', 'A2'],
  contactor_no: ['in', 'out'],
  contactor_main: ['L1', 'T1', 'L2', 'T2', 'L3', 'T3'],
  motor: ['U', 'V', 'W'],
};

// 模拟画布：每个元件的可变状态存在 store 里
type Store = Record<string, { type: string; groupId?: string; state: any }>;

function makeStore(withAux: boolean): Store {
  const s: Store = {
    PWR: { type: 'three_phase_power', state: { on: true } },
    SB1: { type: 'button_nc', state: { pressed: false } },
    SB2: { type: 'button_no', state: { pressed: false } },
    KM_C: { type: 'contactor_coil', groupId: 'KM1', state: {} },
    KM_M: { type: 'contactor_main', groupId: 'KM1', state: {} },
    M: { type: 'motor', state: {} },
  };
  if (withAux) s.KM_A = { type: 'contactor_no', groupId: 'KM1', state: {} };
  return s;
}

const wires = (withAux: boolean) => {
  const list = [
    ['PWR', 'L1', 'SB1', 'in'],
    ['SB1', 'out', 'SB2', 'in'],
    ['SB2', 'out', 'KM_C', 'A1'],
    ['KM_C', 'A2', 'PWR', 'N'],
    ['PWR', 'L1', 'KM_M', 'L1'],
    ['PWR', 'L2', 'KM_M', 'L2'],
    ['PWR', 'L3', 'KM_M', 'L3'],
    ['KM_M', 'T1', 'M', 'U'],
    ['KM_M', 'T2', 'M', 'V'],
    ['KM_M', 'T3', 'M', 'W'],
  ];
  if (withAux) {
    list.push(['SB1', 'out', 'KM_A', 'in']);
    list.push(['KM_A', 'out', 'KM_C', 'A1']);
  }
  return list;
};

// 等价于 App.buildCircuit：每次新建 Circuit（含 state 拷贝）
function build(store: Store, withAux: boolean): Circuit {
  const components: Component[] = Object.entries(store).map(([id, n]) => ({
    id,
    type: n.type as Component['type'],
    groupId: n.groupId,
    terminals: TERMS[n.type].map((t) => ({ id: t })),
    state: { ...n.state },
    rules: n.type === 'motor' ? { isLoad: true } : undefined,
  }));
  const w = wires(withAux).map((x, i) => ({
    id: `w${i}`,
    from: { componentId: x[0], terminal: x[1] },
    to: { componentId: x[2], terminal: x[3] },
  }));
  return { schemaVersion: 1, components, wires: w };
}

// 等价于 App.recompute：跑模拟 + 把 energized 写回 store
function recompute(store: Store, withAux: boolean) {
  const r = simulate(build(store, withAux));
  const byId = new Map(r.components.map((c) => [c.id, c]));
  for (const [id, n] of Object.entries(store)) {
    if (n.type === 'contactor_coil') n.state.energized = !!byId.get(id)?.energized;
  }
  return r;
}

const motorOn = (r: ReturnType<typeof simulate>) =>
  !!r.components.find((c) => c.id === 'M')?.working;

test('web 集成 · 自锁：按启动→保持→停止（依赖 energized 持久化）', () => {
  const s = makeStore(true);

  s.SB2.state.pressed = true;
  assert.equal(motorOn(recompute(s, true)), true, '按下启动应运行');

  s.SB2.state.pressed = false;
  assert.equal(motorOn(recompute(s, true)), true, '松开后应保持运行（自锁）');

  s.SB1.state.pressed = true;
  assert.equal(motorOn(recompute(s, true)), false, '按停止应停');

  s.SB1.state.pressed = false;
  assert.equal(motorOn(recompute(s, true)), false, '松开停止应保持停止');
});

test('web 集成 · 点动：按住转，松开停', () => {
  const s = makeStore(false);

  s.SB2.state.pressed = true;
  assert.equal(motorOn(recompute(s, false)), true);

  s.SB2.state.pressed = false;
  assert.equal(motorOn(recompute(s, false)), false, '点动松开即停');
});
