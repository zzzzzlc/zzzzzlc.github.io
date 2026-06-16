---
title: "Vue 2 / Vue 3 从入门到源码解析：响应式原理、编译优化与架构演进"
date: "2026-05-11"
tags:
  - Vue
  - 前端
category: "前端工程"
summary: "从 Vue 2 到 Vue 3 的实际迁移痛点出发，系统梳理 Vue 核心知识体系——模板语法、组件系统、生命周期、指令、组合式 API，深入解析响应式系统（Object.defineProperty vs Proxy）、虚拟 DOM 与 Diff 算法、编译时优化（静态提升/补丁标记/Block Tree）、响应式 effect 与 scheduler 调度，以及 Vue 3 架构重设计的动机与边界。同时覆盖 Vue Router 3→4 变更、Vuex vs Pinia 状态管理选型、TypeScript 集成、SSR/Nuxt 方案对比、自定义指令与渲染函数变更、组件 v-model 变更等生态迁移核心内容。"
---

# Vue 2 / Vue 3 从入门到源码解析：响应式原理、编译优化与架构演进

## 一、问题来源

Vue 是国内使用最广泛的前端框架之一，但从 Vue 2 迁移到 Vue 3 的过程中，团队经常遇到以下困惑：

**迁移痛点：**

- Vue 3 到底改了什么？为什么响应式原理从 `Object.defineProperty` 换成了 `Proxy`？
- Options API 写得好好的，为什么要引入 Composition API？两种风格怎么选？
- 有人说 Vue 3 性能好很多，到底好在哪里？编译时做了哪些优化？
- Vue 2 的项目要不要升级？怎么评估迁移成本？

**源码理解的困惑：**

- Vue 的响应式是"自动收集依赖"的，但依赖是怎么收集的？什么时候触发的？
- 虚拟 DOM 的 Diff 算法在 Vue 和 React 中有什么不同？
- Vue 3 的编译器做了哪些"聪明的事"，让运行时可以做更少的工作？

**核心问题：Vue 3 不是重写，而是重新设计。理解 Vue 2 的设计约束和 Vue 3 的突破点，才能真正掌握框架的演进思路。**

---

## 二、Vue 基础知识体系

### 2.1 模板语法

```html
<!-- 插值 -->
<span>{{ message }}</span>
<span>{{ ok ? 'YES' : 'NO' }}</span>

<!-- 指令 -->
<div v-if="type === 'A'">A</div>
<div v-else-if="type === 'B'">B</div>
<div v-else>C</div>

<ul>
  <li v-for="item in items" :key="item.id">{{ item.name }}</li>
</ul>

<!-- 双向绑定 -->
<input v-model="text" />
<!-- 等价于 -->
<input :value="text" @input="text = $event.target.value" />
```

### 2.2 组件系统

```vue
<!-- ChildComponent.vue -->
<template>
  <div>
    <slot name="header" :data="headerData">
      <!-- 作用域插槽：父组件可访问子组件数据 -->
      {{ headerData.title }}
    </slot>
    <slot>默认内容</slot>
  </div>
</template>

<script>
export default {
  props: {
    title: { type: String, required: true },
    count: { type: Number, default: 0 },
    items: { type: Array, validator: v => v.every(i => i.id) }
  },
  emits: ['update', 'delete'],  // Vue 3 推荐
  data() {
    return { headerData: { title: 'Hello' } }
  }
}
</script>
```

### 2.3 生命周期

```
Vue 2                          Vue 3（Options API）
────────                       ──────────────────
beforeCreate                   （被 setup() 替代）
created                        （被 setup() 替代）
beforeMount                    onBeforeMount
mounted                        onMounted
beforeUpdate                   onBeforeUpdate
updated                        onUpdated
beforeDestroy                  onBeforeUnmount
destroyed                      onUnmounted
                               onActivated（keep-alive）
                               onDeactivated（keep-alive）
                               onErrorCaptured
                               onRenderTracked（调试）
                               onRenderTriggered（调试）
```

```vue
<!-- Vue 3 Composition API 写法 -->
<script setup>
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  console.log('组件已挂载')
  // 获取 DOM、发起请求、添加事件监听
})

onUnmounted(() => {
  console.log('组件将卸载')
  // 清理副作用、移除事件监听
})
</script>
```

### 2.4 内置指令

| 指令 | 作用 | 注意事项 |
|------|------|----------|
| `v-if` | 条件渲染（销毁/重建 DOM） | 切换开销大，适合条件很少变化 |
| `v-show` | 条件显示（CSS `display`） | 初始渲染开销大，适合频繁切换 |
| `v-for` | 列表渲染 | **必须加 `:key`**，避免用 index 作 key |
| `v-model` | 双向绑定 | 本质是 `:value` + `@input` 语法糖 |
| `v-once` | 只渲染一次 | 优化静态内容 |
| `v-memo` | 记忆化（Vue 3.2+） | 类似 React 的 useMemo |
| `v-slot` | 具名/作用域插槽 | 简写 `#name` |

### 2.5 计算属性 vs 侦听器

```javascript
// 计算属性：基于依赖缓存，依赖不变不重新计算
const fullName = computed(() => {
  return `${firstName.value} ${lastName.value}`
})

// 侦听器：适合执行副作用（异步操作）
watch(searchQuery, async (newVal, oldVal) => {
  const results = await search(newVal)
  searchResults.value = results
}, {
  immediate: true,   // 首次执行
  deep: true,        // 深度监听（谨慎使用，性能开销大）
  flush: 'post'      // DOM 更新后执行
})

// watchEffect：自动收集依赖
watchEffect(() => {
  // 自动追踪里面用到的所有响应式数据
  console.log(`${firstName.value} ${lastName.value}`)
})
```

**选型**：派生值用 `computed`，副作用用 `watch`/`watchEffect`。

---

## 三、Options API vs Composition API

### 3.1 Options API 的痛点（Vue 2）

```javascript
// Vue 2：同一个功能的代码被拆散到不同选项中
export default {
  data() {
    return {
      // 功能 A 的数据
      searchQuery: '',
      searchResults: [],
      // 功能 B 的数据
      sortField: 'date',
      sortOrder: 'desc',
    }
  },
  computed: {
    // 功能 A 的计算
    filteredResults() { /* ... */ },
    // 功能 B 的计算
    sortedResults() { /* ... */ },
  },
  methods: {
    // 功能 A 的方法
    handleSearch() { /* ... */ },
    // 功能 B 的方法
    toggleSort() { /* ... */ },
  },
  mounted() {
    // 功能 A 的初始化
    this.handleSearch()
    // 功能 B 的初始化
    this.loadSortPreference()
  }
}
```

**问题**：组件变大后，同一个功能的 data/computed/methods/mounted 分散在各处，阅读和维护需要在多个选项之间反复跳转。

### 3.2 Composition API 的解法（Vue 3）

```javascript
// Vue 3：按功能聚合代码
import { ref, computed, onMounted } from 'vue'

// 功能 A：搜索逻辑
function useSearch() {
  const searchQuery = ref('')
  const searchResults = ref([])
  const filteredResults = computed(() => /* ... */)

  function handleSearch() { /* ... */ }
  onMounted(() => handleSearch())

  return { searchQuery, searchResults, filteredResults, handleSearch }
}

// 功能 B：排序逻辑
function useSort(list) {
  const sortField = ref('date')
  const sortOrder = ref('desc')
  const sortedResults = computed(() => /* ... */)

  function toggleSort() { /* ... */ }

  return { sortField, sortOrder, sortedResults, toggleSort }
}

// 组件中组合使用
export default {
  setup() {
    const search = useSearch()
    const sort = useSort(search.filteredResults)
    return { ...search, ...sort }
  }
}
```

**核心优势**：逻辑复用（Composable 函数）替代了 Vue 2 的 Mixin（命名冲突、来源不明确）。

### 3.3 两者对比

| 维度 | Options API | Composition API |
|------|-------------|-----------------|
| 代码组织 | 按选项类型（data/computed/methods） | 按功能/关注点 |
| 逻辑复用 | Mixin（有命名冲突风险） | Composable 函数（清晰明确） |
| TypeScript | 类型推断困难 | 天然友好 |
| 学习曲线 | 低（直观） | 中（需理解 ref/reactive） |
| 适合场景 | 简单组件、快速原型 | 复杂逻辑、可复用功能 |
| Vue 版本 | Vue 2 / Vue 3 | 仅 Vue 3 |

---

## 四、响应式系统：从 Object.defineProperty 到 Proxy

### 4.1 Vue 2 的响应式实现

