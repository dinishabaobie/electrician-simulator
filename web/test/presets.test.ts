// 三个练习：标准答案接线在待机/操作各状态下不应误报；预设端子名与 DEFS 一致
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, checkTemplate } from '../../engine/src/engine.ts';
import type { Circuit, Component } from '../../engine/src/types.ts';
import { PRACTICES, type Practice } from '../src/presets.ts';
import { DEFS, defaultState } from '../src/componentDefs.ts';

type StateById = Record<string, Record<string, unknown>>;

// 等价于 App.buildCircuit：预设元件 + 标准答案接线 + 可覆盖的运行状态
function buildCircuit(p: Practice, stateById: StateById): Circuit {
  const components: Component[] = p.items.map((it) => {
    const def = DEFS[it.type];
    assert.ok(def, `练习 ${p.key}: 未知元件类型 ${it.type}`);
    return {
      id: it.id,
      type: def.type, // 外观键（如 fan）映射到引擎类型
      groupId: it.groupId,
      role: it.role,
      terminals: def.terminals.map((t) => ({ id: t.id })),
      state: { ...(stateById[it.id] ?? defaultState(it.type)) },
      rules: (def.rules as Component['rules']) ?? (def.isLoad ? { isLoad: true } : undefined),
    };
  });
  const termsOf = new Map(
    p.items.map((it) => [it.id, new Set(DEFS[it.type].terminals.map((t) => t.id))]),
  );
  const wires = (p.wires ?? []).map((w, i) => {
    for (const [cid, t] of [w.from, w.to]) {
      assert.ok(termsOf.get(cid)?.has(t), `练习 ${p.key}: 接线引用了 ${cid} 不存在的端子 ${t}`);
    }
    return {
      id: `w${i}`,
      from: { componentId: w.from[0], terminal: w.from[1] },
      to: { componentId: w.to[0], terminal: w.to[1] },
    };
  });
  return { schemaVersion: 1, components, wires };
}

const noErrors = (r: ReturnType<typeof simulate>, label: string) => {
  assert.equal(
    r.errors.length,
    0,
    `${label} 不应有报错，实际：${r.errors.map((e) => `${e.code} ${e.message}`).join(' | ')}`,
  );
};

for (const p of PRACTICES) {
  test(`练习「${p.name}」：答案接线待机无误报，模板检查通过`, () => {
    const r = simulate(buildCircuit(p, {}));
    assert.equal(r.stable, true);
    assert.equal(r.shorts.length, 0);
    noErrors(r, '待机');
    if (p.template) {
      assert.equal(checkTemplate(buildCircuit(p, {}), p.template).length, 0);
    }
  });
}

test('练习「单灯单控」：合开关灯亮且无报错', () => {
  const p = PRACTICES.find((x) => x.key === 'single_light')!;
  const r = simulate(buildCircuit(p, { SW: { closed: true } }));
  assert.equal(r.components.find((c) => c.id === 'LP')?.working, true);
  noErrors(r, '灯亮时');
});

test('练习「自锁+热保护」：自锁保持 → 过载动作停机 → 复位后不自启', () => {
  const p = PRACTICES.find((x) => x.key === 'self_lock_overload')!;
  const motorOn = (rr: ReturnType<typeof simulate>) =>
    rr.components.find((c) => c.id === 'M')?.working;
  const coilOn = (rr: ReturnType<typeof simulate>) =>
    rr.components.find((c) => c.id === 'KM_C')?.energized;

  // 按启动 → 运行
  const states: StateById = { SB2: { pressed: true } };
  let r = simulate(buildCircuit(p, states));
  assert.equal(motorOn(r), true, '按启动应运行');
  noErrors(r, '运行中');

  // 松开 → 自锁保持
  states.KM_C = { energized: !!coilOn(r) };
  states.SB2 = { pressed: false };
  r = simulate(buildCircuit(p, states));
  assert.equal(motorOn(r), true, '松开后应自锁保持');
  noErrors(r, '自锁保持');

  // 过载动作：热元件与常闭触点联动 tripped（App 里点击 FR 同组一起动作）
  states.KM_C = { energized: !!coilOn(r) };
  states.FR_M = { tripped: true };
  states.FR_NC = { tripped: true };
  r = simulate(buildCircuit(p, states));
  assert.equal(motorOn(r), false, '过载动作后电机应停');
  assert.equal(coilOn(r), false, '过载动作后线圈应失电');

  // 复位：故障清除，但自锁已丢失，须重新按启动
  states.KM_C = { energized: !!coilOn(r) };
  states.FR_M = { tripped: false };
  states.FR_NC = { tripped: false };
  r = simulate(buildCircuit(p, states));
  assert.equal(motorOn(r), false, '复位后不应自行重启');
  noErrors(r, '复位待机');
});

