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

// ---- §5.2 剔除自身边：多线圈共零线排不互相“倒灌” ----
test('两个线圈共零线排：只有回路接通的线圈得电，另一个不被倒灌误判', () => {
  // KM1 支路：L → SW(合) → KM1 线圈 → N
  // KM2 支路：L → SB(常开未按) → KM2 线圈 → N（A2 与 KM1 共零线排）
  const c = circuit(
    [
      C.power1('P'), C.sw('SW', true), C.btnNO('SB'),
      C.coil('KM1_C', 'g1'), C.coil('KM2_C', 'g2'),
    ],
    [
      w('P', 'L', 'SW', 'in'),
      w('SW', 'out', 'KM1_C', 'A1'),
      w('KM1_C', 'A2', 'P', 'N'),
      w('P', 'L', 'SB', 'in'),
      w('SB', 'out', 'KM2_C', 'A1'),
      w('KM2_C', 'A2', 'P', 'N'),
    ],
  );
  const r = simulate(c);
  assert.equal(find(c, r, 'KM1_C').energized, true);
  assert.equal(find(c, r, 'KM2_C').energized, false, 'KM2 断着不应经零线排倒灌得电');
  assert.equal(r.errors.length, 0);
});

// ---- §5.2 Menger：经空开隔出的零线母线不被倒灌 ----
test('零线经空开隔离后，断电支路的负载不被经母线倒灌误判', () => {
  // L → SW1(合) → 灯A → 母线；L → SW2(断) → 灯B → 母线；母线 → 开关(合，模拟空开零线极) → N
  // 灯A 正常工作；灯B 上游断开，不应因“火线经灯A到母线再折返”而误判点亮
  const c = circuit(
    [
      C.power1('P'), C.sw('SW1', true), C.sw('SW2', false), C.sw('QFN', true),
      C.lamp('LA'), C.lamp('LB'),
    ],
    [
      w('P', 'L', 'SW1', 'in'),
      w('SW1', 'out', 'LA', 'L'),
      w('P', 'L', 'SW2', 'in'),
      w('SW2', 'out', 'LB', 'L'),
      w('LA', 'N', 'QFN', 'in'),   // 母线 = LA.N / LB.N / QFN.in
      w('LB', 'N', 'QFN', 'in'),
      w('QFN', 'out', 'P', 'N'),
    ],
  );
  const r = simulate(c);
  assert.equal(find(c, r, 'LA').working, true);
  assert.equal(find(c, r, 'LB').working, false, '断电支路的灯不应经零线母线倒灌点亮');
  assert.equal(r.errors.length, 0);
});

// ---- 三相空开：合闸三极通、分闸断 ----
test('三相空开：合闸电机可转，分闸三相全断', () => {
  const build = (closed: boolean): Circuit =>
    circuit(
      [C.power3('P'), C.breaker3('QF', closed), C.main('KM', 'g'), C.coil('KM_C', 'g'), C.sw('SW', true), C.motor('M')],
      [
        w('P', 'L1', 'QF', 'in_L1'),
        w('P', 'L2', 'QF', 'in_L2'),
        w('P', 'L3', 'QF', 'in_L3'),
        w('QF', 'out_L1', 'SW', 'in'),
        w('SW', 'out', 'KM_C', 'A1'),
        w('KM_C', 'A2', 'P', 'N'),
        w('QF', 'out_L1', 'KM', 'L1'),
        w('QF', 'out_L2', 'KM', 'L2'),
        w('QF', 'out_L3', 'KM', 'L3'),
        w('KM', 'T1', 'M', 'U'),
        w('KM', 'T2', 'M', 'V'),
        w('KM', 'T3', 'M', 'W'),
      ],
    );
  let c = build(true);
  let r = simulate(c);
  assert.equal(find(c, r, 'M').working, true);
  c = build(false);
  r = simulate(c);
  assert.equal(find(c, r, 'M').working, false);
  assert.equal(r.errors.length, 0, '分闸是正常操作态，不应报结构性断路');
});

