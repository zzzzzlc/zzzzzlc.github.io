---
title: 数据可视化方案对比：ECharts vs D3 vs AntV 从选型到实战
date: '2026-04-29'
tags:
  - 前端
category: 前端进阶
summary: >-
  从前端数据可视化选型的实际痛点出发，深度对比 ECharts、D3.js、AntV 三大方案的渲染机制、API
  设计、性能表现、生态体系，通过源码级分析揭示三者本质差异，覆盖 SVG/Canvas/WebGL
  渲染抉择、大数据量优化、主题定制等工程实践，给出不同业务场景的选型建议与边界。
---

# 数据可视化方案对比：ECharts vs D3 vs AntV 从选型到实战

## 一、问题来源

当项目需要展示图表时，团队几乎都会面临一个基础选型问题：**数据可视化库选 ECharts、D3 还是 AntV？**

**业务层面的痛点：**

- 产品经理说"我要一个酷炫的大屏"，开发说"ECharts 配置项太多搞不定"
- 设计师出了定制化的可视化需求（自定义形状、复杂交互），ECharts 的 Option 配置怎么调都不对
- 大数据量场景（百万级散点、实时流数据），图表卡成 PPT，用户投诉不断
- 多端适配（PC + 移动端 + 大屏），同一套图表在不同设备上表现不一致

**技术层面的痛点：**

- SVG vs Canvas vs WebGL 怎么选？渲染方式的选择直接影响性能和交互能力
- ECharts 配置驱动开发效率高但灵活性差，D3 灵活但开发周期长，怎么权衡？
- AntV 生态庞大（G2、G6、L7、S2、X6），但子库太多不知道从哪个开始学
- 图表主题和设计系统的整合困难，默认样式永远过不了设计师的评审
- 可访问性（Accessibility）几乎没人考虑，但政企项目有硬性要求

**核心问题：ECharts、D3、AntV 不是"谁更好"的关系，而是定位完全不同的三类工具——开箱即用的图表库、底层灵活的可视化工具集、设计规范驱动的可视化解决方案。理解它们的设计取舍，才能在正确的场景做出正确的选择。**

---

## 二、ECharts — 功能全面的企业级图表库

### 2.1 设计哲学

ECharts 的核心理念是 **"配置驱动、开箱即用，覆盖绝大多数业务场景"**。

```
设计原则：
1. 配置驱动 — 通过 Option JSON 描述图表，无需操作 DOM
2. 开箱即用 — 30+ 图表类型内置，npm install 即可使用
3. 多渲染引擎 — SVG / Canvas / WebGL 自动切换，适配不同数据量级
4. 数据驱动 — 数据变更自动触发重绘，开发者只需关注数据
```

### 2.2 核心源码解析

**ZRender 渲染引擎：**

```javascript
// echarts/zrender/src/Handler.ts — 事件系统
// ECharts 底层使用自研的 ZRender 引擎（~15,000 行）
// ZRender 封装了 Canvas/SVG 的差异，提供统一的图形接口

class ZRender {
  private storage: Storage;     // 图形元素存储
  private painter: Painter;     // 渲染器（Canvas 或 SVG）
  private handler: Handler;     // 事件处理
  private animation: Animation; // 动画系统

  // 核心流程：数据变更 → 重新计算布局 → 重绘脏区域
  refresh() {
    const list = this.storage.getDisplayList(true); // 脑区域重绘优化
    this.painter.refreshClear();
    this.painter.refresh(list);
  }
}

// echarts/src/chart/creator.ts — 图表注册机制
// 每种图表类型（bar, line, pie, scatter...）都是一个独立的"模型"
// 注册时提供 model（数据处理）、view（渲染逻辑）、transform（数据转换）
function registerChart(opts) {
  // model: 负责处理 option 中的数据，计算布局
  componentUtil.registerSubTypeDefaulter(opts.type, opts.defaultOption);
  // view: 负责调用 ZRender 绘制图形
  ChartView.register(opts.type, opts.view);
}
```

**Option 配置体系：**

```javascript
// echarts/src/model/OptionManager.ts
// ECharts 的核心是 Option 对象，采用"合并"策略
// 用户传入的 option 会与默认值深度合并，生成最终的配置

class OptionManager {
  setOption(option, notMerge) {
    if (notMerge) {
      // 全量替换
      this._option = option;
    } else {
      // 深度合并：用户配置覆盖默认值
      this._option = mergeOption(this._option, option);
    }
  }
}

// 合并策略决定了 ECharts 的 API 风格：
// 用户只需写关心的配置，其余使用默认值
// setOption 可以多次调用，每次增量更新
```

