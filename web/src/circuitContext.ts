import { createContext } from 'react';

export interface CircuitActions {
  toggle: (id: string) => void;         // 开关：合/断
  press: (id: string, down: boolean) => void; // 按钮：按住/松开
}

export const CircuitCtx = createContext<CircuitActions>({
  toggle: () => {},
  press: () => {},
});