```javascript
// Vue 2 响应式核心：Object.defineProperty
function defineReactive(obj, key, val) {
  const dep = new Dep()  // 每个属性一个依赖收集器

  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get() {
      // 依赖收集：当前正在执行的 Watcher 加入 dep
      if (Dep.target) {
        dep.depend()
      }
      return val
    },
    set(newVal) {
      if (newVal === val) return
      val = newVal
      // 派发更新：通知所有依赖
      dep.notify()
    }
  })
}

// 递归遍历 data 对象的所有属性
function observe(data) {
  if (typeof data !== 'object' || data === null) return
  Object.keys(data).forEach(key => {
    defineReactive(data, key, data[key])
  })
}
```

### 4.2 Vue 2 响应式的局限性

```javascript
// 1. 无法检测属性添加/删除
this.user.age = 25           // ❌ 非响应式
this.$set(this.user, 'age', 25)  // ✅ 需要 $set

// 2. 无法检测数组索引直接赋值
this.items[0] = newItem      // ❌ 非响应式
this.$set(this.items, 0, newItem) // ✅

// 3. 无法检测数组长度修改
this.items.length = 0        // ❌ 非响应式
this.items.splice(0)         // ✅

// 4. 深层对象需要递归遍历（初始化性能开销）
data: {
  nested: { deeply: { value: 1 } }  // 递归三层 defineProperty
}
```

### 4.3 Vue 3 的响应式实现：Proxy

```javascript
// Vue 3 响应式核心：Proxy + Reflect
const targetMap = new WeakMap()  // 全局依赖映射表
let activeEffect = null          // 当前正在执行的 effect

function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver)
      // 依赖收集
      track(target, key)
      // 深层响应式：惰性处理（访问时才代理，不是初始化时）
      if (typeof result === 'object' && result !== null) {
        return reactive(result)
      }
      return result
    },
    set(target, key, value, receiver) {
      const oldValue = target[key]
      const result = Reflect.set(target, key, value, receiver)
      if (oldValue !== value) {
        // 派发更新
        trigger(target, key)
      }
      return result
    },
    deleteProperty(target, key) {
      const hadKey = key in target
      const result = Reflect.deleteProperty(target, key)
      if (hadKey && result) {
        trigger(target, key)  // 删除也是响应式的
      }
      return result
    }
  })
}
```

### 4.4 依赖收集与触发

```javascript
// 依赖收集
function track(target, key) {
  if (!activeEffect) return

  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }

  dep.add(activeEffect)  // 将当前 effect 加入依赖集合
}

// 派发更新
function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key)
  if (dep) {
    // 创建副本遍历，防止无限循环
    const effectsToRun = new Set(dep)
    effectsToRun.forEach(effect => {
      // 避免递归调用自身
      if (effect !== activeEffect) {
        effect.scheduler
          ? effect.scheduler()  // 有调度器则走调度器（computed 等）
          : effect.run()        // 否则立即执行
      }
    })
  }
}
```

### 4.5 effect 系统

```javascript
// Vue 3 的 effect 是响应式系统的基石
function effect(fn, options = {}) {
  const effectFn = () => {
    activeEffect = effectFn  // 标记当前 effect
    const result = fn()      // 执行函数，触发依赖收集
    activeEffect = null
    return result
  }

  effectFn.deps = []         // 存储所有依赖集合的引用（方便清理）
  effectFn.scheduler = options.scheduler

  if (!options.lazy) {
    effectFn()  // 立即执行一次
  }

  return effectFn
}

// computed 基于 effect 实现
function computed(getter) {
  let value
  let dirty = true

  const effectFn = effect(getter, {
    lazy: true,
    scheduler: () => {
      dirty = true  // 依赖变化时标记为脏
      trigger(obj, 'value')  // 通知 computed 的依赖
    }
  })

  const obj = {
    get value() {
      if (dirty) {
        value = effectFn()  // 脏时重新计算
        dirty = false
      }
      track(obj, 'value')  // 收集读取 computed.value 的依赖
      return value
    }
  }

  return obj
}
```

### 4.6 Vue 2 vs Vue 3 响应式对比

| 维度 | Vue 2 | Vue 3 |
|------|-------|-------|
| 核心机制 | `Object.defineProperty` | `Proxy` |
| 劫持方式 | 逐属性劫持 | 整体对象代理 |
| 新增属性 | 需要 `$set` | 自动响应式 |
| 数组变更 | 需要变异方法 | 自动响应式 |
| 深层对象 | 初始化时递归（全量） | 访问时惰性代理（按需） |
| 性能 | 大对象初始化慢 | 按需代理，更优 |
| Map/Set | 不支持 | 原生支持 |

---

## 五、虚拟 DOM 与 Diff 算法

### 5.1 Vue 2 的 Diff 算法：双端比较

```javascript
// Vue 2 Diff：同时从新旧列表的两端进行比较
function updateChildren(oldCh, newCh, parentElm) {
  let oldStartIdx = 0
  let oldEndIdx = oldCh.length - 1
  let newStartIdx = 0
  let newEndIdx = newCh.length - 1

  while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
    if (sameVnode(oldCh[oldStartIdx], newCh[newStartIdx])) {
      // 头头对比
      patchVnode(oldCh[oldStartIdx], newCh[newStartIdx])
      oldStartIdx++; newStartIdx++
    } else if (sameVnode(oldCh[oldEndIdx], newCh[newEndIdx])) {
      // 尾尾对比
      patchVnode(oldCh[oldEndIdx], newCh[newEndIdx])
      oldEndIdx--; newEndIdx--
    } else if (sameVnode(oldCh[oldStartIdx], newCh[newEndIdx])) {
      // 头尾对比 → 移动到尾部
      patchVnode(oldCh[oldStartIdx], newCh[newEndIdx])
      parentElm.insertBefore(oldCh[oldStartIdx].elm, oldCh[oldEndIdx].elm.nextSibling)
      oldStartIdx++; newEndIdx--
    } else if (sameVnode(oldCh[oldEndIdx], newCh[newStartIdx])) {
      // 尾头对比 → 移动到头部
      patchVnode(oldCh[oldEndIdx], newCh[newStartIdx])
      parentElm.insertBefore(oldCh[oldEndIdx].elm, oldCh[oldStartIdx].elm)
      oldEndIdx--; newStartIdx++
    } else {
      // 以上四种都不匹配 → key 查找映射表
      // 建立旧节点 key → index 的映射
      const idxInOld = oldKeyToIdx[newCh[newStartIdx].key]
      if (!idxInOld) {
        // 新节点
        createElm(newCh[newStartIdx], parentElm, oldCh[oldStartIdx].elm)
      } else {
        // 找到旧节点，移动
        const nodeToMove = oldCh[idxInOld]
        patchVnode(nodeToMove, newCh[newStartIdx])
        parentElm.insertBefore(nodeToMove.elm, oldCh[oldStartIdx].elm)
        oldCh[idxInOld] = undefined  // 标记已处理
      }
      newStartIdx++
    }
  }
  // 处理剩余节点...
}
```

### 5.2 Vue 3 的 Diff 算法：最长递增子序列

```javascript
// Vue 3 Diff 核心思路：
// 1. 从头同步相同前缀
// 2. 从尾同步相同后缀
// 3. 中间部分用最长递增子序列（LIS）最小化 DOM 移动

function patchKeyedChildren(c1, c2, container) {
  let i = 0
  const l2 = c2.length
  let e1 = c1.length - 1
  let e2 = l2 - 1

  // Step 1: 从头同步
  while (i <= e1 && i <= e2 && isSameType(c1[i], c2[i])) {
    patch(c1[i], c2[i], container)
    i++
  }

  // Step 2: 从尾同步
  while (i <= e1 && i <= e2 && isSameType(c1[e1], c2[e2])) {
    patch(c1[e1], c2[e2], container)
    e1--; e2--
  }

  // Step 3: 旧节点处理完毕，新节点有剩余 → 挂载
  if (i > e1) {
    if (i <= e2) {
      while (i <= e2) {
        mount(c2[i], container, c2[e2 + 1]?.el)
        i++
      }
    }
    return
  }

  // Step 4: 新节点处理完毕，旧节点有剩余 → 卸载
  if (i > e2) {
    while (i <= e1) {
      unmount(c1[i])
      i++
    }
    return
  }

  // Step 5: 中间未处理的乱序部分
  const s1 = i, s2 = i
  const keyToNewIndexMap = new Map()
  for (i = s2; i <= e2; i++) {
    keyToNewIndexMap.set(c2[i].key, i)
  }

  // 建立 新index → 旧index 的映射
  const newIndexToOldIndexMap = new Array(e2 - s2 + 1).fill(0)
  for (i = s1; i <= e1; i++) {
    const newIndex = keyToNewIndexMap.get(c1[i].key)
    if (newIndex !== undefined) {
      newIndexToOldIndexMap[newIndex - s2] = i + 1  // +1 避免与 0 混淆
      patch(c1[i], c2[newIndex], container)
    } else {
      unmount(c1[i])  // 旧节点不在新列表中，卸载
    }
  }

  // Step 6: 基于最长递增子序列移动节点
  const increasingNewIndexSequence = getSequence(newIndexToOldIndexMap)
  let j = increasingNewIndexSequence.length - 1
  for (i = e2; i >= s2; i--) {
    const newIndex = i
    const oldIndex = newIndexToOldIndexMap[newIndex - s2]
    if (oldIndex === 0) {
      // 新节点，挂载
      mount(c2[i], container, c2[i + 1]?.el)
    } else if (j < 0 || i !== increasingNewIndexSequence[j]) {
      // 需要移动
      move(c2[i], container, c2[i + 1]?.el)
    } else {
      // 在最长递增子序列中，无需移动
      j--
    }
  }
}
```