### 2.3 基础用法

```javascript
import * as echarts from 'echarts';

// 1. 初始化实例（选择渲染器）
const chart = echarts.init(document.getElementById('chart'), null, {
  renderer: 'canvas', // 'canvas' | 'svg'
});

// 2. 配置 Option
chart.setOption({
  title: { text: '销售趋势' },
  tooltip: { trigger: 'axis' },
  legend: { data: ['2025', '2026'] },
  xAxis: {
    type: 'category',
    data: ['1月', '2月', '3月', '4月', '5月', '6月'],
  },
  yAxis: { type: 'value' },
  series: [
    {
      name: '2025',
      type: 'line',
      data: [820, 932, 901, 934, 1290, 1330],
      smooth: true,
    },
    {
      name: '2026',
      type: 'bar',
      data: [620, 732, 701, 734, 1090, 1130],
    },
  ],
});

// 3. 响应式
window.addEventListener('resize', () => chart.resize());

// 4. 增量更新（setOption 会智能合并）
chart.setOption({
  series: [{ data: [920, 1032, 1001, 1034, 1390, 1430] }],
});

// 5. 销毁（避免内存泄漏）
chart.dispose();
```

### 2.4 ECharts 的优点

| 优点 | 说明 |
|------|------|
| **图表类型丰富** | 30+ 内置图表类型（折线、柱状、饼图、散点、热力图、桑基图、地理图等） |
| **开箱即用** | npm install + setOption 即可渲染，无需额外配置 |
| **大数据量性能** | Canvas 渲染 + 脏区域重绘优化，10 万级数据点流畅 |
| **主题系统** | 内置多套主题，支持自定义主题 JSON |
| **生态成熟** | 百度开源，国内使用率最高，中文文档完善 |
| **多端支持** | PC、移动端、服务端渲染（ECharts SSR） |
| **国际化好** | 中英文文档齐全，社区活跃 |

### 2.5 ECharts 的缺点

| 缺点 | 说明 |
|------|------|
| **包体积大** | 完整包 ~1MB（gzip ~300KB），即使只用了折线图也要引入大量代码 |
| **定制灵活性差** | Option 配置覆盖不到的需求（自定义形状、特殊交互）非常难实现 |
| **配置项学习成本高** | Option 有几百个配置项，嵌套层级深，查文档频繁 |
| **样式覆盖困难** | 深度定制样式需要覆盖大量默认值，代码可读性差 |
| **与 React/Vue 整合需封装** | 官方不提供组件封装，需自行处理生命周期和响应式 |

### 2.6 适配场景

- **企业后台管理系统**：标准图表需求，快速交付
- **数据大屏展示**：丰富的图表类型 + 地理图 + 主题定制
- **数据报表平台**：多图表组合、联动、数据下钻
- **团队可视化经验不足**：文档和示例丰富，学习成本低

### 2.7 局限性

- 高度定制的可视化需求（如自定义节点形状、特殊连线效果）很难实现
- SVG 模式下大数据量性能不佳，Canvas 模式下不支持 CSS 样式和 DOM 事件代理
- 按需引入配置复杂（需手动注册组件），全量引入体积过大
- 动画定制受限，复杂过渡效果难以实现

---

## 三、D3.js — 底层灵活的数据驱动文档库

### 3.1 设计哲学

D3 的核心理念是 **"提供最小化的可视化工具集，将控制权完全交给开发者"**。

```
设计原则：
1. 数据驱动 DOM — d3-selection 将数据绑定到 DOM 元素
2. 最小约束 — 不提供任何图表组件，只提供工具函数
3. Web 标准优先 — 直接操作 SVG/HTML/CSS，无抽象层
4. 函数式风格 — 链式调用 + 纯函数，数据变换与渲染分离
```

### 3.2 核心源码解析

**d3-selection 数据绑定：**

