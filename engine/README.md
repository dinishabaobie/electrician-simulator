# 电工模拟器 · 模拟引擎骨架

实现《电路连通性判定规约》的第一版状态模拟引擎，零运行时依赖，用 Node 原生
TypeScript 支持 + 内置测试运行器（`node:test`）。

## 运行测试

需要 Node ≥ 22.6（本机已在 v26 验证通过）：

```bash
cd 电工模拟器-engine
npm test          # 等价于 node --test
```

## 目录

```
src/
  types.ts     数据模型（Circuit / Component / Wire / SimResult …）
  engine.ts    引擎：并查集建节点 → 导通边 → 带电/短路/三相判定 → 收敛循环 → 判错
  builder.ts   测试用电路构造助手（C.power3 / C.coil / w(...) …）
test/
  engine.test.ts  规约 §11 的 11 条最小验收用例
```

## 对外 API

```ts
import { simulate, checkTemplate, isParallel, isSeries } from './src/engine.ts';

const result = simulate(circuit);
// result.components[i] = { id, working?, closed?, energized?, faulted? }
// result.shorts        = 短路节点对
// result.errors        = 通用判错（悬空/断路/短路/无电源）
// result.stable/reason = 是否收敛；不稳定时 reason = 'oscillation' | 'max_iter'

// 练习模式语义判错：对照模板（元件类型、并联/串联拓扑、必要元件）
const semantic = checkTemplate(circuit, expectedTemplate);
// → wrong_type / missing_component / wrong_topology
```

元件用 `role` 字段标记其在练习里的角色（如 `'stop_button'`），模板用 `Expected`
声明每个角色应有的类型与拓扑约束。详见 `test/template.test.ts`。

## 与文档的对应

| 规约小节 | 代码位置 |
|---|---|
| §2.1 电气节点（并查集） | `engine.ts` `DSU` / `buildNodes` |
| §3 元件导通表 | `componentEdges` |
| §5.1 电源极 | `poles` |
| §5.2 单相负载工作 | `step` 中 reachHot/reachN + `isLoadWorking` |
| §5.3 短路 | `buildResult` 中 `adjNoLoad` 连通判定 |
| §5.4 三相电机 | `motorRuns`（相-端子匹配） |
| §6 收敛/防振荡 | `simulate` 主循环（指纹 + seen 集 + MAX_ITER） |
| §8 通用检查 | `checkGeneral` |
| §8 并联/串联语义 | `isParallel` / `isSeries` |
| §8 模板对照判错 | `checkTemplate` + `Expected` 类型 |

## 尚未实现（留给后续）

- 熔断器/热继的自动动作（第一版按手动故障态处理）。
- 单相简化电机的完整建模（已留 `motorMode: 'simplified'` 分支）。
- 电流路径高亮所需的“逐负载回路”导出（现仅给整体带电节点集）。