**为什么用最长递增子序列？** 在乱序部分，保持相对顺序不变的节点不需要移动，只需移动不在递增子序列中的节点，最小化 DOM 操作次数。

### 5.3 Vue 2 vs Vue 3 Diff 对比

| 维度 | Vue 2 | Vue 3 |
|------|-------|-------|
| 算法 | 双端比较 | 首尾预处理 + LIS |
| 复杂度 | O(n) 平均 | O(n log n) 最坏 |
| 移动策略 | 发现可复用就移动 | LIS 最小化移动次数 |
| key 查找 | 循环遍历 / Map | Map 一次建立 |

---

## 六、编译时优化（Vue 3 的核心突破）

Vue 3 性能提升的关键不是运行时更快，而是**编译器更聪明，让运行时做更少的事**。

### 6.1 静态提升（Static Hoisting）

```html
<template>
  <div>
    <p>静态文本不会变化</p>
    <p>{{ dynamicContent }}</p>
  </div>
</template>
```

编译输出：

```javascript
// 静态节点只创建一次，缓存在 render 函数外部
const _hoisted_1 = /*#__PURE__*/ createElementVNode('p', null, '静态文本不会变化')

function render() {
  return createElementBlock('div', null, [
    _hoisted_1,  // 复用，不会重新创建
    createElementVNode('p', null, toDisplayString(dynamicContent), 1 /* TEXT */)
  ])
}
```

### 6.2 补丁标记（PatchFlag）

```javascript
// 编译器为动态节点标记具体需要更新的部分
createVNode('p', { class: 'title' }, content, PatchFlags.TEXT)     // 只检查文本
createVNode('div', { class: dynamicClass }, content, PatchFlags.CLASS) // 只检查 class
createVNode('div', { style: dynamicStyle }, content, PatchFlags.STYLE) // 只检查 style
// PatchFlags.FULL_PROPS = 0 检查全部 props（有动态 key 时）
```

| PatchFlag | 值 | 含义 |
|-----------|---|------|
| TEXT | 1 | 动态文本内容 |
| CLASS | 2 | 动态 class 绑定 |
| STYLE | 4 | 动态 style 绑定 |
| PROPS | 8 | 动态非 class/style 属性 |
| FULL_PROPS | 16 | 有动态 key，需全量 diff |
| EVENT | 32 | 有事件监听器 |
| ... | ... | ... |

**效果**：Diff 时跳过静态节点，动态节点只检查标记的部分，大幅减少对比工作量。

### 6.3 Block Tree

```html
<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <p v-if="show">条件内容</p>
    <ul>
      <li v-for="item in list" :key="item.id">{{ item.name }}</li>
    </ul>
  </div>
</template>
```

```javascript
// 根节点是一个 Block，收集所有动态子代（扁平数组）
// 不需要递归遍历整棵虚拟 DOM 树
function render() {
  return createBlock('div', { class: 'container' }, [
    createVNode('h1', null, title, PatchFlags.TEXT),
    show ? createVNode('p', null, '条件内容') : createCommentVNode('v-if'),
    createBlock('ul', null, [
      renderList(list, (item) => {
        return createVNode('li', { key: item.id }, item.name, PatchFlags.TEXT)
      })
    ])
  ])
}

// Block 的 dynamicChildren：扁平数组，只包含动态节点
// [h1VNode, pVNode(或 comment), ...liVNodes]
// Diff 时直接遍历这个扁平数组，跳过所有静态节点
```

### 6.4 Vue 2 vs Vue 3 编译对比

```
Vue 2 编译策略：
  render() → 创建完整虚拟 DOM 树 → 全量 Diff → 更新
  编译器做的事少，运行时做的事多

Vue 3 编译策略：
  render() → 创建 Block（只含动态节点的扁平数组）→ 精确 Diff → 更新
  编译器做的事多，运行时做的事少
```

| 维度 | Vue 2 | Vue 3 |
|------|-------|-------|
| 静态节点 | 每次渲染都创建 | 提升到外部，只创建一次 |
| Diff 范围 | 全量对比 | 只对比动态节点 |
| 节点信息 | 无标记 | PatchFlag 标记具体变化类型 |
| 树遍历 | 递归遍历整棵树 | Block 扁平数组 |
| 模板越静态 | 收益越小 | 收益越大 |

---

## 七、Vue 3 架构重设计

### 7.1 Monorepo 结构

```
Vue 2（单一包）：
  vue/
    ├── src/
    │   ├── core/       # 响应式、VNode、组件
    │   ├── compiler/   # 模板编译
    │   ├── platforms/   # 平台相关（web/weex）
    │   └── server/      # SSR

Vue 3（Monorepo，按职责拆包）：
  packages/
    ├── reactivity/          # 响应式系统（独立可用，不依赖 Vue）
    ├── runtime-core/        # 运行时核心（组件、VNode、调度器）
    ├── runtime-dom/         # DOM 平台实现
    ├── runtime-test/        # 测试用运行时
    ├── compiler-core/       # 编译器核心（AST 生成、优化、代码生成）
    ├── compiler-dom/        # DOM 平台编译器
    ├── compiler-sfc/        # SFC（.vue 文件）编译器
    ├── compiler-ssr/        # SSR 编译器
    ├── vue/                 # 完整版（整合所有包）
    └── vue-compat/          # Vue 2 兼容构建
```

**核心设计**：包之间的依赖关系形成清晰的层级，`reactivity` 可以脱离 Vue 单独使用。

### 7.2 Tree-shaking 友好

```javascript
// Vue 2：全量引入
import Vue from 'vue'  // 整个 Vue 被打包

// Vue 3：按需引入，未使用的 API 不会出现在 bundle 中
import { ref, computed, watch, onMounted } from 'vue'
// Transition、KeepAlive、v-model 等未使用则不会打包

// 甚至可以只使用响应式系统
import { reactive, effect } from '@vue/reactivity'
// 包体积极小（约 3KB gzipped）
```

### 7.3 自定义渲染器

```javascript
// Vue 3 的 runtime-core 定义了渲染器的接口
// 任何人可以实现自己的渲染器

import { createRenderer } from '@vue/runtime-core'

const { render, createApp } = createRenderer({
  createElement(type) { /* 创建元素 */ },
  insert(child, parent, anchor) { /* 插入节点 */ },
  remove(child) { /* 移除节点 */ },
  setElementText(node, text) { /* 设置文本 */ },
  patchProp(el, key, prevVal, nextVal) { /* 更新属性 */ },
  // ...
})

// 已有实现：
// - @vue/runtime-dom（浏览器 DOM）
// - vue-native-core（React Native）
// - vue-three-fiber（Three.js / WebGL）
// - @vue-canvas/core（Canvas）
```

---

## 八、关键特性深入

### 8.1 Teleport（传送门）

```vue
<!-- 将弹窗渲染到 body 下，不受父级 overflow:hidden 影响 -->
<Teleport to="body">
  <div v-if="showModal" class="modal">
    <p>弹窗内容</p>
    <button @click="showModal = false">关闭</button>
  </div>
</Teleport>
```

### 8.2 Suspense

```vue
<Suspense>
  <template #default>
    <!-- 异步组件 -->
    <AsyncComponent />
  </template>
  <template #fallback>
    <div>加载中...</div>
  </template>
</Suspense>
```

```javascript
// 异步组件定义
const AsyncComponent = defineAsyncComponent(() =>
  import('./HeavyComponent.vue')
)
```

### 8.3 Fragment（片段）

```vue
<!-- Vue 2：必须有单一根节点 -->
<template>
  <div>  <!-- 必须包裹 -->
    <h1>标题</h1>
    <p>内容</p>
  </div>
</template>

<!-- Vue 3：支持多根节点 -->
<template>
  <h1>标题</h1>
  <p>内容</p>
</template>
```

### 8.4 Provide / Inject（跨层级传递）