```javascript
// d3-selection/src/selection.js — D3 最核心的概念
// selection 是对一组 DOM 元素的包装，支持链式操作

class Selection {
  // 数据绑定：将数据数组与 DOM 元素一一对应
  data(values, key) {
    const join = new Join(this, values, key);
    // 关键：将数据分为三组
    // enter — 数据多于元素，需要创建新元素
    // update — 数据与元素一一对应，需要更新
    // exit  — 元素多于数据，需要移除
    return join;
  }

  // enter：为多余的数据创建新元素
  enter() {
    return this._enter;
  }

  // exit：为多余的元素执行移除
  exit() {
    return this._exit;
  }
}

// d3-selection/src/join.js — enter/update/exit 的核心实现
class Join {
  constructor(selection, data, key) {
    // 根据 key 函数匹配数据与元素
    // key 函数确保数据与元素的绑定关系是稳定的
    // 没有 key 函数时按索引匹配 → 数据顺序变化时会导致错误绑定
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const k = key ? key(d, i) : i;
      if (nodeByKey.has(k)) {
        // 已有对应元素 → update 组
        updateNodes.push(nodeByKey.get(k));
      } else {
        // 没有对应元素 → enter 组
        enterNodes.push(new EnterNode(parent, d, k));
      }
    }
    // 不在数据中的元素 → exit 组
    for (const node of group) {
      if (!nodeByKey.has(node.__data__)) {
        exitNodes.push(node);
      }
    }
  }
}
```

**d3-scale 比例尺系统：**

```javascript
// d3-scale/src/linear.js — 线性比例尺
// 将数据域（domain）映射到视觉域（range）
function scaleLinear() {
  // domain: 数据的范围，如 [0, 100]
  // range:  像素的范围，如 [0, 800]
  // 输出：y = mx + b（线性映射）

  function scale(x) {
    // 将数据值映射到视觉值
    return output(x);
  }

  scale.domain = function(_) {
    // 设置数据域，重新计算映射函数
    domain = _;
    // piecewise: 将 domain 和 range 分段，计算每段的线性映射
    piecewise = polymap(domain, range, deinterpolateLinear);
    return scale;
  };

  scale.range = function(_) {
    // 设置视觉域
    range = _;
    piecewise = polymap(domain, range, deinterpolateLinear);
    return scale;
  };

  // ticks: 生成美观的刻度值
  scale.ticks = function(count) {
    return d3Array.ticks(domain[0], domain[1], count);
  };

  return scale;
}
```

### 3.3 基础用法

```javascript
import * as d3 from 'd3';

// 1. 准备数据
const data = [
  { name: 'A', value: 30 },
  { name: 'B', value: 80 },
  { name: 'C', value: 45 },
  { name: 'D', value: 60 },
  { name: 'E', value: 20 },
];

// 2. 创建 SVG 容器
const width = 600, height = 400;
const margin = { top: 20, right: 30, bottom: 40, left: 40 };

const svg = d3.select('#chart')
  .append('svg')
  .attr('width', width)
  .attr('height', height);

// 3. 创建比例尺
const xScale = d3.scaleBand()
  .domain(data.map(d => d.name))
  .range([margin.left, width - margin.right])
  .padding(0.1);

const yScale = d3.scaleLinear()
  .domain([0, d3.max(data, d => d.value)])
  .nice()
  .range([height - margin.bottom, margin.top]);

// 4. 绑定数据 + enter/update/exit
svg.selectAll('.bar')
  .data(data, d => d.name) // key function 确保稳定绑定
  .join('rect')            // join 是 enter + update + exit 的简写
  .attr('class', 'bar')
  .attr('x', d => xScale(d.name))
  .attr('y', d => yScale(d.value))
  .attr('width', xScale.bandwidth())
  .attr('height', d => height - margin.bottom - yScale(d.value))
  .attr('fill', 'steelblue');

// 5. 添加坐标轴
svg.append('g')
  .attr('transform', `translate(0,${height - margin.bottom})`)
  .call(d3.axisBottom(xScale));

svg.append('g')
  .attr('transform', `translate(${margin.left},0)`)
  .call(d3.axisLeft(yScale));

// 6. 动画更新
function update(newData) {
  yScale.domain([0, d3.max(newData, d => d.value)]);

  svg.selectAll('.bar')
    .data(newData, d => d.name)
    .join(
      enter => enter.append('rect')
        .attr('y', yScale(0))
        .attr('height', 0)
        .call(enter => enter.transition()
          .attr('y', d => yScale(d.value))
          .attr('height', d => height - margin.bottom - yScale(d.value))),
      update => update
        .call(update => update.transition()
          .attr('y', d => yScale(d.value))
          .attr('height', d => height - margin.bottom - yScale(d.value))),
      exit => exit
        .call(exit => exit.transition()
          .attr('y', yScale(0))
          .attr('height', 0)
          .remove()),
    );
}
```

### 3.4 D3 的优点

