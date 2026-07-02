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
      type: it.type as Component['type'],
      groupId: it.groupId,
      role: it.role,
      terminals: def.terminals.map((t) => ({ id: t.id })),
      state: { ...(stateById[it.id] ?? defaultState(it.type)) },
      rules: def.isLoad ? { isLoad: true } : undefined,
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