```javascript
// 祖先组件
import { provide, ref } from 'vue'
const theme = ref('dark')
provide('theme', theme)       // 提供响应式数据
provide('themeKey', 'theme')  // 用 Symbol 作 key 更好

// 后代组件（任意深度）
import { inject } from 'vue'
const theme = inject('theme', 'light')  // 第二个参数是默认值
```

### 8.5 自定义指令变更

```javascript
// Vue 2：指令钩子与组件生命周期对齐
Vue.directive('focus', {
  bind(el) { /* 元素首次绑定 */ },
  inserted(el) { el.focus() },    // 元素插入父节点时
  update(el) { /* VNode 更新 */ },
  componentUpdated(el) { /* VNode 及其子 VNode 全部更新 */ },
  unbind() { /* 解绑 */ }
})

// Vue 3：钩子重命名，与组件生命周期命名统一
app.directive('focus', {
  created(el) { /* 元素创建后，属性/事件之前 */ },
  beforeMount(el) { /* ... */ },
  mounted(el) { el.focus() },       // 对应旧 inserted
  beforeUpdate(el) { /* ... */ },   // 新增
  updated(el) { /* ... */ },        // 合并旧 update + componentUpdated
  beforeUnmount(el) { /* ... */ },  // 新增
  unmounted(el) { /* ... */ }       // 对应旧 unbind
})
```

| Vue 2 | Vue 3 | 说明 |
|-------|-------|------|
| `bind` | `beforeMount` / `created` | 元素绑定 |
| `inserted` | `mounted` | 元素插入 DOM |
| `update` | `updated` | VNode 更新 |
| `componentUpdated` | `updated`（合并） | 子节点也更新完毕 |
| — | `beforeUpdate`（新增） | VNode 更新前 |
| `unbind` | `unmounted` | 元素卸载 |

### 8.6 渲染函数变更

```javascript
// Vue 2 渲染函数
export default {
  render(h) {
    return h('div', { class: 'container', on: { click: this.handleClick } }, [
      h('p', this.message)
    ])
  }
}

// Vue 3 渲染函数
import { h, withDirectives, resolveComponent } from 'vue'

export default {
  // h 函数作为 import 导入，不再作为参数传入
  render() {
    // 事件监听器不再需要 on 前缀嵌套
    // 直接写在 props 对象中，以 onXxx 命名
    return h('div', { class: 'container', onClick: this.handleClick }, [
      h('p', this.message)
    ])
  }
}
```

**主要变更：**

| 变更点 | Vue 2 | Vue 3 |
|--------|-------|-------|
| h 函数来源 | `render(h)` 参数 | `import { h } from 'vue'` |
| 事件绑定 | `{ on: { click: fn } }` | `{ onClick: fn }` |
| 插槽 | `this.$slots.default` | `this.$slots.default?.()` |
| 组件注册 | `components: { MyComp }` | `resolveComponent('MyComp')` |

### 8.7 组件 v-model 变更

```vue
<!-- Vue 2：v-model 默认使用 value prop + input 事件 -->
<!-- Child.vue -->
<script>
export default {
  props: ['value'],
  methods: {
    update(val) {
      this.$emit('input', val)  // 触发 input 事件
    }
  }
}
</script>

<!-- Vue 3：v-model 默认使用 modelValue prop + update:modelValue 事件 -->
<!-- Child.vue -->
<script setup>
const props = defineProps(['modelValue'])
const emit = defineEmits(['update:modelValue'])

function update(val) {
  emit('update:modelValue', val)
}
</script>
```

```vue
<!-- Vue 3 支持多个 v-model（替代 .sync 修饰符） -->
<UserForm
  v-model:first-name="firstName"
  v-model:last-name="lastName"
/>

<!-- 等价于 -->
<UserForm
  :first-name="firstName"
  @update:first-name="firstName = $event"
  :last-name="lastName"
  @update:last-name="lastName = $event"
/>
```

| 变更 | Vue 2 | Vue 3 |
|------|-------|-------|
| 默认 prop | `value` | `modelValue` |
| 默认事件 | `@input` | `@update:modelValue` |
| 多个双向绑定 | `.sync` 修饰符 | `v-model:xxx` |
| 自定义修饰符 | 不支持 | `v-model.capitalize` 支持 |

---

## 九、Vue 生态：路由与状态管理

### 9.1 Vue Router 3 vs Vue Router 4

**问题来源**：Vue Router 4 随 Vue 3 重新设计，API 有大量破坏性变更。理解这些变更是迁移的核心工作之一。

#### 初始化方式

```javascript
// Vue Router 3 (Vue 2)
import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const router = new VueRouter({
  routes: [
    { path: '/', component: Home },
    { path: '/user/:id', component: User, props: true }
  ]
})

new Vue({ router }).$mount('#app')

// Vue Router 4 (Vue 3)
import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'

const router = createRouter({
  // Vue Router 3 默认 hash 模式，4 默认 history 模式
  history: createWebHistory(),  // 替代 mode: 'history'
  // history: createWebHashHistory(), // 替代 mode: 'hash'
  routes: [
    { path: '/', component: Home },
    { path: '/user/:id', component: User, props: true }
  ]
})

createApp(App).use(router).mount('#app')
```

#### 导航守卫完整解析

**问题来源**：路由守卫是前端权限控制的核心手段，但很多开发者只用过 `beforeEach` 做登录拦截。实际项目中，权限校验、数据预载、页面标题、埋点统计、离开确认等场景需要不同类型的守卫配合，理解守卫的执行顺序和适用场景至关重要。

##### 三类守卫全景

```
导航触发
  │
  ├─ ① 导航被触发
  │
  ├─ ② 在失活的组件里调用 beforeRouteLeave（组件内守卫）
  │
  ├─ ③ 调用全局的 beforeEach（全局前置守卫）
  │
  ├─ ④ 在重用的组件里调用 beforeRouteUpdate（组件内守卫）
  │    例：/user/1 → /user/2，同一个 User 组件被复用
  │
  ├─ ⑤ 在路由配置里调用 beforeEnter（路由独享守卫）
  │
  ├─ ⑥ 解析异步路由组件
  │
  ├─ ⑦ 在被激活的组件里调用 beforeRouteEnter（组件内守卫）
  │
  ├─ ⑧ 调用全局的 beforeResolve（全局解析守卫）
  │    ——此时所有守卫和异步组件都已完成，导航已确认——
  │
  ├─ ⑨ 导航被确认
  │
  ├─ ⑩ 调用全局的 afterEach（全局后置钩子）
  │
  └─ ⑪ 触发 DOM 更新 / 调用 beforeRouteEnter 的 next 回调
```

##### 1. 全局守卫

```javascript
// ====== beforeEach：全局前置守卫（最常用）======
// 适用场景：登录校验、权限判断、动态路由加载、进度条

// Vue Router 3 写法
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    next('/login')
  } else {
    next()
  }
})

// Vue Router 4 写法：返回值替代 next()
router.beforeEach(async (to, from) => {
  // 返回 false → 取消导航
  // 返回 路径/路由对象 → 重定向
  // 返回 undefined（或不 return）→ 放行

  // 场景 1：登录校验
  if (to.meta.requiresAuth && !isAuthenticated()) {
    return {
      path: '/login',
      query: { redirect: to.fullPath }  // 登录后跳回原页面
    }
  }

  // 场景 2：动态路由首次加载
  // 用户登录后，根据角色动态注册路由（详见下方动态路由章节）
  if (!store.state.permission.routesLoaded) {
    const routes = await fetchUserRoutes()
    routes.forEach(route => router.addRoute(route))
    return to.fullPath  // 重新导航，确保新路由已注册
  }
})

// ====== beforeResolve：全局解析守卫 ======
// 适用场景：所有守卫完成后、导航确认前的最后拦截
// 常用于确保异步数据获取完成

router.beforeResolve(async (to) => {
  // 所有路由守卫和异步组件解析完毕后执行
  // 适合做需要确保一切就绪的操作
  if (to.meta.requiresData) {
    try {
      await store.dispatch('fetchCriticalData')
    } catch (error) {
      return false  // 数据获取失败，阻止导航
    }
  }
})

// ====== afterEach：全局后置钩子 ======
// 适用场景：页面标题设置、埋点统计、进度条结束、面包屑更新
// 注意：不接受 next/返回值，无法改变导航结果

router.afterEach((to, from) => {
  // 页面标题
  document.title = to.meta.title || '默认标题'

  // 埋点统计
  trackPageView({
    from: from.path,
    to: to.path,
    title: to.meta.title,
    timestamp: Date.now()
  })

  // 进度条结束
  NProgress.done()
})
```

##### 2. 路由独享守卫