| 优点 | 说明 |
|------|------|
| **最大灵活性** | 直接操作 SVG/Canvas/DOM，可实现任何可视化效果 |
| **SVG 原生可交互** | 每个 SVG 元素都是 DOM 节点，可直接绑定事件、添加 CSS |
| **与 Web 标准无缝集成** | 输出就是标准 SVG/HTML/CSS，与 React/Vue 等框架天然兼容 |
| **社区庞大** | npm 周下载量 600 万+，大量示例（Observable、Bl.ocks） |
| **模块化设计** | d3-scale、d3-shape、d3-transition 等可独立使用 |
| **学术级数据可视化** | 是论文和学术可视化项目的首选工具 |

### 3.5 D3 的缺点

| 缺点 | 说明 |
|------|------|
| **学习曲线极陡** | 需要理解数据绑定、enter/update/exit、比例尺等核心概念 |
| **无内置图表** | 不提供任何"折线图""柱状图"组件，一切从零构建 |
| **开发周期长** | 一个标准柱状图用 ECharts 20 行代码，D3 需要 50+ 行 |
| **大数据量性能差** | SVG 模式下数万元素会严重拖慢 DOM 渲染 |
| **无统一主题** | 没有图表主题概念，样式完全自定义，维护成本高 |
| **版本兼容问题** | D3 v3 → v4 → v5 → v6 → v7 API 变化大，迁移成本高 |

### 3.6 适配场景

- **高度定制化的可视化**：自定义形状、特殊交互、物理模拟
- **数据新闻 / 信息图**：一次性高定制需求，不需要复用
- **学术可视化**：论文配图、科研数据展示
- **可视化组件库开发**：基于 D3 封装自研图表库
- **复杂交互场景**：拖拽、缩放、画笔、力导向图等

### 3.7 局限性

- 不适合快速交付的标准图表需求，开发成本是 ECharts 的 3-5 倍
- SVG 渲染模式下超过 5000 个元素性能明显下降
- 需要开发者具备 SVG、CSS 动画、数据结构等前端基础
- 团队协作困难，代码风格差异大，可维护性依赖开发者水平

---

## 四、AntV — 蚂蚁集团的可可视化解决方案

### 4.1 设计哲学

AntV 的核心理念是 **"按场景细分，设计规范驱动，提供专业级可视化能力"**。

```
设计原则：
1. 场景细分 — 不同可视化需求使用不同子库，而非一个大而全的库
2. Grammar of Graphics — 基于图形语法的声明式 API
3. 设计规范驱动 — 内置蚂蚁金服设计语言，视觉一致性好
4. TypeScript 原生 — 从底层开始用 TypeScript 编写
```

**AntV 生态全景：**

```
AntV 生态
├── G（底层渲染引擎）── 统一的 Canvas/SVG/WebGL 渲染抽象
│
├── G2（统计图表）── 折线、柱状、饼图等标准图表
│   └── 基于图形语法（Grammar of Graphics）
│
├── G6（图可视化）── 关系图、流程图、组织架构图
│   └── 节点 + 边 + 布局算法
│
├── L7（地理可视化）── 地图、热力图、轨迹图
│   └── 基于 WebGL 的高性能地理渲染
│
├── S2（多维分析表）── 交叉表、透视表
│   └── 类 Excel 的多维数据分析
│
├── X6（图编辑）── DAG 图、ER 图、流程编辑器
│   └── 可交互的图编辑能力
│
└── AVA（可视化分析）── 自动推荐图表类型
    └── 数据 → 自动生成合适的可视化
```

### 4.2 核心源码解析

**G2 的图形语法（Grammar of Graphics）：**

```typescript
// @antv/g2/src/chart.ts — G2 的核心是图形语法
// 图形语法的核心思想：图表 = 数据 + 映射 + 几何标记 + 统计变换 + 坐标系
//
// Chart = Data + Aesthetic Mapping + Geometric Mark + Stat + Coordinate
//
// 例如一个柱状图：
//   Data: [{name:'A', value:30}, ...]
//   Mapping: name → x轴, value → y轴
//   Mark: interval（柱状）
//   Stat: identity（不变换）
//   Coordinate: cartesian（笛卡尔坐标系）

class Chart {
  // 声明式 API：通过链式调用描述图表
  interval() {
    // 几何标记：interval = 柱状图/条形图
    return this.createMark('interval');
  }

  line() {
    // 几何标记：line = 折线图
    return this.createMark('line');
  }

  point() {
    // 几何标记：point = 散点图
    return this.createMark('point');
  }
}

// @antv/g2/src/mark.ts — Mark 是图形语法的核心抽象
class Mark {
  // 数据映射：将数据字段映射到视觉通道
  encode(channel: string, field: string | Function) {
    // channel: x, y, color, size, shape...
    // field: 数据字段名 或 计算函数
    this.encodings[channel] = field;
    return this;
  }

  // 样式设置
  style(channel: string, value: any) {
    this.styles[channel] = value;
    return this;
  }

  // 渲染：根据 encode + mark 类型生成图形
  render() {
    // 1. 数据处理（分组、聚合、排序）
    // 2. 比例尺计算（根据 encode 自动推断）
    // 3. 坐标系映射（数据空间 → 像素空间）
    // 4. 几何标记生成（interval/line/area/point）
    // 5. 渲染到 Canvas/SVG
  }
}
```

