// 正交绕障布线的回归测试：对三个练习的标准答案接线逐条验证
// 1) 每根线都能布通  2) 路径全正交  3) 端点精确落在端子上
// 4) 不穿过其他元件  5) 端子已对齐的线走直线
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Position } from '@xyflow/react';
import { routeAll, type Port, type RouteReq, type Rect, type Pt } from '../src/routing.ts';
import { PRACTICES, type Practice } from '../src/presets.ts';
import { DEFS } from '../src/componentDefs.ts';

function portOf(p: Practice, id: string, handle: string): Port {
  const it = p.items.find((x) => x.id === id)!;
  const def = DEFS[it.type];
  const t = def.terminals.find((tt) => tt.id === handle);
  assert.ok(t, `${p.key}: ${id} 没有端子 ${handle}`);
  const pct = parseFloat((t.style.top ?? t.style.left) as string) / 100;
  switch (t.position) {
    case Position.Left: return { x: it.x, y: it.y + def.h * pct, side: 'left' };
    case Position.Right: return { x: it.x + def.w, y: it.y + def.h * pct, side: 'right' };
    case Position.Top: return { x: it.x + def.w * pct, y: it.y, side: 'top' };
    default: return { x: it.x + def.w * pct, y: it.y + def.h, side: 'bottom' };
  }
}

function build(p: Practice): { reqs: RouteReq[]; obstacles: Rect[]; owners: Map<string, [string, string]> } {
  const obstacles = p.items.map((it) => {
    const def = DEFS[it.type];
    return { x: it.x, y: it.y, w: def.w, h: def.h, id: it.id };
  });
  const owners = new Map<string, [string, string]>();
  const reqs = (p.wires ?? []).map((w, i) => {
    const id = `w${i}`;
    owners.set(id, [w.from[0], w.to[0]]);
    return { id, from: portOf(p, w.from[0], w.from[1]), to: portOf(p, w.to[0], w.to[1]) };
  });
  return { reqs, obstacles, owners };
}

// 正交线段是否穿过矩形内部（矩形已外扩 margin）。按主轴分类：
// 端子百分比定位有亚像素错位，段可能带 <1px 的斜率
function segHitsRect(a: Pt, b: Pt, r: Rect, margin: number): boolean {
  const x0 = r.x - margin, x1 = r.x + r.w + margin;
  const y0 = r.y - margin, y1 = r.y + r.h + margin;
  if (Math.abs(a.x - b.x) >= Math.abs(a.y - b.y)) {
    return a.y > y0 && a.y < y1 && Math.max(a.x, b.x) > x0 && Math.min(a.x, b.x) < x1;
  }
  return a.x > x0 && a.x < x1 && Math.max(a.y, b.y) > y0 && Math.min(a.y, b.y) < y1;
}

for (const p of PRACTICES) {
  test(`布线「${p.name}」：全部布通、正交、贴端子、不穿元件`, () => {
    const { reqs, obstacles, owners } = build(p);
    const routes = routeAll(reqs, obstacles);
    for (const q of reqs) {
      const rt = routes.get(q.id);
      assert.ok(rt, `${q.id} 未布通`);
      const pts = rt.points;
      // 端点精确落在端子上
      assert.deepEqual({ x: pts[0].x, y: pts[0].y }, { x: q.from.x, y: q.from.y });
      assert.deepEqual({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y }, { x: q.to.x, y: q.to.y });
      const [srcNode, tgtNode] = owners.get(q.id)!;
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k];
        // 正交：每段要么水平要么垂直（容忍端子亚像素错位带来的 <0.6px 偏差）
        assert.ok(
          Math.abs(a.x - b.x) < 0.6 || Math.abs(a.y - b.y) < 0.6,
          `${q.id} 第 ${k} 段不是正交线：(${a.x},${a.y})→(${b.x},${b.y})`,
        );
        // 不穿过其他元件（自己两端的元件除外，端子引出段必然贴近）
        for (const r of obstacles) {
          const rid = (r as Rect & { id: string }).id;
          if (rid === srcNode || rid === tgtNode) continue;
          assert.ok(!segHitsRect(a, b, r, 4), `${q.id} 第 ${k} 段穿过了元件 ${rid}`);
        }
      }
    }
  });
}

test('布线「单灯单控」：端子同行的线走直线（无多余弯）', () => {
  const p = PRACTICES.find((x) => x.key === 'single_light')!;
  const { reqs, obstacles } = build(p);
  const routes = routeAll(reqs, obstacles);
  // w0: PWR.L → SW.in，两端子已对齐同一行
  const pts = routes.get('w0')!.points;
  const ys = pts.map((q) => q.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) < 1, `应近似水平直线，实际 y 跨度 ${Math.max(...ys) - Math.min(...ys)}`);
});