// ---- §5.2 极点吸收：断电支路挂在零线排上的负载岛不被“倒灌” ----
test('负载岛：节点只经多个负载连到零线排，负载不应误判工作', () => {
  // 工作支路：L → SW(合) → 灯 HL → N
  // 负载岛：节点 X 只通过 线圈C 和 灯 LP2 连到零线排（上游开关断开）
  const c = circuit(
    [
      C.power1('P'), C.sw('SW', true), C.lamp('HL'),
      C.sw('S2', false), C.coil('C', 'g'), C.lamp('LP2'),
    ],
    [
      w('P', 'L', 'SW', 'in'),
      w('SW', 'out', 'HL', 'L'),
      w('HL', 'N', 'P', 'N'),
      w('P', 'L', 'S2', 'in'),
      w('S2', 'out', 'C', 'A1'),     // X = S2.out / C.A1 / LP2.L
      w('S2', 'out', 'LP2', 'L'),
      w('C', 'A2', 'P', 'N'),
      w('LP2', 'N', 'P', 'N'),
    ],
  );
  const r = simulate(c);
  assert.equal(find(c, r, 'HL').working, true, '正常支路的灯应亮');
  assert.equal(find(c, r, 'LP2').working, false, '断电岛上的灯不应经零线排倒灌点亮');
  assert.equal(find(c, r, 'C').energized, false, '断电岛上的线圈不应得电');
  assert.equal(r.errors.length, 0, 'S2 合上就能成回路，不应报结构性断路');
});

// ---- 13：热继三相热元件（主回路串联）----
test('热继热元件：正常导通电机转，过载动作三相一起断、电机停', () => {
  const build = (tripped: boolean): Circuit =>
    circuit(
      [
        C.power3('P'), C.sw('SW', true), C.coil('KM_C', 'g'),
        C.main('KM_M', 'g'), C.thermalMain('FR_M', tripped), C.motor('M'),
      ],
      [
        w('P', 'L1', 'SW', 'in'),
        w('SW', 'out', 'KM_C', 'A1'),
        w('KM_C', 'A2', 'P', 'N'),
        w('P', 'L1', 'KM_M', 'L1'),
        w('P', 'L2', 'KM_M', 'L2'),
        w('P', 'L3', 'KM_M', 'L3'),
        w('KM_M', 'T1', 'FR_M', 'L1'),
        w('KM_M', 'T2', 'FR_M', 'L2'),
        w('KM_M', 'T3', 'FR_M', 'L3'),
        w('FR_M', 'T1', 'M', 'U'),
        w('FR_M', 'T2', 'M', 'V'),
        w('FR_M', 'T3', 'M', 'W'),
      ],
    );

  const ok = build(false);
  let r = simulate(ok);
  assert.equal(find(ok, r, 'M').working, true);
  assert.equal(r.errors.length, 0);

  // 过载动作：三相断开，电机停；故障态不参与结构性放宽，断路会被上报（§7/§8）
  const tripped = build(true);
  r = simulate(tripped);
  assert.equal(find(tripped, r, 'M').working, false);
  assert.equal(find(tripped, r, 'FR_M').faulted, true);
});

// ============================================================================
// §12 电压模型（v2）
// ============================================================================

// 变压器抽头 → 整流 → 直流电机：抽头电压不同，转速与表读数不同
function tractionMain(tap: 'A' | 'B' | 'none'): Circuit {
  const comps = [
    C.power3('P'),
    C.sw('KA', tap === 'A'), C.sw('KA2', tap === 'A'), C.sw('KA3', tap === 'A'),
    C.sw('KB', tap === 'B'), C.sw('KB2', tap === 'B'), C.sw('KB3', tap === 'B'),
    C.transformer3('T1', [60, 45, 30]),
    C.rectifier3('RECT'),
    C.ammeter('PA1'),
    C.voltmeter('PV1'),
    C.dcMotor('M', 81),
  ];
  const wires = [
    // 三相 → 变压器一次侧
    w('P', 'L1', 'T1', 'L1'),
    w('P', 'L2', 'T1', 'L2'),
    w('P', 'L3', 'T1', 'L3'),
    // 抽头 A（60V）经三个开关 → 整流器
    w('T1', 'R1', 'KA', 'in'), w('KA', 'out', 'RECT', 'L1'),
    w('T1', 'S1', 'KA2', 'in'), w('KA2', 'out', 'RECT', 'L2'),
    w('T1', 'T1', 'KA3', 'in'), w('KA3', 'out', 'RECT', 'L3'),
    // 抽头 C（30V）经三个开关（45V 备用抽头空置） → 整流器
    w('T1', 'R3', 'KB', 'in'), w('KB', 'out', 'RECT', 'L1'),
    w('T1', 'S3', 'KB2', 'in'), w('KB2', 'out', 'RECT', 'L2'),
    w('T1', 'T3', 'KB3', 'in'), w('KB3', 'out', 'RECT', 'L3'),
    // 直流侧：DC+ → 电流表 → 电机；电压表跨接
    w('RECT', 'DC+', 'PA1', 'in'),
    w('PA1', 'out', 'M', 'DC+'),
    w('RECT', 'DC-', 'M', 'DC-'),
    w('PV1', 'in', 'PA1', 'out'),
    w('PV1', 'out', 'M', 'DC-'),
  ];
  return circuit(comps, wires);
}

