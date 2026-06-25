// 练习模式语义判错（对照模板）测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTemplate } from '../src/engine.ts';
import { C, w, circuit, role } from '../src/builder.ts';
import type { Circuit, Component, ComponentType, Expected } from '../src/types.ts';

// 接触器自锁练习的预期结构
const selfLockTemplate: Expected = {
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
};

// 构造自锁电路，可选：停止按钮类型、是否带自锁触点、自锁触点是否并联
function build(opts: {
  stopType?: ComponentType;
  withAux?: boolean;
  auxSeries?: boolean;
}): Circuit {
  const stop =
    opts.stopType === 'button_no'
      ? role(C.btnNO('SB1'), 'stop_button')
      : role(C.btnNC('SB1'), 'stop_button');

  const comps: Component[] = [
    C.power3('P'),
    stop,
    role(C.btnNO('SB2'), 'start_button'),
    role(C.coil('KM_C', 'g'), 'coil'),
    role(C.main('KM_M', 'g'), 'main'),
    role(C.motor('M'), 'motor'),
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

  if (opts.withAux) {
    comps.push(role(C.auxNO('KM_A', 'g'), 'aux_no'));
    if (opts.auxSeries) {
      // 串联：SB2 → aux → 线圈
      wires.push(w('SB2', 'out', 'KM_A', 'in'));
      wires.push(w('KM_A', 'out', 'KM_C', 'A1'));
    } else {
      // 并联：aux 与 SB2 两端分别同节点
      wires.push(w('SB1', 'out', 'KM_A', 'in'));
      wires.push(w('KM_A', 'out', 'KM_C', 'A1'));
    }
  }
  return circuit(comps, wires);
}

test('模板对照：完全正确的自锁电路无语义错误', () => {
  const c = build({ withAux: true });
  const errors = checkTemplate(c, selfLockTemplate);
  assert.deepEqual(errors, []);
});

test('模板对照：停止按钮接成常开 → wrong_type', () => {
  const c = build({ stopType: 'button_no', withAux: true });
  const errors = checkTemplate(c, selfLockTemplate);
  const e = errors.find((x) => x.code === 'wrong_type' && x.componentId === 'SB1');
  assert.ok(e, '应报停止按钮类型错误');
  assert.match(e!.message, /常闭/);
});

test('模板对照：缺少自锁触点 → missing_component', () => {
  const c = build({ withAux: false });
  const errors = checkTemplate(c, selfLockTemplate);
  assert.ok(errors.some((x) => x.code === 'missing_component' && /aux_no/.test(x.message)));
});

test('模板对照：自锁触点接成串联 → wrong_topology', () => {
  const c = build({ withAux: true, auxSeries: true });
  const errors = checkTemplate(c, selfLockTemplate);
  const e = errors.find((x) => x.code === 'wrong_topology');
  assert.ok(e, '应报拓扑错误');
  assert.match(e!.message, /并联/);
});
