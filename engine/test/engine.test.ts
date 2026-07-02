// 《电路连通性判定规约》§11 最小验收测试集
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, isParallel, isSeries } from '../src/engine.ts';
import { C, w, circuit, get } from './builder.ts';
import type { Circuit } from '../src/types.ts';

const find = (c: Circuit, r: ReturnType<typeof simulate>, id: string) =>
  r.components.find((x) => x.id === id)!;

// ---- 1 & 2：单灯单控 ----
test('单灯单控：开关闭合灯亮', () => {
  const c = circuit(
    [C.power1('P'), C.sw('SW', true), C.lamp('LP')],
    [w('P', 'L', 'SW', 'in'), w('SW', 'out', 'LP', 'L'), w('LP', 'N', 'P', 'N')],
  );
  const r = simulate(c);
  assert.equal(find(c, r, 'LP').working, true);
  assert.equal(r.shorts.length, 0);
});

test('单灯单控：开关断开灯灭', () => {
  const c = circuit(
    [C.power1('P'), C.sw('SW', false), C.lamp('LP')],
    [w('P', 'L', 'SW', 'in'), w('SW', 'out', 'LP', 'L'), w('LP', 'N', 'P', 'N')],
  );
  const r = simulate(c);
  assert.equal(find(c, r, 'LP').working, false);
});

// ---- 3：缺零线 → 断路 + 悬空 ----
test('灯泡只接火线不接零线：灯灭且报悬空/断路', () => {
  const c = circuit(
    [C.power1('P'), C.sw('SW', true), C.lamp('LP')],
    [w('P', 'L', 'SW', 'in'), w('SW', 'out', 'LP', 'L')], // LP.N 悬空
  );
  const r = simulate(c);
  assert.equal(find(c, r, 'LP').working, false);
  assert.ok(r.errors.some((e) => e.code === 'floating_terminal' && e.componentId === 'LP'));
});

// ---- 4：无负载直连 → 短路 ----
test('火线经开关直接回零线（无负载）：判短路', () => {
  const c = circuit(
    [C.power1('P'), C.sw('SW', true)],
    [w('P', 'L', 'SW', 'in'), w('SW', 'out', 'P', 'N')],
  );
  const r = simulate(c);
  assert.ok(r.shorts.length > 0);
  assert.ok(r.errors.some((e) => e.code === 'short_circuit'));
});

// 点动控制电路构造
function pointControl(pressed: boolean): Circuit {
  return circuit(
    [
      C.power3('P'),
      C.btnNC('SB1'),                 // 停止
      C.btnNO('SB2', pressed),        // 启动
      C.coil('KM_C', 'g'),
      C.main('KM_M', 'g'),
      C.motor('M'),
    ],
    [
      // 控制回路：L1 → SB1 → SB2 → 线圈 → N
      w('P', 'L1', 'SB1', 'in'),
      w('SB1', 'out', 'SB2', 'in'),
      w('SB2', 'out', 'KM_C', 'A1'),
      w('KM_C', 'A2', 'P', 'N'),
      // 主回路：三相 → 主触点 → 电机
      w('P', 'L1', 'KM_M', 'L1'),
      w('P', 'L2', 'KM_M', 'L2'),
      w('P', 'L3', 'KM_M', 'L3'),
      w('KM_M', 'T1', 'M', 'U'),
      w('KM_M', 'T2', 'M', 'V'),
      w('KM_M', 'T3', 'M', 'W'),
    ],
  );
}

// ---- 5 & 6：点动 ----
test('点动：按住启动电机转', () => {
  const c = pointControl(true);
  const r = simulate(c);
  assert.equal(find(c, r, 'KM_C').energized, true);
  assert.equal(find(c, r, 'M').working, true);
});

test('点动：松开启动电机停', () => {
  const c = pointControl(false);
  const r = simulate(c);
  assert.equal(find(c, r, 'KM_C').energized, false);
  assert.equal(find(c, r, 'M').working, false);
});