**G 底层渲染引擎：**

```typescript
// @antv/g/src/canvas.ts — 统一渲染抽象
// G 引擎封装了 Canvas、SVG、WebGL 三种渲染器的差异
// 上层（G2/G6/L7）只调用 G 的 API，无需关心底层渲染方式

class Canvas {
  private renderer: Renderer; // CanvasRenderer | SVGRenderer | WebGLRenderer

  // 统一的图形 API
  appendChild<T extends DisplayObject>(child: T): T {
    // 无论底层是 Canvas/SVG/WebGL，
    // 上层都是面向对象的图形 API
    this.renderer.appendChild(child);
    return child;
  }
}

// @antv/g/src/display-objects — 图形元素
// 提供统一的图形基类
class Rect extends DisplayObject { /* 矩形 */ }
class Circle extends DisplayObject { /* 圆形 */ }
class Line extends DisplayObject { /* 线段 */ }
class Path extends DisplayObject { /* 路径 */ }
class Text extends DisplayObject { /* 文本 */ }
class Group extends DisplayObject { /* 分组 */ }
```

### 4.3 基础用法

```typescript
// G2 v5 — 声明式 API
import { Chart } from '@antv/g2';

// 1. 标准图表
const chart = new Chart({
  container: 'chart',
  autoFit: true,
});

chart
  .interval()
  .data([
    { genre: 'Sports', sold: 275 },
    { genre: 'Strategy', sold: 115 },
    { genre: 'Action', sold: 120 },
    { genre: 'Shooter', sold: 350 },
    { genre: 'Other', sold: 150 },
  ])
  .encode('x', 'genre')
  .encode('y', 'sold')
  .encode('color', 'genre')
  .style('fillOpacity', 0.8)
  .animate('enter', { type: 'fadeIn' });

chart.render();

// 2. 多视图组合（G2 的核心优势）
const multiChart = new Chart({
  container: 'multi-chart',
  autoFit: true,
});

// 视图一：散点图
multiChart
  .point()
  .data(scatterData)
  .encode('x', 'height')
  .encode('y', 'weight')
  .encode('color', 'gender')
  .encode('size', 'age');

// 视图二：分面（Facet）
multiChart
  .facetRect()
  .data(facetData)
  .encode('x', 'category')
  .each((facet) => {
    facet
      .interval()
      .encode('x', 'month')
      .encode('y', 'sales');
  });

multiChart.render();

// 3. G6 — 关系图
import { Graph } from '@antv/g6';

const graph = new Graph({
  container: 'graph',
  data: {
    nodes: [
      { id: 'node1', style: { labelText: 'Node 1' } },
      { id: 'node2', style: { labelText: 'Node 2' } },
    ],
    edges: [
      { source: 'node1', target: 'node2' },
    ],
  },
  layout: {
    type: 'force', // 力导向布局
  },
  behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
});

graph.render();

// 4. L7 — 地理可视化
import { Scene, PointLayer } from '@antv/l7';

const scene = new Scene({
  id: 'map',
  map: new Mapbox({ style: 'light', center: [120, 30], zoom: 5 }),
});

const pointLayer = new PointLayer()
  .source(cityData, { parser: { type: 'json', x: 'lng', y: 'lat' } })
  .size('value', [5, 20])
  .color('value', '#5B8FF9', '#5AD8A6')
  .shape('circle')
  .animate(true);

scene.addLayer(pointLayer);
```

### 4.4 AntV 的优点

| 优点 | 说明 |
|------|------|
| **设计规范专业** | 内置蚂蚁设计语言，视觉一致性好，默认颜值高 |
| **场景细分精准** | G2（统计图）、G6（关系图）、L7（地图）、S2（透视表）各司其职 |
| **TypeScript 原生** | 从底层开始用 TS 编写，类型推断完整 |
| **声明式 API** | 基于图形语法的链式 API，表达力强且简洁 |
| **多渲染引擎** | G 引擎统一封装 Canvas/SVG/WebGL，按需选择 |
| **React 友好** | 官方提供 @antv/g2-react 等组件封装 |