```javascript
const routes = [
  {
    path: '/admin',
    component: Admin,
    meta: { title: '管理后台' },
    // beforeEnter：只在此路由生效
    // 适用场景：特定页面的进入条件（不污染全局逻辑）
    beforeEnter: (to, from) => {
      // 独立的权限检查
      if (!hasRole('admin')) {
        return { path: '/403' }
      }
    }
  },
  {
    path: '/editor/:id',
    component: Editor,
    // 支持数组形式，按顺序执行
    beforeEnter: [
      checkAuth,           // 检查登录
      checkPermission,     // 检查权限
      loadDraft            // 预加载草稿
    ]
  }
]

function checkAuth(to, from) {
  if (!isAuthenticated()) return '/login'
}

function checkPermission(to, from) {
  if (!hasPermission('editor', to.params.id)) return '/403'
}

async function loadDraft(to, from) {
  // 可以在这里预加载数据
  await store.dispatch('editor/loadDraft', to.params.id)
}
```

##### 3. 组件内守卫

```javascript
// Vue Router 3 (Options API)
export default {
  // beforeRouteEnter：进入前（此时组件实例还未创建，无法访问 this）
  beforeRouteEnter(to, from, next) {
    // 不能访问 this，但可以通过 next(vm => {}) 在挂载后访问
    next(vm => {
      vm.fetchData(to.params.id)
    })
  },

  // beforeRouteUpdate：路由参数变化时（同一组件复用）
  // 例：/user/1 → /user/2
  beforeRouteUpdate(to, from, next) {
    // this 已可用
    this.userId = to.params.id
    this.fetchUser()
    next()
  },

  // beforeRouteLeave：离开前
  // 适用场景：表单未保存提示、离开确认
  beforeRouteLeave(to, from, next) {
    if (this.hasUnsavedChanges) {
      const confirmed = window.confirm('有未保存的更改，确定离开？')
      next(confirmed)  // false 取消离开，true 允许
    } else {
      next()
    }
  }
}
```

```vue
<!-- Vue Router 4 (Composition API) -->
<script setup>
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

// beforeRouteEnter 在 setup 中不需要（setup 本身就是"进入时"）
// 直接在 setup 顶层执行初始化逻辑即可
const route = useRoute()
fetchUser(route.params.id)

// beforeRouteUpdate
onBeforeRouteUpdate(async (to, from) => {
  // 路由参数变化时重新加载数据
  await fetchUser(to.params.id)
  // 返回 false 可取消导航
})

// beforeRouteLeave
onBeforeRouteLeave((to, from) => {
  if (hasUnsavedChanges.value) {
    const confirmed = window.confirm('有未保存的更改，确定离开？')
    if (!confirmed) return false
  }
})
</script>
```

##### 守卫选型指南

| 守卫类型 | 适用场景 | 典型用途 |
|---------|---------|---------|
| `beforeEach` | 所有页面都需要检查的逻辑 | 登录校验、动态路由加载、NProgress 开始 |
| `beforeResolve` | 需要确保所有守卫都通过后 | 关键数据预载、导航最终确认 |
| `afterEach` | 导航完成后的副作用 | 页面标题、埋点、进度条结束 |
| `beforeEnter` | 特定路由的进入条件 | 页面级权限、特定数据预载 |
| `beforeRouteEnter` | 进入组件前（无法访问 this） | 预取数据传给组件（Vue 2 常用） |
| `beforeRouteUpdate` | 同一组件路由参数变化 | `/user/1` → `/user/2` 重新加载 |
| `beforeRouteLeave` | 离开组件前 | 表单未保存确认、资源清理 |

**常见陷阱**：
- `beforeEach` 中忘记处理 `next()`（Vue Router 3）或忘记返回（Vue Router 4），导致导航卡死
- `beforeRouteUpdate` 被忽略——`/user/1 → /user/2` 组件复用时不触发 `created/mounted`，数据不更新
- 守卫中做异步操作但没有 `await`，导致竞态问题
- 多个 `beforeEach` 注册顺序不明确——执行顺序按注册顺序，注意拆分逻辑时的先后依赖

---

#### 动态路由

**问题来源**：后台管理系统中，不同角色（管理员、普通用户、访客）看到的菜单和页面不同。如果所有路由都静态注册，用户可以通过地址栏直接访问无权限页面。动态路由是根据用户权限在运行时按需注册路由的方案。

##### 方案一：前端静态路由 + 权限过滤

```javascript
// router/routes.js — 声明所有路由，标记所需权限
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '仪表盘', roles: ['admin', 'user'] }  // 所有登录用户可见
  },
  {
    path: '/user',
    component: () => import('@/views/UserManage.vue'),
    meta: { title: '用户管理', roles: ['admin'] }          // 仅管理员
  },
  {
    path: '/role',
    component: () => import('@/views/RoleManage.vue'),
    meta: { title: '角色管理', roles: ['admin'] }
  },
  {
    path: '/profile',
    component: () => import('@/views/Profile.vue'),
    meta: { title: '个人中心', roles: ['admin', 'user'] }
  }
]

// router/index.js — 只注册公共路由，动态路由按权限过滤后注册
import { createRouter, createWebHistory } from 'vue-router'

// 公共路由（登录页、404 等）始终注册
const constantRoutes = [
  { path: '/login', component: () => import('@/views/Login.vue') },
  { path: '/403', component: () => import('@/views/403.vue') },
  { path: '/:pathMatch(.*)*', component: () => import('@/views/404.vue') }
]

const router = createRouter({
  history: createWebHistory(),
  routes: constantRoutes  // 初始只有公共路由
})

// 根据角色过滤并动态注册路由
function filterRoutesByRole(allRoutes, roles) {
  return allRoutes.filter(route => {
    const requiredRoles = route.meta?.roles
    if (!requiredRoles) return true  // 无权限要求的路由全部保留
    return requiredRoles.some(role => roles.includes(role))
  })
}

// 登录成功后调用
export function addDynamicRoutes(userRoles) {
  const allowed = filterRoutesByRole(routes, userRoles)
  allowed.forEach(route => {
    // 避免重复注册
    if (!router.hasRoute(route.path)) {
      router.addRoute(route)
    }
  })
  // 动态路由加载完成后，添加 404 兜底（必须在最后）
  router.addRoute({ path: '/:pathMatch(.*)*', component: () => import('@/views/404.vue') })
}
```

##### 方案二：后端返回路由配置（运行时注册）

```javascript
// 后端接口返回用户的路由配置（JSON）
// GET /api/user/routes
// 响应示例：
// [
//   { path: '/dashboard', component: 'Dashboard', meta: { title: '仪表盘' } },
//   { path: '/user',      component: 'UserManage', meta: { title: '用户管理' } },
//   { path: '/settings',  component: 'Settings',
//     children: [
//       { path: 'profile', component: 'SettingsProfile', meta: { title: '个人设置' } },
//       { path: 'security', component: 'SettingsSecurity', meta: { title: '安全设置' } }
//     ]
//   }
// ]

// 将后端路由字符串映射为懒加载组件
const componentMap = {
  Dashboard: () => import('@/views/Dashboard.vue'),
  UserManage: () => import('@/views/UserManage.vue'),
  Settings: () => import('@/views/Settings.vue'),
  SettingsProfile: () => import('@/views/settings/Profile.vue'),
  SettingsSecurity: () => import('@/views/settings/Security.vue'),
  // ...
}

function buildRoutesFromBackend(backendRoutes) {
  return backendRoutes.map(route => ({
    path: route.path,
    component: componentMap[route.component],
    meta: route.meta,
    children: route.children ? buildRoutesFromBackend(route.children) : undefined
  }))
}

// 在 beforeEach 中加载
let routesLoaded = false

router.beforeEach(async (to, from) => {
  const token = getToken()
  if (!token) {
    if (to.path !== '/login') return '/login'
    return  // 放行到登录页
  }

  // 首次加载动态路由
  if (!routesLoaded) {
    try {
      const backendRoutes = await api.getUserRoutes()
      const dynamicRoutes = buildRoutesFromBackend(backendRoutes)
      dynamicRoutes.forEach(route => router.addRoute(route))
      // 404 必须在动态路由之后注册
      router.addRoute({ path: '/:pathMatch(.*)*', redirect: '/404' })
      routesLoaded = true
      return to.fullPath  // 重新触发导航，确保新路由生效
    } catch (error) {
      // token 过期或接口异常
      removeToken()
      return '/login'
    }
  }
})
```

##### 方案三：后端返回菜单 + 前端映射（推荐实践）