// 自锁电路构造（aux 与 SB2 并联）
function selfLock(withAux: boolean): Circuit {
  const comps = [
    C.power3('P'),
    C.btnNC('SB1'),
    C.btnNO('SB2'),
    C.coil('KM_C', 'g'),
    C.main('KM_M', 'g'),
    C.motor('M'),
  ];
  const wires = [
    w('P', 'L1', 'SB1', 'in'),
    w('SB1', 'out', 'SB2', 'in'),
    w('SB2', 'out', 'KM_C', 'A1'),
    w('KM_C', 'A2', 'P', 'N'),
    w('P', 'L1', 'KM_M', 'L1'),
    w('P', 'L2', 'KM_M', 'L2'),
    w('P', 'L3', 'KM_M', 'L3'),
    w('KM_M', 'T1', 'M', 'U'),
    w('KM_M', 'T2', 'M', 'V'),
    w('KM_M', 'T3', 'M', 'W'),
  ];
  if (withAux) {
    comps.push(C.auxNO('KM_A', 'g'));
    // 辅助常开与 SB2 并联：两端分别并到 SB1.out 和 KM_C.A1
    wires.push(w('SB1', 'out', 'KM_A', 'in'));
    wires.push(w('KM_A', 'out', 'KM_C', 'A1'));
  }
  return circuit(comps, wires);
}

// ---- 7 & 8：自锁保持 / 停止 ----
test('自锁：按下启动→保持运行；按停止→停', () => {
  const c = selfLock(true);

  // 按下启动
  get(c, 'SB2').state.pressed = true;
  let r = simulate(c);
  assert.equal(find(c, r, 'M').working, true);

  // 松开启动 → 仍运行（自锁）
  get(c, 'SB2').state.pressed = false;
  r = simulate(c);
  assert.equal(find(c, r, 'M').working, true, '松开后应保持运行');
  assert.equal(r.stable, true);

  // 按下停止 → 停
  get(c, 'SB1').state.pressed = true;
  r = simulate(c);
  assert.equal(find(c, r, 'M').working, false);

  // 松开停止 → 保持停止（不会自启）
  get(c, 'SB1').state.pressed = false;
  r = simulate(c);
  assert.equal(find(c, r, 'M').working, false);
});

// ---- 9：缺自锁触点 → 松开即停 ----
test('缺辅助常开触点：松开启动即停', () => {
  const c = selfLock(false);
  get(c, 'SB2').state.pressed = true;
  let r = simulate(c);
  assert.equal(find(c, r, 'M').working, true);
  get(c, 'SB2').state.pressed = false;
  r = simulate(c);
  assert.equal(find(c, r, 'M').working, false);
});

// ---- 10：自锁触点接成串联（语义判错）----
test('并联/串联判定：自锁触点应与启动按钮并联', () => {
  const parallelC = selfLock(true);
  assert.equal(isParallel(parallelC, 'SB2', 'KM_A'), true);
  assert.equal(isSeries(parallelC, 'SB2', 'KM_A'), false);

  // 串联接法：aux 接在 SB2 之后再到线圈
  const seriesC = circuit(
    [
      C.power3('P'), C.btnNC('SB1'), C.btnNO('SB2'),
      C.auxNO('KM_A', 'g'), C.coil('KM_C', 'g'),
    ],
    [
      w('P', 'L1', 'SB1', 'in'),
      w('SB1', 'out', 'SB2', 'in'),
      w('SB2', 'out', 'KM_A', 'in'),   // SB2 → aux 串联
      w('KM_A', 'out', 'KM_C', 'A1'),
      w('KM_C', 'A2', 'P', 'N'),
    ],
  );
  assert.equal(isSeries(seriesC, 'SB2', 'KM_A'), true);
  assert.equal(isParallel(seriesC, 'SB2', 'KM_A'), false);
});

// ---- 11：互锁/反馈接错 → 振荡 ----
test('线圈经自身常闭触点供电：检测到振荡', () => {
  const c = circuit(
    [C.power1('P'), C.auxNC('KM_NC', 'g'), C.coil('KM_C', 'g')],
    [
      w('P', 'L', 'KM_NC', 'in'),
      w('KM_NC', 'out', 'KM_C', 'A1'),
      w('KM_C', 'A2', 'P', 'N'),
    ],
  );
  const r = simulate(c);
  assert.equal(r.stable, false);
  assert.equal(r.reason, 'oscillation');
});