test('电压模型：60V 抽头 → 直流 81V，电机满速，表计有读数', () => {
  const c = tractionMain('A');
  const r = simulate(c);
  const m = find(c, r, 'M');
  assert.equal(m.working, true, '直流电机应运行');
  assert.ok(Math.abs((m.volts ?? 0) - 81) < 2, `电机电压应≈81V，实际 ${m.volts}`);
  assert.equal(m.speedPct, 100, '60V 挡应满速');
  const pv = find(c, r, 'PV1');
  assert.ok(Math.abs((pv.volts ?? 0) - 81) < 2, `电压表应≈81V，实际 ${pv.volts}`);
  const pa = find(c, r, 'PA1');
  assert.ok((pa.amps ?? 0) > 4, `电流表应有明显读数，实际 ${pa.amps}`);
});

test('电压模型：30V 抽头 → 直流 40.5V，转速降半', () => {
  const c = tractionMain('B');
  const r = simulate(c);
  const m = find(c, r, 'M');
  assert.equal(m.working, true);
  assert.ok(Math.abs((m.volts ?? 0) - 40.5) < 2, `电机电压应≈40.5V，实际 ${m.volts}`);
  assert.ok(Math.abs((m.speedPct ?? 0) - 50) <= 2, `转速应≈50%，实际 ${m.speedPct}`);
});

test('电压模型：未选挡时整流器无供电，直流电机不转、电压表读 0', () => {
  const c = tractionMain('none');
  const r = simulate(c);
  assert.equal(find(c, r, 'M').working, false);
  assert.ok((find(c, r, 'PV1').volts ?? 0) < 1);
});

test('电压模型：两只灯串联分压，各≈110V 且都亮', () => {
  const c = circuit(
    [C.power1('P'), C.sw('SW', true), C.lamp('L1'), C.lamp('L2')],
    [
      w('P', 'L', 'SW', 'in'),
      w('SW', 'out', 'L1', 'L'),
      w('L1', 'N', 'L2', 'L'),
      w('L2', 'N', 'P', 'N'),
    ],
  );
  const r = simulate(c);
  assert.equal(find(c, r, 'L1').working, true);
  assert.equal(find(c, r, 'L2').working, true);
  assert.ok(Math.abs((find(c, r, 'L1').volts ?? 0) - 110) < 3, `串联分压应≈110V，实际 ${find(c, r, 'L1').volts}`);
});

test('电压模型：单灯直挂 L-N 读 220V', () => {
  const c = circuit(
    [C.power1('P'), C.sw('SW', true), C.lamp('LP')],
    [w('P', 'L', 'SW', 'in'), w('SW', 'out', 'LP', 'L'), w('LP', 'N', 'P', 'N')],
  );
  const r = simulate(c);
  assert.ok(Math.abs((find(c, r, 'LP').volts ?? 0) - 220) < 2);
});

// ---- §13 时间继电器（稳态部分：得电判定 + 延时触点状态驱动）----
test('时间继电器：本体得电；延时触点未到点不通、到点导通', () => {
  const build = (timedOut: boolean): Circuit => {
    const kt: Circuit['components'][number] = {
      id: 'KT1_B', type: 'timer_coil', terminals: [{ id: '7' }, { id: '8' }], state: {},
    };
    const ktNo: Circuit['components'][number] = {
      id: 'KT1', type: 'timer_no', terminals: [{ id: 'in' }, { id: 'out' }],
      state: { closed: timedOut }, groupId: 'KT1',
    };
    return circuit(
      [C.power1('P'), C.sw('QF', true), kt, ktNo, C.lamp('LP')],
      [
        w('P', 'L', 'QF', 'in'),
        w('QF', 'out', 'KT1_B', '7'),
        w('KT1_B', '8', 'P', 'N'),
        w('QF', 'out', 'KT1', 'in'),
        w('KT1', 'out', 'LP', 'L'),
        w('LP', 'N', 'P', 'N'),
      ],
    );
  };
  // 未到点：本体得电（开始计时的条件），灯不亮
  let c = build(false);
  let r = simulate(c);
  assert.equal(find(c, r, 'KT1_B').energized, true, 'ZN96 本体应得电');
  assert.equal(find(c, r, 'LP').working, false, '延时未到灯不应亮');
  assert.equal(r.errors.length, 0, '待机不应误报');
  // 到点：触点闭合，灯亮
  c = build(true);
  r = simulate(c);
  assert.equal(find(c, r, 'KT1').closed, true);
  assert.equal(find(c, r, 'LP').working, true, '延时到灯应亮');
});