```javascript
// 结合方案一和方案二的优点：
// - 后端返回菜单列表（含权限标识）
// - 前端维护完整的路由表（含组件映射）
// - 通过权限标识匹配，既安全又灵活

// 1. 前端完整路由表（带权限标识）
const asyncRoutes = [
  {
    path: '/system',
    component: Layout,
    meta: { title: '系统管理', icon: 'setting' },
    children: [
      {
        path: 'user',
        component: () => import('@/views/system/User.vue'),
        meta: { title: '用户管理', permission: 'system:user:list' }
      },
      {
        path: 'role',
        component: () => import('@/views/system/Role.vue'),
        meta: { title: '角色管理', permission: 'system:role:list' }
      },
      {
        path: 'menu',
        component: () => import('@/views/system/Menu.vue'),
        meta: { title: '菜单管理', permission: 'system:menu:list' }
      }
    ]
  }
]

// 2. 后端返回用户的权限列表
// GET /api/user/permissions
// 响应：['system:user:list', 'system:role:list', 'dashboard:view']

// 3. 根据权限过滤路由
function filterAsyncRoutes(routes, permissions) {
  return routes.reduce((acc, route) => {
    const required = route.meta?.permission
    // 无权限要求 或 用户有对应权限
    if (!required || permissions.includes(required)) {
      const cloned = { ...route }
      if (cloned.children) {
        cloned.children = filterAsyncRoutes(cloned.children, permissions)
      }
      // 只添加有可见子路由的父路由
      if (!cloned.children || cloned.children.length > 0) {
        acc.push(cloned)
      }
    }
    return acc
  }, [])
}
```

##### 三种方案对比

| 维度 | 方案一：前端过滤 | 方案二：后端路由 | 方案三：混合映射 |
|------|---------------|----------------|----------------|
| 路由来源 | 前端全部定义 | 后端动态返回 | 前端定义 + 后端权限过滤 |
| 安全性 | 低（代码中可见所有路由） | 高（路由由后端控制） | 中（前端可见，但运行时按权限加载） |
| 灵活性 | 低（新增页面需发版） | 高（后端配置即可） | 中（页面需发版，权限可动态调整） |
| 前端工作量 | 小 | 中（需维护组件映射表） | 中 |
| 后端工作量 | 小 | 大（需维护路由配置） | 中（只需维护权限列表） |
| 菜单一致性 | 路由即菜单 | 需额外处理 | 天然一致 |
| 适用团队 | 小团队、角色简单 | 权限模型复杂、需动态配置 | 中大型项目、RBAC 权限 |

**适配场景**：
- **小项目/角色简单**：方案一足够，开发快
- **SaaS/多租户/复杂权限**：方案二最灵活，后端完全控制
- **中大型后台管理**：方案三是业界主流，平衡了安全性和可维护性

**局限性**：
- 无论哪种方案，**后端接口的权限校验不可省略**——前端路由守卫只是 UX 层面的控制，不能替代后端鉴权
- 动态路由刷新页面后会丢失（因为路由是运行时注册的），需要在 `beforeEach` 中重新加载
- 方案二中组件映射表需要人工维护，新增页面容易遗漏
- `addRoute` 后必须用 `router.push(to.fullPath)` 或 `return to.fullPath` 重新触发导航

##### 动态路由匹配语法（Vue Router 4）

```javascript
// 动态路径参数
{ path: '/user/:id', component: User }
// 匹配：/user/1, /user/abc
// 获取：route.params.id

// 可选参数（Vue Router 4 新增）
{ path: '/user/:id?', component: User }
// 匹配：/user, /user/1

// 可重复参数
{ path: '/files/:path+', component: Files }
// 匹配：/files/a, /files/a/b, /files/a/b/c
// route.params.path → 'a' 或 'a/b' 或 'a/b/c'

{ path: '/files/:path*', component: Files }
// 匹配：/files, /files/a, /files/a/b（path 可选且可重复）

// 自定义正则约束
{ path: '/user/:id(\\d+)', component: User }      // 只匹配数字
{ path: '/article/:slug([a-z0-9-]+)', component: Article }  // 只匹配 slug 格式

// 404 捕获
// Vue Router 3
{ path: '*', component: NotFound }
// Vue Router 4
{ path: '/:pathMatch(.*)*', component: NotFound }
```

##### 路由懒加载策略

```javascript
// 1. 基础懒加载：每个路由独立 chunk
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard.vue')  // 生成单独的 chunk
  }
]

// 2. 分组打包：将相关页面打包到同一个 chunk
const routes = [
  {
    path: '/system/user',
    component: () => import(/* webpackChunkName: "system" */ '@/views/system/User.vue')
  },
  {
    path: '/system/role',
    component: () => import(/* webpackChunkName: "system" */ '@/views/system/Role.vue')
  }
  // system 下的页面会被打包到同一个 JS 文件
]

// 3. Vite 的分组方式
const User = () => import('@/views/system/User.vue')
// Vite 自动按目录分组，也可手动命名：
const Role = () => import('@/views/system/Role.vue')

// 4. 预加载：鼠标悬停时预加载
// 结合 router-link 的自定义行为
<router-link
  :to="item.path"
  @mouseenter="prefetch(item.component)"
>
  {{ item.title }}
</router-link>

function prefetch(componentLoader) {
  componentLoader()  // 触发 import() 预加载
}
```

#### 组合式 API 中的路由

```javascript
// Vue Router 4 提供 useRoute / useRouter
import { useRoute, useRouter } from 'vue-router'

export default {
  setup() {
    const route = useRoute()     // 响应式路由对象
    const router = useRouter()   // 路由实例

    // 不再需要 watch $route
    watch(
      () => route.params.id,
      (newId) => { fetchUser(newId) }
    )

    function goBack() {
      router.back()
    }

    return { route, goBack }
  }
}
```

#### Vue Router 3 vs 4 总结对比

| 维度 | Vue Router 3 | Vue Router 4 |
|------|-------------|-------------|
| 初始化 | `new VueRouter()` | `createRouter()` |
| History 模式 | `mode: 'history'` | `history: createWebHistory()` |
| 导航守卫 | `next()` 回调（必须调用） | 返回值（`false`/路径/`undefined`） |
| 动态添加路由 | `addRoutes(routes)` | `addRoute(route)` / `removeRoute(name)` |
| 路由匹配 | `path: '*'` 通配 | `path: '/:pathMatch(.*)*'` + 正则约束 |
| 可选/重复参数 | 不支持 | `:id?` / `:id+` / `:id*` |
| Composition API | 无 | `useRoute()` / `useRouter()` / `onBeforeRouteUpdate` / `onBeforeRouteLeave` |
| 编码方式 | 保留编码 | 自动解码 |
| 组件内守卫 | Options API 钩子 | `onBeforeRouteUpdate` / `onBeforeRouteLeave` |

**局限性**：
- Vue Router 4 不支持 IE11（Proxy 依赖）
- 从 `next()` 模式迁移到返回值模式，需要逐个检查守卫逻辑
- 动态路由刷新后会丢失，必须在 `beforeEach` 中重新加载
- `beforeRouteEnter` 在 Composition API 中无对应 hook（因为 setup 本身即"进入时"）

---

### 9.2 Vuex vs Pinia

**问题来源**：Vue 3 官方推荐 Pinia 替代 Vuex。很多团队面临选择——新项目直接用 Pinia 还是继续用 Vuex 4？旧项目的 Vuex 该不该迁移？

#### Vuex 4（Vue 3 兼容版）

```javascript
// store/index.js
import { createStore } from 'vuex'

const store = createStore({
  state() {
    return {
      user: null,
      cart: []
    }
  },
  getters: {
    cartTotal: (state) => state.cart.reduce((sum, item) => sum + item.price, 0),
    cartCount: (state) => state.cart.length
  },
  mutations: {
    SET_USER(state, user) { state.user = user },
    ADD_TO_CART(state, item) { state.cart.push(item) },
    CLEAR_CART(state) { state.cart = [] }
  },
  actions: {
    async login({ commit }, credentials) {
      const user = await authApi.login(credentials)
      commit('SET_USER', user)
    },
    async addToCart({ commit, state }, item) {
      if (state.cart.find(i => i.id === item.id)) return
      commit('ADD_TO_CART', item)
    }
  },
  // 模块嵌套
  modules: {
    products: {
      namespaced: true,
      state: () => ({ list: [] }),
      mutations: { SET_LIST(state, list) { state.list = list } },
      actions: { async fetchList({ commit }) { /* ... */ } }
    }
  }
})

// 组件中使用
import { useStore } from 'vuex'
import { computed } from 'vue'

setup() {
  const store = useStore()
  const user = computed(() => store.state.user)
  const cartTotal = computed(() => store.getters.cartTotal)

  return {
    user,
    cartTotal,
    login: (creds) => store.dispatch('login', creds),
    addToCart: (item) => store.dispatch('addToCart', item)
  }
}
```

#### Pinia（官方推荐）