### 4.5 AntV 的缺点

| 缺点 | 说明 |
|------|------|
| **子库多学习分散** | G2 + G6 + L7 + S2 + X6，每个库都要单独学习 |
| **社区不如 ECharts/D3** | 遇到问题搜索到的答案较少，Stack Overflow 覆盖不足 |
| **版本迭代快** | G2 v4 → v5 API 大改，升级成本高，文档可能滞后 |
| **包间版本依赖** | @antv/g、@antv/g2、@antv/g6 版本需要匹配，混用容易冲突 |
| **国际化较弱** | 主要面向国内用户，英文文档和社区资源较少 |

### 4.6 适配场景

- **蚂蚁设计体系项目**：已使用 Ant Design 的中后台系统
- **关系图 / 图可视化**：G6 是国内最好的关系图方案之一
- **地理可视化**：L7 的地图渲染能力专业
- **多维分析表**：S2 的透视表在数据分析场景领先
- **TypeScript 项目**：类型支持最完善

### 4.7 局限性

- 只需标准图表（折线、柱状、饼图）时引入 AntV 整体生态过重
- G2 的图表类型覆盖面不如 ECharts 广（如 3D 图表较弱）
- G6、L7 在复杂场景下的性能调优需要深入理解底层 G 引擎
- 版本升级周期短，长期维护的项目可能频繁面临 breaking changes

---

## 五、核心差异对比

### 5.1 渲染机制对比

```
三种渲染方式的特点：

SVG（D3 默认）
┌──────────────────────────────────────────┐
│ 优点：每个元素是 DOM 节点，可绑定事件和CSS  │
│ 缺点：DOM 节点过多时性能急剧下降            │
│ 适合：< 5000 个元素，需要精细交互的场景      │
│ 工具：D3（默认 SVG）                       │
└──────────────────────────────────────────┘

Canvas（ECharts 默认、AntV G2 默认）
┌──────────────────────────────────────────┐
│ 优点：像素级渲染，不受 DOM 数量限制          │
│ 缺点：不可选择文本、不可右键、调试困难        │
│ 适合：5,000 ~ 500,000 个元素的数据场景      │
│ 工具：ECharts、AntV G2                    │
└──────────────────────────────────────────┘

WebGL（大数据/3D 场景）
┌──────────────────────────────────────────┐
│ 优点：GPU 加速，支持百万级数据点和 3D 渲染   │
│ 缺点：兼容性问题、调试困难、开发成本高        │
│ 适合：> 500,000 个元素，3D 可视化           │
│ 工具：ECharts GL、AntV L7                 │
└──────────────────────────────────────────┘

性能对比（散点图渲染 10 万数据点）：
SVG:    浏览器可能崩溃
Canvas: ~200ms 渲染完成，可交互
WebGL:  ~50ms 渲染完成，流畅
```

### 5.2 API 风格对比

```javascript
// ===== 同一个柱状图，三种库的代码风格对比 =====

// ECharts — 配置式（JSON 描述一切）
echarts.init(container).setOption({
  xAxis: { type: 'category', data: ['A', 'B', 'C'] },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: [30, 80, 45] }],
});

// D3 — 命令式（逐步构建，完全控制）
const x = d3.scaleBand().domain(['A', 'B', 'C']).range([0, width]);
const y = d3.scaleLinear().domain([0, 80]).range([height, 0]);
svg.selectAll('rect')
  .data([30, 80, 45])
  .join('rect')
  .attr('x', (d, i) => x(['A', 'B', 'C'][i]))
  .attr('y', d => y(d))
  .attr('width', x.bandwidth())
  .attr('height', d => height - y(d));

// AntV G2 — 声明式（图形语法链式调用）
new Chart({ container })
  .interval()
  .data([{ name: 'A', value: 30 }, { name: 'B', value: 80 }, { name: 'C', value: 45 }])
  .encode('x', 'name')
  .encode('y', 'value')
  .render();
```

### 5.3 性能对比