test('练习「两台电机顺序启动」：顺序联锁、SB22 单停 M2、SB12 级联全停、FR 过载全停', () => {
  const p = PRACTICES.find((x) => x.key === 'seq_start')!;
  const on = (rr: ReturnType<typeof simulate>, id: string) =>
    rr.components.find((c) => c.id === id)?.working;
  const energized = (rr: ReturnType<typeof simulate>, id: string) =>
    !!rr.components.find((c) => c.id === id)?.energized;
  // 每步之间把两个线圈的 energized 写回（等价于 App.recompute 的持久化）
  const persist = (states: StateById, rr: ReturnType<typeof simulate>) => {
    states.KM1_C = { energized: energized(rr, 'KM1_C') };
    states.KM2_C = { energized: energized(rr, 'KM2_C') };
  };
  const run = (states: StateById) => simulate(buildCircuit(p, states));

  // 直接按 SB21：KM1 顺序触点未闭合，M2 启动不了
  const states: StateById = { SB21: { pressed: true } };
  let r = run(states);
  assert.equal(on(r, 'M2'), false, 'M1 未启动时 M2 不应能启动');
  assert.equal(on(r, 'M1'), false);
  noErrors(r, '顺序保护生效时');

  // SB11 启动 M1 → 松开自锁
  persist(states, r);
  states.SB21 = { pressed: false };
  states.SB11 = { pressed: true };
  r = run(states);
  assert.equal(on(r, 'M1'), true, '按 SB11 后 M1 应运行');
  persist(states, r);
  states.SB11 = { pressed: false };
  r = run(states);
  assert.equal(on(r, 'M1'), true, '松开后 M1 自锁保持');
  assert.equal(on(r, 'M2'), false);

  // SB21 启动 M2 → 松开自锁，两台同转
  persist(states, r);
  states.SB21 = { pressed: true };
  r = run(states);
  assert.equal(on(r, 'M2'), true, 'M1 运行后 M2 应能启动');
  persist(states, r);
  states.SB21 = { pressed: false };
  r = run(states);
  assert.equal(on(r, 'M1'), true);
  assert.equal(on(r, 'M2'), true, '松开后 M2 自锁保持');
  noErrors(r, '两台同转');

  // SB22：只停 M2，M1 不受影响
  persist(states, r);
  states.SB22 = { pressed: true };
  r = run(states);
  assert.equal(on(r, 'M2'), false, 'SB22 应单独停 M2');
  assert.equal(on(r, 'M1'), true, 'SB22 不应影响 M1');
  persist(states, r);
  states.SB22 = { pressed: false };
  r = run(states);
  assert.equal(on(r, 'M2'), false, '松开 SB22 后 M2 不应自启');

  // 重启 M2，再按 SB12：KM1 断 → 顺序触点断 → KM2 级联跟停
  persist(states, r);
  states.SB21 = { pressed: true };
  r = run(states);
  assert.equal(on(r, 'M2'), true);
  persist(states, r);
  states.SB21 = { pressed: false };
  states.SB12 = { pressed: true };
  r = run(states);
  assert.equal(on(r, 'M1'), false, 'SB12 后 M1 应停');
  assert.equal(on(r, 'M2'), false, 'KM1 断开后 M2 应级联跟停');
  persist(states, r);
  states.SB12 = { pressed: false };
  r = run(states);
  assert.equal(on(r, 'M1'), false);
  assert.equal(on(r, 'M2'), false);

  // FR1 过载动作（常闭在控制总线上）：两台全停
  persist(states, r);
  states.SB11 = { pressed: true };
  r = run(states);
  persist(states, r);
  states.SB11 = { pressed: false };
  states.SB21 = { pressed: true };
  r = run(states);
  persist(states, r);
  states.SB21 = { pressed: false };
  r = run(states);
  assert.equal(on(r, 'M1'), true);
  assert.equal(on(r, 'M2'), true);
  persist(states, r);
  states.FR1_NC = { tripped: true };
  states.FR1_M = { tripped: true };
  r = run(states);
  assert.equal(on(r, 'M1'), false, 'FR1 过载后 M1 应停');
  assert.equal(on(r, 'M2'), false, 'FR1 在控制总线上，M2 也应全停');
});

test('练习「接触器互锁」：一挡吸合另一挡进不来；换挡先退再进；冷态同合报失稳', () => {
  const p = PRACTICES.find((x) => x.key === 'interlock')!;
  const energized = (rr: ReturnType<typeof simulate>, id: string) =>
    !!rr.components.find((c) => c.id === id)?.energized;
  const persist = (states: StateById, rr: ReturnType<typeof simulate>) => {
    states.KM2_C = { energized: energized(rr, 'KM2_C') };
    states.KM3_C = { energized: energized(rr, 'KM3_C') };
  };

  // 合 SA2·1 → KM2 吸合
  const states: StateById = { SA2_1: { closed: true } };
  let r = simulate(buildCircuit(p, states));
  assert.equal(energized(r, 'KM2_C'), true);
  assert.equal(energized(r, 'KM3_C'), false);
  noErrors(r, 'KM2 挡');

  // KM2 已吸合时再合 SA2·2 → 被 KM2 常闭挡住，KM3 进不来，状态稳定
  persist(states, r);
  states.SA2_2 = { closed: true };
  r = simulate(buildCircuit(p, states));
  assert.equal(r.stable, true, '一挡在位时另一挡应被互锁挡住而非振荡');
  assert.equal(energized(r, 'KM2_C'), true);
  assert.equal(energized(r, 'KM3_C'), false, '互锁应阻止 KM3 吸合');

  // 退出 KM2 挡（开 SA2·1）→ KM3 挡进来
  persist(states, r);
  states.SA2_1 = { closed: false };
  r = simulate(buildCircuit(p, states));
  assert.equal(r.stable, true);
  assert.equal(energized(r, 'KM2_C'), false);
  assert.equal(energized(r, 'KM3_C'), true, '换挡后 KM3 应吸合');

  // 冷态（都未吸合）同时合两挡 → 两线圈互相抢，状态无法稳定
  const cold: StateById = { SA2_1: { closed: true }, SA2_2: { closed: true } };
  r = simulate(buildCircuit(p, cold));
  assert.equal(r.stable, false, '冷态同合两挡应报失稳（实物是联动手柄，不会发生）');
});