```javascript
// stores/cart.js — 每个 Store 独立文件，无需模块嵌套
import { defineStore } from 'pinia'

// 定义方式一：Option Store（类似 Vuex 风格）
export const useCartStore = defineStore('cart', {
  state: () => ({
    items: []
  }),
  getters: {
    total: (state) => state.items.reduce((sum, i) => sum + i.price, 0),
    count: (state) => state.items.length
  },
  actions: {
    addItem(item) {
      // 直接修改 state，不需要 mutation
      if (this.items.find(i => i.id === item.id)) return
      this.items.push(item)
    },
    clear() {
      this.items = []  // 直接替换，无需 mutation
    },
    // action 支持异步
    async syncToServer() {
      await api.syncCart(this.items)
    }
  }
})

// 定义方式二：Setup Store（Composition API 风格）
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  // ref() = state
  const user = ref(null)
  const token = ref('')

  // computed() = getters
  const isLoggedIn = computed(() => !!token.value)
  const userName = computed(() => user.value?.name ?? '游客')

  // function = actions
  async function login(credentials) {
    const res = await authApi.login(credentials)
    user.value = res.user
    token.value = res.token
  }

  function logout() {
    user.value = null
    token.value = ''
  }

  return { user, token, isLoggedIn, userName, login, logout }
})

// 组件中使用——更简洁
import { useCartStore, useUserStore } from '@/stores'

const cart = useCartStore()
cart.addItem(item)             // 直接调用 action
cart.items                     // 直接访问 state
cart.total                     // 直接访问 getter
cart.$patch({ items: [] })     // 批量更新
cart.$reset()                  // 重置到初始状态
```

#### 多方案对比

| 维度 | Vuex 4 | Pinia |
|------|--------|-------|
| 设计理念 | 单一状态树 + 严格单向数据流 | 多 Store + 灵活状态管理 |
| 修改 state | 必须通过 mutation（同步） | 直接修改或 action（同步/异步均可） |
| TypeScript | 需要大量类型声明辅助 | 天然类型推导，无需额外配置 |
| 模块化 | `modules` + `namespaced` | 每个 Store 独立文件，天然模块化 |
| 代码量 | 多（mutations + actions + types） | 少（可省略 mutations） |
| DevTools | 支持 | 支持（Vue DevTools 原生集成） |
| SSR | 需要额外处理 | 内置支持 |
| 包体积 | ~10KB | ~1.5KB |
| Vue 2 兼容 | 是 | 是（pinia@2） |

#### 适配场景

- **Vuex 4**：已有的 Vuex 大型项目、团队已熟悉 Vuex 模式、需要严格的同步/异步分离约束
- **Pinia**：新项目（无论 Vue 2 还是 Vue 3）、中小型项目、需要 TypeScript 友好、希望减少模板代码

**局限性**：
- Vuex 的 mutation 约束虽然增加了样板代码，但在大型团队中强制了状态修改的可追踪性
- Pinia 直接修改 state 虽然灵活，但缺乏严格的修改审计机制，需要团队规范约束
- Pinia 没有 Vuex 的 `plugins` 中 `store.subscribe` 等高级钩子，部分场景需自行实现

---

## 十、TypeScript 集成

### 10.1 为什么 Vue 3 重写了 TypeScript 支持

**问题来源**：Vue 2 的 TypeScript 支持依赖 `vue-class-component` 和 `vue-property-decorator`，类型推导不完整，`this` 上大量属性无法推断。Vue 3 从底层重写，让 Composition API 天然支持 TypeScript。

#### Vue 2 的 TypeScript 痛点

```typescript
// Vue 2 + TypeScript：依赖 class 风格，类型推导差
import { Vue, Component, Prop } from 'vue-property-decorator'

@Component({
  components: { MyComp }
})
export default class MyComponent extends Vue {
  @Prop({ type: String, required: true }) title!: string

  // data 需要声明为类属性，但无法享受 Vue 的响应式类型推导
  count = 0

  // computed 在 getter 中，this 可以推导但仍有盲区
  get doubleCount(): number {
    return this.count * 2
  }

  // methods
  increment(): void {
    this.count++  // this.count 推导为 number ✅
  }

  mounted() {
    // this.$refs.xxx 的类型永远是 Element | undefined ❌
    // this.$emit('change', this.count) 参数无校验 ❌
  }
}
```

#### Vue 3 原生 TypeScript 支持

```typescript
// Vue 3 + <script setup lang="ts">：完整类型推导
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { PropType } from 'vue'

// ref 自动推导类型
const count = ref(0)              // Ref<number>
const name = ref('')             // Ref<string>
const user = ref<User | null>(null)  // 显式泛型

// computed 自动推导返回类型
const doubleCount = computed(() => count.value * 2)  // ComputedRef<number>

// props 完整类型定义
const props = defineProps<{
  title: string
  count?: number
  items: Item[]
  callback: (id: number) => void
}>()

// 带默认值的 props（使用 withDefaults）
const props = withDefaults(defineProps<{
  title: string
  pageSize?: number
  disabled?: boolean
}>(), {
  pageSize: 10,
  disabled: false
})

// emit 类型安全
const emit = defineEmits<{
  (e: 'change', id: number): void
  (e: 'update', value: string): void
  (e: 'delete', id: number, permanent: boolean): void
}>()

emit('change', 1)         // ✅
emit('change', '1')       // ❌ 类型错误
emit('unknown')           // ❌ 不存在的事件

// 模板 ref 类型标注
const inputRef = ref<HTMLInputElement | null>(null)
onMounted(() => {
  inputRef.value?.focus()    // ✅ 完整 HTMLInputElement 类型
})
</script>
```

#### 泛型组件

```vue
<!-- Vue 3.3+ 泛型组件 -->
<script setup lang="ts" generic="T extends { id: number }">
defineProps<{
  items: T[]
  selected?: T
  renderItem: (item: T) => string
}>()

const emit = defineEmits<{
  (e: 'select', item: T): void
}>()
</script>

<!-- 使用时自动推导 -->
<GenericList
  :items="users"         <!-- T = User -->
  :renderItem="u => u.name"
  @select="onSelect"     <!-- item 参数自动推导为 User -->
/>
```

### 10.2 TypeScript 集成对比

| 维度 | Vue 2 | Vue 3 |
|------|-------|-------|
| 基础支持 | 需要 `vue-class-component` 装饰器 | 原生支持 |
| Props 类型 | `PropType` 辅助，推导不完整 | `defineProps<T>()` 完整推导 |
| Emit 类型 | 无校验 | `defineEmits<T>()` 完全校验 |
| Ref 类型 | `this.$refs` 为 `any` | `ref<HTMLInputElement>()` 精确类型 |
| 模板中类型 | 无法检查 | Volar 插件提供模板类型检查 |
| 泛型组件 | 不支持 | Vue 3.3+ `generic` 属性 |
| composables 返回值 | 无法推导 | 自动推导，无需手动标注 |

**局限性**：
- 模板中的复杂类型推断仍需依赖 IDE 插件（Volar），命令行检查能力有限
- `reactive()` 的类型推导在解构时会丢失响应性，需要 `toRefs` 辅助
- 迁移大型 Vue 2 + JavaScript 项目到 TypeScript 工作量巨大，需逐组件改造

---

## 十一、SSR 与 Nuxt

### 11.1 渲染方案对比

**问题来源**：SPA 的首屏加载慢、SEO 差是生产环境的常见问题。Vue 生态提供了 CSR、SSR、SSG 多种方案，如何选择？

| 方案 | 原理 | 首屏速度 | SEO | 服务器压力 | 适用场景 |
|------|------|---------|-----|-----------|---------|
| CSR | 浏览器渲染 | 慢（需加载 JS） | 差 | 低 | 后台管理系统、内部工具 |
| SSR | 服务端渲染 HTML | 快 | 好 | 高（每请求都渲染） | 电商、内容站、SEO 敏感 |
| SSG | 构建时生成静态 HTML | 最快 | 好 | 最低（CDN 分发） | 博客、文档、营销页 |
| ISR | 增量静态再生 | 快 | 好 | 低（按需重新生成） | 内容更新不频繁的站 |
| Hybrid | 混合模式 | 按页面选择 | 按页面选择 | 按需 | 大型综合站点 |

### 11.2 Nuxt 2 vs Nuxt 3

```javascript
// Nuxt 2 目录结构
// pages/index.vue → 自动生成路由
// store/index.js → Vuex 自动注入
// nuxt.config.js
export default {
  target: 'server',      // 或 'static'（SSG）
  modules: ['@nuxtjs/axios'],
  plugins: ['~/plugins/my-plugin'],
  middleware: ['auth']
}

// Nuxt 3 目录结构（相同约定，但引擎重写）
// pages/、server/、composables/、middleware/
// nuxt.config.ts
export default defineNuxtConfig({
  // Nitro 服务器引擎（跨平台部署）
  nitro: {
    preset: 'node-server'  // node-server / vercel / cloudflare / netlify
  },
  modules: ['@pinia/nuxt'],  // 原生 Pinia 支持
})
```