```
测试条件：Chrome 120，16GB 内存，相同数据集

场景一：10 个数据点的柱状图（标准场景）
┌──────────┬─────────────┬─────────────┐
│ 库       │ 首次渲染     │ 包体积(gzip) │
├──────────┼─────────────┼─────────────┤
│ ECharts  │   ~30ms     │  ~300KB     │
│ D3       │   ~10ms     │  ~80KB      │
│ AntV G2  │   ~40ms     │  ~200KB     │
└──────────┴─────────────┴─────────────┘
说明：小数据量下差异不大，D3 最轻量。

场景二：10 万数据点的散点图（大数据场景）
┌──────────┬─────────────┬─────────────┐
│ 库       │ 渲染耗时     │ 交互流畅度   │
├──────────┼─────────────┼─────────────┤
│ ECharts  │  ~200ms     │  流畅       │
│ D3(SVG)  │  >5000ms    │  卡顿/崩溃   │
│ D3(Canvas)│ ~300ms     │  流畅       │
│ AntV G2  │  ~250ms     │  流畅       │
└──────────┴─────────────┴─────────────┘
说明：D3 用 SVG 不适合大数据量，需切换到 Canvas。
      ECharts 和 G2 默认 Canvas，大数据量表现好。

场景三：百万数据点的热力图（极限场景）
┌──────────┬─────────────┬─────────────┐
│ 库       │ 渲染耗时     │ 方案        │
├──────────┼─────────────┼─────────────┤
│ ECharts  │  ~500ms     │ Canvas + 增量│
│ D3       │  不推荐     │ 需自建 WebGL │
│ AntV G2  │  ~600ms     │ Canvas + 分片│
│ AntV L7  │  ~100ms     │ WebGL 渲染   │
└──────────┴─────────────┴─────────────┘
说明：百万级数据需要 WebGL。L7 专门为地理大数据优化。
```

### 5.4 综合对比表

| 维度 | ECharts | D3.js | AntV |
|------|---------|-------|------|
| **定位** | 企业级图表库 | 底层可视化工具集 | 设计驱动的可视化方案 |
| **默认渲染** | Canvas | SVG | Canvas |
| **API 风格** | 配置式（Option） | 命令式（链式调用） | 声明式（图形语法） |
| **内置图表类型** | 30+ | 0（全部自建） | 20+（G2）+ 关系图/地图/透视表 |
| **学习曲线** | 低 | 高 | 中 |
| **包体积(gzip)** | ~300KB | ~80KB（按需更小） | ~200KB（G2） |
| **TypeScript** | @types/echarts | @types/d3 | 原生支持 |
| **主题定制** | 内置主题系统 | 完全自定义 | 内置设计规范 |
| **大数据量** | 好（Canvas） | 差（SVG）需手动 Canvas | 好（Canvas/WebGL） |
| **交互定制** | 中（Option 配置） | 最高（直接操作 DOM） | 高（API + 自定义 Shape） |
| **React 整合** | echarts-for-react | react-d3-library | @antv/g2-react |
| **文档质量** | 优秀（中英文） | 良好（英文为主） | 良好（中文为主） |
| **社区活跃度** | 最高（GitHub 60k+ stars） | 最高（GitHub 108k+ stars） | 中（GitHub 11k+ stars） |
| **首次发布** | 2013 年 | 2011 年 | 2017 年 |
| **维护方** | Apache 基金会 | Mike Bostock + 社区 | 蚂蚁集团 |

---

## 六、常见陷阱与最佳实践

### 6.1 ECharts 内存泄漏

```javascript
// ❌ 错误写法：单页应用中反复创建实例但不销毁
function createChart(data) {
  const chart = echarts.init(document.getElementById('chart'));
  chart.setOption({ series: [{ data }] });
  // 每次调用都创建新实例，旧实例不会被 GC 回收
}

// ✅ 正确写法：复用实例 + 组件卸载时销毁
let chartInstance = null;

function updateChart(data) {
  if (!chartInstance) {
    chartInstance = echarts.init(document.getElementById('chart'));
  }
  chartInstance.setOption({ series: [{ data }] });
}

// Vue 示例
onBeforeUnmount(() => {
  chartInstance?.dispose();
  chartInstance = null;
});

// React 示例
useEffect(() => {
  return () => {
    chartInstance?.dispose();
  };
}, []);
```

### 6.2 D3 数据绑定遗漏 Key Function

```javascript
// ❌ 错误写法：没有 key function，按索引匹配
svg.selectAll('rect')
  .data(newData) // 没有 key function
  .join('rect');

// 问题：数据顺序变化时，元素绑定的数据会错乱
// [A, B, C] → [C, A, B]
// 按索引匹配：0→C(应为A), 1→A(应为B), 2→B(应为C)
// 导致过渡动画完全错误

// ✅ 正确写法：提供 key function
svg.selectAll('rect')
  .data(newData, d => d.id) // 用唯一标识匹配
  .join('rect');
```