test('练习「牵引机控制回路」：延时→启动自锁+风机→选挡互锁→电机转→停机', () => {
  const p = PRACTICES.find((x) => x.key === 'traction')!;
  const on = (rr: ReturnType<typeof simulate>, id: string) =>
    rr.components.find((c) => c.id === id)?.working;
  const energized = (rr: ReturnType<typeof simulate>, id: string) =>
    !!rr.components.find((c) => c.id === id)?.energized;
  const persist = (states: StateById, rr: ReturnType<typeof simulate>) => {
    states.KM1_C = { energized: energized(rr, 'KM1_C') };
    states.KM2_C = { energized: energized(rr, 'KM2_C') };
    states.KM3_C = { energized: energized(rr, 'KM3_C') };
  };

  // 上电待机：指示灯亮，其余不动
  const states: StateById = {};
  let r = simulate(buildCircuit(p, states));
  assert.equal(on(r, 'HL1'), true, '电源指示灯应亮');
  assert.equal(on(r, 'M'), false);
  noErrors(r, '待机');

  // KT1 未合（延时没到）时按 SB1：KM1 不吸合
  states.SB1 = { pressed: true };
  r = simulate(buildCircuit(p, states));
  assert.equal(energized(r, 'KM1_C'), false, '延时未到不应能启动');

  // 合 KT1 → 按 SB1 → KM1 吸合、风机转；松开自锁
  states.KT1 = { closed: true };
  r = simulate(buildCircuit(p, states));
  assert.equal(energized(r, 'KM1_C'), true);
  assert.equal(on(r, 'MF1'), true, '风机应随 KM1 支路得电运转');
  persist(states, r);
  states.SB1 = { pressed: false };
  r = simulate(buildCircuit(p, states));
  assert.equal(energized(r, 'KM1_C'), true, '松开后自锁保持');
  assert.equal(on(r, 'M'), false, '未选挡时牵引电机不应转');

  // 选 KM2 挡 → 电机转；再合另一挡被互锁挡住
  persist(states, r);
  states.SA2_1 = { closed: true };
  r = simulate(buildCircuit(p, states));
  assert.equal(energized(r, 'KM2_C'), true);
  assert.equal(on(r, 'M'), true, 'KM1+KM2 都吸合，电机应转');
  noErrors(r, '运行中');
  persist(states, r);
  states.SA2_2 = { closed: true };
  r = simulate(buildCircuit(p, states));
  assert.equal(r.stable, true);
  assert.equal(energized(r, 'KM3_C'), false, '互锁应阻止 KM3');
  assert.equal(on(r, 'M'), true);

  // 按 SB2 停机：KM1 断 → 电机停、风机停（选挡支路独立，KM2 仍吸合）
  persist(states, r);
  states.SB2 = { pressed: true };
  r = simulate(buildCircuit(p, states));
  assert.equal(energized(r, 'KM1_C'), false);
  assert.equal(on(r, 'M'), false, 'KM1 断开后电机应停');
  assert.equal(on(r, 'MF1'), false, '风机应随停');
  assert.equal(energized(r, 'KM2_C'), true, '选挡支路独立于 KM1（与原图一致）');
});

for (const key of ['point_control', 'self_lock'] as const) {
  test(`练习「${key}」：按启动电机转，松开${key === 'self_lock' ? '保持（自锁）' : '即停（点动）'}，全程无误报`, () => {
    const p = PRACTICES.find((x) => x.key === key)!;
    const states: StateById = { SB2: { pressed: true } };
    let r = simulate(buildCircuit(p, states));
    const motorOn = (rr: typeof r) => rr.components.find((c) => c.id === 'M')?.working;
    assert.equal(motorOn(r), true, '按启动应运行');
    noErrors(r, '运行中');

    // 松开启动：把 energized 写回（等价于 App.recompute 的持久化）
    states.KM_C = { energized: !!r.components.find((c) => c.id === 'KM_C')?.energized };
    states.SB2 = { pressed: false };
    r = simulate(buildCircuit(p, states));
    assert.equal(motorOn(r), key === 'self_lock');
    noErrors(r, '松开后');
  });
}