// ---- 断路检查是结构性的：正常待机状态不误报 ----
test('开关断开只是灯灭，不报 open_circuit（接线本身正确）', () => {
  const c = circuit(
    [C.power1('P'), C.sw('SW', false), C.lamp('LP')],
    [w('P', 'L', 'SW', 'in'), w('SW', 'out', 'LP', 'L'), w('LP', 'N', 'P', 'N')],
  );
  const r = simulate(c);
  assert.equal(find(c, r, 'LP').working, false);
  assert.ok(!r.errors.some((e) => e.code === 'open_circuit'));
});

test('点动待机（未按启动）：线圈失电但不报 open_circuit', () => {
  const r = simulate(pointControl(false));
  assert.ok(!r.errors.some((e) => e.code === 'open_circuit'));
  assert.ok(!r.errors.some((e) => e.code === 'phase_loss'));
});

test('灯两端都接到火线：无论怎么操作都成不了回路 → open_circuit', () => {
  const c = circuit(
    [C.power1('P'), C.sw('SW', true), C.lamp('LP')],
    [
      w('P', 'L', 'SW', 'in'),
      w('SW', 'out', 'LP', 'L'),
      w('P', 'L', 'LP', 'N'), // 错：N 端也接回了火线
    ],
  );
  const r = simulate(c);
  assert.equal(find(c, r, 'LP').working, false);
  assert.ok(r.errors.some((e) => e.code === 'open_circuit' && e.componentId === 'LP'));
});

test('线圈 A2 没有回到零线：报线圈 open_circuit', () => {
  const c = circuit(
    [C.power1('P'), C.btnNO('SB2'), C.coil('KM_C', 'g'), C.sw('X')],
    [
      w('P', 'L', 'SB2', 'in'),
      w('SB2', 'out', 'KM_C', 'A1'),
      w('KM_C', 'A2', 'X', 'in'), // 错：A2 接到无处可去的开关上
    ],
  );
  const r = simulate(c);
  assert.ok(r.errors.some((e) => e.code === 'open_circuit' && e.componentId === 'KM_C'));
});

// ---- 三相电机缺相 / 重复相 ----
test('电机缺相：一相没接通 → phase_loss', () => {
  const c = pointControl(true);
  // 拔掉 P.L3 → KM_M.L3 这根线：L3 永远到不了电机 W
  c.wires = c.wires.filter(
    (x) => !(x.from.componentId === 'P' && x.from.terminal === 'L3'),
  );
  const r = simulate(c);
  assert.equal(find(c, r, 'M').working, false);
  assert.ok(r.errors.some((e) => e.code === 'phase_loss' && e.componentId === 'M'));
});

test('电机两个端子接到同一相 → phase_loss（相重复）', () => {
  const c = pointControl(true);
  // 把 KM_M.T3 → M.W 改成 KM_M.T2 → M.W：V、W 同接 L2
  c.wires = c.wires.filter(
    (x) => !(x.from.componentId === 'KM_M' && x.from.terminal === 'T3'),
  );
  c.wires.push(w('KM_M', 'T2', 'M', 'W'));
  const r = simulate(c);
  assert.equal(find(c, r, 'M').working, false);
  assert.ok(r.errors.some((e) => e.code === 'phase_loss' && e.componentId === 'M'));
});

// ---- 12：热继动作 → 电机停 ----
test('热继电器过载动作：控制回路断、电机停', () => {
  const build = (tripped: boolean): Circuit =>
    circuit(
      [
        C.power3('P'), C.sw('SW', true), C.thermalNC('FR', tripped),
        C.coil('KM_C', 'g'), C.main('KM_M', 'g'), C.motor('M'),
      ],
      [
        w('P', 'L1', 'SW', 'in'),
        w('SW', 'out', 'FR', 'in'),
        w('FR', 'out', 'KM_C', 'A1'),
        w('KM_C', 'A2', 'P', 'N'),
        w('P', 'L1', 'KM_M', 'L1'),
        w('P', 'L2', 'KM_M', 'L2'),
        w('P', 'L3', 'KM_M', 'L3'),
        w('KM_M', 'T1', 'M', 'U'),
        w('KM_M', 'T2', 'M', 'V'),
        w('KM_M', 'T3', 'M', 'W'),
      ],
    );

  const ok = build(false);
  let r = simulate(ok);
  assert.equal(find(ok, r, 'M').working, true);

  const tripped = build(true);
  r = simulate(tripped);
  assert.equal(find(tripped, r, 'M').working, false);
});