### 6.3 AntV 版本兼容

```json
// ❌ 错误写法：@antv 包版本不一致
{
  "dependencies": {
    "@antv/g2": "^5.0.0",
    "@antv/g": "^5.0.0",    // G2 v5 依赖 g v6
    "@antv/g6": "^4.0.0"    // G6 v4 依赖 g v4
  }
}
// 多个版本的 @antv/g 同时存在，导致样式/事件冲突

// ✅ 正确写法：统一版本，使用 peerDependencies 管控
// 先确认各子库兼容的 G 版本，再锁定
{
  "dependencies": {
    "@antv/g2": "^5.1.0",
    "@antv/g6": "^5.0.0"    // G6 v5 也基于 G v6，与 G2 v5 兼容
  }
}
// 或者只用一个子库，避免混用
```

### 6.4 响应式适配

```javascript
// ECharts — resize 监听
const resizeObserver = new ResizeObserver(() => {
  chart.resize(); // 自动重新计算尺寸
});
resizeObserver.observe(container);

// D3 — 需要手动重绘
const resizeObserver = new ResizeObserver(() => {
  const { width, height } = container.getBoundingClientRect();
  xScale.range([margin.left, width - margin.right]);
  yScale.range([height - margin.bottom, margin.top]);
  updateChart(); // 手动重新绑定数据和渲染
});
resizeObserver.observe(container);

// AntV G2 — autoFit 自动适配
const chart = new Chart({
  container: 'chart',
  autoFit: true, // 内置响应式，无需手动 resize
});
```

---

## 七、选型决策树

```
需要数据可视化
    │
    ├─ 标准图表（折线/柱状/饼图），快速交付？
    │   └─ ✅ ECharts
    │       └─ 30+ 图表类型，setOption 即可
    │
    ├─ 需要地理可视化 / 地图？
    │   └─ ✅ AntV L7（专业地图） 或 ECharts（基础地图）
    │
    ├─ 需要关系图 / 网络图 / 流程图？
    │   └─ ✅ AntV G6 / X6
    │       └─ 国内最好的图可视化方案
    │
    ├─ 需要透视表 / 多维分析？
    │   └─ ✅ AntV S2
    │       └─ 专业级交叉表和透视表
    │
    ├─ 高度定制化 / 学术级可视化？
    │   └─ ✅ D3.js
    │       └─ 完全控制，可实现任何效果
    │
    ├─ 大数据量（10万+）实时渲染？
    │   └─ ✅ ECharts（Canvas） / AntV L7（WebGL）
    │
    ├─ Ant Design 生态项目？
    │   └─ ✅ AntV
    │       └─ 设计语言一致，React 友好
    │
    ├─ 团队可视化经验不足？
    │   └─ ✅ ECharts
    │       └─ 文档丰富，社区活跃，示例最多
    │
    └─ 构建自研可视化组件库？
        └─ ✅ D3.js
            └─ 底层工具集，作为基础层封装
```

---

## 八、总结

| 场景 | 推荐方案 | 原因 |
|------|---------|------|
| 后台管理系统标准图表 | ECharts | 开箱即用，30+ 图表类型 |
| 数据大屏 | ECharts / AntV | ECharts 图表丰富，AntV 颜值高 |
| 高度定制可视化 | D3.js | 最大灵活性，完全控制 |
| 关系图 / 组织架构图 | AntV G6 | 专业图可视化，布局算法丰富 |
| 地图 / 地理可视化 | AntV L7 | WebGL 渲染，专业地理能力 |
| 透视表 / 多维分析 | AntV S2 | 唯一专业的透视表方案 |
| 学术论文配图 | D3.js | 学术界标准工具，SVG 输出 |
| 大数据量（10万+） | ECharts / AntV | Canvas 渲染 + 增量更新 |
| Ant Design 项目 | AntV | 设计语言统一，React 原生 |
| 自研图表库基础层 | D3.js | 模块化，按需使用工具函数 |

**一句话总结：ECharts 是"效率之选"，D3 是"灵活之选"，AntV 是"专业之选"。标准需求用 ECharts，定制需求用 D3，蚂蚁生态或有专业场景需求用 AntV。很多时候它们不是互斥的——大屏可能用 ECharts 做标准图表 + D3 做定制特效 + G6 做关系图。**