```vue
<!-- Nuxt 3 自动导入 + 数据获取 -->
<script setup>
// 无需 import，自动导入 ref/computed/useRoute 等
const { data: users, pending, error, refresh } = await useFetch('/api/users')
// useFetch：SSR 时服务端执行，客户端 hydration 后转为缓存
// useAsyncData：更灵活的数据获取，可控制缓存策略

// 路由参数
const route = useRoute()
const id = route.params.id

// SEO 头部管理
useHead({
  title: '用户列表',
  meta: [{ name: 'description', content: '用户管理页面' }]
})
</script>

<template>
  <div v-if="pending">加载中...</div>
  <div v-else-if="error">加载失败：{{ error.message }}</div>
  <ul v-else>
    <li v-for="user in users" :key="user.id">{{ user.name }}</li>
  </ul>
</template>
```

```typescript
// Nuxt 3 server/api 目录 → 自动注册 API 路由
// server/api/users.ts
export default defineEventHandler(async (event) => {
  const users = await db.user.findMany()
  return users
})

// server/api/users/[id].ts — 动态路由
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const user = await db.user.findUnique({ where: { id: Number(id) } })
  if (!user) throw createError({ statusCode: 404, message: 'User not found' })
  return user
})
```

### 11.3 对比

| 维度 | Nuxt 2 | Nuxt 3 |
|------|--------|--------|
| Vue 版本 | Vue 2 | Vue 3 |
| 渲染模式 | SSR / SSG | SSR / SSG / ISR / Hybrid |
| 服务器引擎 | 自定义 Node.js | Nitro（跨平台部署） |
| 状态管理 | Vuex（内置） | Pinia（推荐） |
| 数据获取 | `asyncData` / `fetch` | `useFetch` / `useAsyncData` |
| 自动导入 | 部分 | 全面（components/composables/utils） |
| TypeScript | 可选，配置复杂 | 原生支持，零配置 |
| 热更新 | Webpack HMR | Vite（开发）/ Webpack（构建可选） |
| API 路由 | 需要 serverMiddleware | 内置 `server/api/` 目录 |
| 部署目标 | Node.js / 静态 | Node / Serverless / Edge / 静态 |

**适配场景**：
- **新项目 + 需要 SSR/SEO**：直接 Nuxt 3
- **新项目 + 纯 SPA**：Vue 3 + Vite，不需要 Nuxt
- **已有 Nuxt 2 项目**：评估迁移成本，核心变更包括 Vuex → Pinia、`asyncData` → `useFetch`、Webpack → Vite

**局限性**：
- SSR 增加了服务器成本和部署复杂度，不是所有项目都需要
- Nuxt 3 的模块生态仍在追赶 Nuxt 2，部分社区模块尚未兼容
- SSR 环境中不能使用 `window`/`document` 等浏览器 API，需条件导入（`onMounted` 中使用或 `import.meta.client` 判断）

---

## 十二、常见问题与最佳实践

### 12.1 ref vs reactive

```javascript
// ref：可用于任意类型值，通过 .value 访问
const count = ref(0)
count.value++

const list = ref([1, 2, 3])
list.value.push(4)  // 响应式

// reactive：仅适用于对象类型，直接访问属性
const state = reactive({ count: 0, list: [1, 2, 3] })
state.count++
state.list.push(4)

// 陷阱：reactive 不能替换整个对象
state = reactive({ count: 1 })  // ❌ 丢失响应式
Object.assign(state, { count: 1 })  // ✅
```

**推荐**：基础值用 `ref`，复杂对象用 `reactive`，团队统一即可。

### 12.2 性能优化

```javascript
// 1. shallowRef / shallowReactive：只代理第一层
const bigList = shallowRef([])  // 内部元素变化不触发更新
bigList.value = [...newList]    // 替换引用触发更新

// 2. markRaw：标记对象永远不做响应式代理
const staticConfig = markRaw({ /* 不会被 reactive 处理 */ })

// 3. v-once / v-memo：编译时优化
<div v-once>{{ neverChange }}</div>
<div v-memo="[item.id]">{{ item.name }}</div>

// 4. 异步组件 + Suspense：按需加载
const HeavyChart = defineAsyncComponent(() => import('./Chart.vue'))

// 5. 虚拟列表
import { RecycleScroller } from 'vue-virtual-scroller'
```

### 12.3 Vue 2 迁移 Vue 3 检查清单

```
核心破坏性变更：
  ☐ 全局 API 挂载方式变更（new Vue → createApp）
  ☐ v-model 用法变更（value/input → modelValue/update:modelValue）
  ☐ .sync 修饰符移除 → v-model:xxx
  ☐ 事件 API 变更（$on/$off/$once 移除）
  ☐ 过滤器移除（改用 computed 或方法）
  ☐ $children 移除（改用 ref）
  ☐ $listeners 移除（合并到 $attrs）
  ☐ $scopedSlots 移除（统一为 $slots）
  ☐ 函数式组件写法变更
  ☐ 异步组件 require → defineAsyncComponent
  ☐ 自定义指令钩子重命名（bind → beforeMount 等）
  ☐ 渲染函数 h() 不再作为参数，需 import
  ☐ Transition 类名变更（v-enter → v-enter-from）

生态迁移：
  ☐ Vue Router 3 → 4（new VueRouter → createRouter、next → 返回值）
  ☐ Vuex → Pinia（mutation 移除、模块化方式变更）
  ☐ Nuxt 2 → Nuxt 3（如适用）
  ☐ UI 组件库兼容性检查（Element UI → Element Plus 等）
  ☐ 第三方插件 Vue 3 兼容版本确认

构建工具：
  ☐ Webpack → Vite（可选但推荐）
  ☐ Babel 配置简化（Vue 3 JSX 插件变更）
  ☐ ESLint 插件更新（eslint-plugin-vue）

推荐使用 @vue/compat 兼容构建渐进迁移，先升级再重构。
```

---

## 十三、总结

### Vue 2 → Vue 3 全景演进

```
核心层：
  Object.defineProperty → Proxy（惰性深层代理）
  全量虚拟 DOM Diff → Block Tree + PatchFlag 精确 Diff
  Options API → Composition API（按功能聚合代码）
  单一大包 → Monorepo + Tree-shaking + 自定义渲染器

生态层：
  Vue Router 3 → Vue Router 4（Composition API、next 返回值）
  Vuex → Pinia（去除 mutation、TypeScript 友好）
  vue-class-component → 原生 TypeScript 支持
  Nuxt 2 → Nuxt 3（Nitro 引擎、Vite、混合渲染）

API 层：
  $on/$off/$once 移除 → 使用 mitt 等外部库
  过滤器移除 → computed / 方法
  .sync 修饰符 → v-model:xxx
  $children 移除 → ref
  $listeners 合并到 $attrs
  自定义指令钩子重命名
  渲染函数 h() 改为 import
  组件 v-model 默认 prop 变更
```

### 源码阅读入口

| 关注点 | Vue 2 | Vue 3 |
|--------|-------|-------|
| 响应式 | `src/core/observer/index.js` | `packages/reactivity/src/` |
| 虚拟 DOM | `src/core/vdom/` | `packages/runtime-core/src/` |
| 模板编译 | `src/compiler/` | `packages/compiler-core/src/` |
| 组件系统 | `src/core/instance/` | `packages/runtime-core/src/component.ts` |
| Diff 算法 | `src/core/vdom/patch.js` | `packages/runtime-core/src/renderer.ts` |
| 调度器 | `src/core/observer/scheduler.js` | `packages/runtime-core/src/scheduler.ts` |

### 选型边界

| 场景 | 推荐方案 | 原因 |
|------|---------|------|
| 新项目（SPA） | Vue 3 + Vite + Pinia + TS | 性能好、DX 佳、生态成熟 |
| 新项目（需要 SEO） | Nuxt 3 | SSR/SSG/ISR 开箱即用 |
| Vue 2 维护项目 | 评估后决定 | 用 @vue/compat 渐进迁移，或保持 Vue 2 |
| 简单静态页面 | 轻量方案 | Vue 可能过重 |
| 大型 SPA | Vue 3 + TS + Pinia | Composition API 可维护性优于 Options API |
| 跨平台渲染 | Vue 3 自定义渲染器 | @vue/runtime-core 抽象层 |

**关键提醒**：
- 迁移不是目的，解决业务问题才是。Vue 2 项目运行稳定不必急于迁移
- 迁移前确认 UI 库、第三方插件、内部组件库的 Vue 3 兼容性
- 新项目直接 Vue 3，不需要犹豫
