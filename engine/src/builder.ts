// 测试用电路构造助手
import type { Circuit, Component, Wire } from './types.ts';

const term = (...ids: string[]) => ids.map((id) => ({ id }));

export const C = {
  power1: (id: string, on = true): Component => ({
    id, type: 'single_phase_power', terminals: term('L', 'N'), state: { on },
  }),
  power3: (id: string, on = true): Component => ({
    id, type: 'three_phase_power', terminals: term('L1', 'L2', 'L3', 'N', 'PE'), state: { on },
  }),
  sw: (id: string, closed = false): Component => ({
    id, type: 'switch', terminals: term('in', 'out'), state: { closed },
  }),
  btnNO: (id: string, pressed = false): Component => ({
    id, type: 'button_no', terminals: term('in', 'out'), state: { pressed },
  }),
  btnNC: (id: string, pressed = false): Component => ({
    id, type: 'button_nc', terminals: term('in', 'out'), state: { pressed },
  }),
  lamp: (id: string): Component => ({
    id, type: 'lamp', terminals: term('L', 'N'), state: {}, rules: { isLoad: true },
  }),
  coil: (id: string, groupId: string): Component => ({
    id, type: 'contactor_coil', groupId, terminals: term('A1', 'A2'), state: {}, rules: { isLoad: true },
  }),
  main: (id: string, groupId: string): Component => ({
    id, type: 'contactor_main', groupId,
    terminals: term('L1', 'T1', 'L2', 'T2', 'L3', 'T3'), state: {},
  }),
  auxNO: (id: string, groupId: string): Component => ({
    id, type: 'contactor_no', groupId, terminals: term('in', 'out'), state: {},
  }),
  auxNC: (id: string, groupId: string): Component => ({
    id, type: 'contactor_nc', groupId, terminals: term('in', 'out'), state: {},
  }),
  motor: (id: string): Component => ({
    id, type: 'motor', terminals: term('U', 'V', 'W'), state: {}, rules: { isLoad: true, motorMode: 'three_phase' },
  }),
  thermalNC: (id: string, tripped = false): Component => ({
    id, type: 'thermal_nc', terminals: term('in', 'out'), state: { tripped },
  }),
};

let wireSeq = 0;
export function w(from: string, fromT: string, to: string, toT: string): Wire {
  return {
    id: `w${++wireSeq}`,
    from: { componentId: from, terminal: fromT },
    to: { componentId: to, terminal: toT },
  };
}

export function circuit(components: Component[], wires: Wire[]): Circuit {
  return { schemaVersion: 1, components, wires };
}

export function get(c: Circuit, id: string): Component {
  const comp = c.components.find((x) => x.id === id);
  if (!comp) throw new Error(`no component ${id}`);
  return comp;
}

// 给元件打上练习模板里的角色标记
export function role(comp: Component, r: string): Component {
  comp.role = r;
  return comp;
}
