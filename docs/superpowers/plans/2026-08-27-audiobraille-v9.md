# AudioBraille v9 全量重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 重建 AudioBraille 的应用壳、学习路径、实验入口和视觉系统，使鼠标/键盘导航可靠，学习可自由跳转并保存进度，AudioBraille 实验成为独立产品主线。

**架构：** 保留 `braille-engine.js`、`audio-braille.js`、`storage.js` 的核心接口和权威点位数据；重写应用壳为单一状态树、单一根事件委托和每次渲染的无缓存页面。学习页面采用“学习盲文 → 四大区域 → 细项 → 单项学练考”，实验页面采用“听觉辨识/听书场景”标签，笔记保持独立。

**技术栈：** Vite 5、Vitest 2、原生 DOM、Web Audio API、Web Speech API、IndexedDB（经 `storage.js`）。

---

## 文件清单与职责

### 创建
- `src/app-state.js`：应用状态、页面路由、标签和输入状态的纯函数。
- `src/teaching-speech.js`：声母/韵母/音节/字母/数字/符号的可预测 TTS 文案。
- `tests/app-state.test.js`：路由和标签状态测试。
- `tests/teaching-speech.test.js`：TTS 不使用裸声母/韵母测试。
- `tests/input-controller.test.js`：逐方输入控制器测试。
- `tests/learning-progress.test.js`：刷新后进度和手动跳转测试。

### 修改
- `src/storage.js`：保留 IndexedDB 边界，补齐版本化学习进度读取/写入接口。
- `src/speech.js`：增加 `cancelSpeech()`，防止换页残留语音。
- `src/curriculum.js`：改为纯课程数据和点位转换，不访问 localStorage。
- `src/teaching.js`：重写为课程选择、项目详情、学练考动作的纯业务模块。
- `src/input.js`：重写为可控输入控制器，不自行决定页面路由。
- `src/experiment.js`：重写为辨识状态机和展示/多方音频播放控制器。
- `src/reader.js`：提供可停止的 AudioBraille 连续播放控制器。
- `src/notes.js`：保留存储和双模式朗读，改为由 app 根层接线。
- `src/app.js`：重写为唯一路由、统一渲染、统一事件委托。
- `src/i18n.js`：补全 v9 中英文案，确保键集合一致。
- `index.html`：四入口顶栏、启动门、主容器和无障碍基础结构。
- `src/styles.css`：从零建立明亮教育风视觉系统，删除深蓝紫和旧布局规则。
- `tests/teaching-v5.test.js`、`tests/experiment-v5.test.js`、`tests/i18n.test.js`：迁移到 v9 接口。

### 删除或停止引用
- `src/teaching-v8.js`：旧的自渲染三级教学实现，避免与新教学状态重复。
- `src/guide.js`：说明内容合并到首页折叠区与 `app.js`，避免单独路由。
- `src/teaching.js` 旧的 `initTeaching().bind()` 接口：由 v9 纯业务接口替换。

---

### 任务 1：应用状态与存储边界

**文件：**
- 创建：`src/app-state.js`、`tests/app-state.test.js`
- 修改：`src/storage.js`、`src/curriculum.js`
- 测试：`tests/learning-progress.test.js`

- [ ] **步骤 1：编写失败测试**

```js
import { describe, it, expect } from 'vitest'
import { createAppState, navigate, selectLearningTab, selectExperimentTab } from '../src/app-state.js'

describe('v9 app state', () => {
  it('默认进入首页且只保留四个顶层入口', () => {
    const state = createAppState()
    expect(state.page).toBe('home')
    expect(state.learningTab).toBe('teaching')
    expect(state.experimentTab).toBe('recognition')
  })
  it('导航只接受有效页面', () => {
    expect(navigate(createAppState(), 'learning').page).toBe('learning')
    expect(navigate(createAppState(), 'reader').page).toBe('home')
  })
  it('标签切换不改变顶层页面', () => {
    const state = navigate(createAppState(), 'experiment')
    expect(selectExperimentTab(state, 'reader')).toMatchObject({ page: 'experiment', experimentTab: 'reader' })
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run tests/app-state.test.js`
预期：FAIL，找不到 `src/app-state.js`。

- [ ] **步骤 3：实现状态和存储接口**

`createAppState()` 返回固定形态：

```js
export const TOP_LEVEL_PAGES = ['home', 'learning', 'experiment', 'notes']
export function createAppState() {
  return {
    page: 'home',
    learningTab: 'teaching',
    experimentTab: 'recognition',
    teaching: { category: null, section: null, item: null, phase: 'learn' },
    input: { confirmedCells: [], currentDots: [] },
    experiment: { mode: 'letters', stage: 'idle', trials: [], index: 0 },
    audioUnlocked: false
  }
}
```

新增 `storage.saveProgress(record)` / `storage.loadProgress()` 的版本化结果格式：`{ version: 2, sections: { 'latin.l1': { learned: [], current: null } } }`。课程模块只接收 storage 实例，不直接访问浏览器存储 API。

- [ ] **步骤 4：运行状态和存储测试**

运行：`npx vitest run tests/app-state.test.js tests/curriculum.test.js tests/storage.test.js`
预期：PASS。

- [ ] **步骤 5：Commit**

```powershell
git add src/app-state.js src/storage.js src/curriculum.js tests/app-state.test.js tests/learning-progress.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: v9 统一应用状态与进度存储边界"
```

---

### 任务 2：课程数据、进度服务和 TTS 策略

**文件：**
- 修改：`src/curriculum.js`、`src/speech.js`
- 创建：`src/teaching-speech.js`、`tests/teaching-speech.test.js`、`tests/learning-progress.test.js`

- [ ] **步骤 1：编写失败测试**

```js
import { describe, it, expect } from 'vitest'
import { buildTeachingSpeech } from '../src/teaching-speech.js'

describe('教学 TTS', () => {
  it('声母不直接把 b 当作可朗读拼音', () => {
    const text = buildTeachingSpeech({ type: 'initial', label: 'b', cells: [[1, 2]] })
    expect(text).toContain('声母')
    expect(text).toContain('点1、点2')
    expect(text).not.toBe('b')
  })
  it('韵母包含文字标签和点位描述', () => {
    expect(buildTeachingSpeech({ type: 'final', label: 'a', cells: [[3, 5]] }))
      .toContain('韵母')
  })
  it('多方音节说明方数和声调', () => {
    const text = buildTeachingSpeech({ type: 'syllable', label: 'ma', toneName: '阴平', cells: [[1, 3, 4], [3, 5], [1]] })
    expect(text).toContain('三方')
    expect(text).toContain('阴平')
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run tests/teaching-speech.test.js`
预期：FAIL，找不到模块或函数。

- [ ] **步骤 3：实现课程和语音服务**

课程数据只从 `braille-engine.js` 和 `symbols.js` 生成项目；每项输出 `{ id, category, section, type, label, cells, unicode }`。中文拼音拆为“声母”“韵母”“音节练习”，但三个细项平级可点，不要求先学完前一项。

`buildTeachingSpeech(item)` 使用描述式文案：

```js
export function buildTeachingSpeech(item) {
  const dots = item.cells.map(cell => `点${cell.join('、点')}`).join('；')
  const count = item.cells.length > 1 ? `，${item.cells.length}方` : ''
  if (item.type === 'initial') return `声母，界面文字是 ${item.label}，盲文${dots}${count}`
  if (item.type === 'final') return `韵母，界面文字是 ${item.label}，盲文${dots}${count}`
  if (item.type === 'syllable') return `音节 ${item.label}，${item.toneName || '轻声不标调'}，盲文${dots}${count}`
  if (item.type === 'letter') return `英文字母 ${item.label}，盲文${dots}`
  if (item.type === 'digit') return `数字 ${item.label}，数字符号和数字方为${dots}`
  return `符号 ${item.label}，盲文${dots}${count}`
}
```

`speech.js` 增加：

```js
export function cancelSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run tests/teaching-speech.test.js tests/curriculum.test.js tests/learning-progress.test.js`
预期：PASS。

- [ ] **步骤 5：Commit**

```powershell
git add src/curriculum.js src/speech.js src/teaching-speech.js tests/teaching-speech.test.js tests/learning-progress.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: v9 课程项目与描述式教学语音"
```

---

### 任务 3：逐方输入控制器

**文件：**
- 重写：`src/input.js`
- 创建：`tests/input-controller.test.js`

- [ ] **步骤 1：编写失败测试**

```js
import { describe, it, expect } from 'vitest'
import { createInputController } from '../src/input.js'

describe('v9 输入控制器', () => {
  it('点位按键只更新当前方，不播报', () => {
    const events = []
    const input = createInputController({ onSpeech: text => events.push(text) })
    input.handleKey('7')
    input.handleKey('1')
    expect(input.snapshot().currentDots).toEqual([1, 3])
    expect(events).toEqual([])
  })
  it('* 确认一方并开始下一方', () => {
    const input = createInputController()
    input.handleKey('7'); input.handleKey('1'); input.handleKey('*')
    expect(input.snapshot().confirmedCells).toEqual([[1, 3]])
    expect(input.snapshot().currentDots).toEqual([])
  })
  it('0 提交时保留方边界', () => {
    const commits = []
    const input = createInputController({ onCommit: cells => commits.push(cells) })
    input.handleKey('7'); input.handleKey('*'); input.handleKey('4'); input.handleKey('0')
    expect(commits).toEqual([[[1], [2]]])
  })
  it('修饰键不被控制器消费', () => {
    const input = createInputController()
    expect(input.handleKey('r', { ctrlKey: true })).toBe(false)
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run tests/input-controller.test.js`
预期：FAIL，找不到 `createInputController`。

- [ ] **步骤 3：实现控制器**

`input.js` 只负责键位到 cells 的转换和回调，不读取 `currentPage`，不调用 `render()`，不直接决定教学/实验逻辑。接口包含 `handleKey(key, modifiers)`, `snapshot()`, `clear()`, `backspace()`, `commit()`。

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run tests/input-controller.test.js tests/input.test.js tests/input-v2.test.js`
预期：新测试和迁移后的兼容测试 PASS。

- [ ] **步骤 5：Commit**

```powershell
git add src/input.js tests/input-controller.test.js tests/input.test.js tests/input-v2.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: v9 可控逐方输入器"
```

---

### 任务 4：教学页面与四层自由选择流程

**文件：**
- 重写：`src/teaching.js`
- 删除停止引用：`src/teaching-v8.js`
- 修改：`src/app-state.js`
- 创建/修改：`tests/teaching-v9.test.js`、`tests/learning-progress.test.js`

- [ ] **步骤 1：编写失败测试**

```js
import { describe, it, expect } from 'vitest'
import { getTeachingCategories, getTeachingSections, getTeachingItem, markTeachingLearned } from '../src/teaching.js'

describe('v9 教学层级', () => {
  it('只有四个大区域', () => {
    expect(getTeachingCategories().map(x => x.id)).toEqual(['pinyin', 'latin', 'symbols', 'digits'])
  })
  it('中文拼音的细项可独立进入', () => {
    expect(getTeachingSections('pinyin').map(x => x.id)).toEqual(['initials', 'finals', 'syllables'])
  })
  it('可以直接取得任意项目，不依赖前序项目', () => {
    expect(getTeachingItem('latin', 'l1', 'f').label).toBe('f')
  })
  it('标记已学后 current 指向下一个未学项', () => {
    const progress = { learned: [], current: null }
    expect(markTeachingLearned(progress, 'a', ['a', 'b'])).toEqual({ learned: ['a'], current: 'b' })
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run tests/teaching-v9.test.js`
预期：FAIL，v9 教学 API 不存在。

- [ ] **步骤 3：实现教学业务和渲染模型**

教学模块提供纯函数：

```js
getTeachingCategories()
getTeachingSections(categoryId)
getTeachingItems(categoryId, sectionId, progress)
getTeachingItem(categoryId, sectionId, itemId)
markTeachingLearned(progress, itemId, orderedItems)
getItemCells(item)
```

`renderTeaching(state, services)` 返回当前教学层级 DOM：

- 层 1：四张同级区域卡片。
- 层 2：细项区块、每块进度条和所有项目按钮。
- 层 3：单项页，显示文字标签、Unicode 盲文、真实 6 点点阵、点位、键位、播放按钮、学/练/考和前后项。
- 单项页的“学会了”写入 progress，之后回到细项列表或进入下一个项目；用户点任何项目都可跳转。

练习阶段由 `onInputCommit(cells)` 传入当前项目判定；考试阶段不显示答案点位；错误结果显示正确盲文和键位但不触发第二次重复播报。

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run tests/teaching-v9.test.js tests/teaching-v5.test.js tests/learning-progress.test.js`
预期：PASS。

- [ ] **步骤 5：Commit**

```powershell
git add src/teaching.js src/app-state.js tests/teaching-v9.test.js tests/teaching-v5.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: v9 四大教学区域与自由跳转学习路径"
```

---

### 任务 5：AudioBraille 实验和听书场景

**文件：**
- 重写：`src/experiment.js`、`src/reader.js`
- 测试：`tests/experiment-v9.test.js`、`tests/reader-v9.test.js`

- [ ] **步骤 1：编写失败测试**

```js
import { describe, it, expect } from 'vitest'
import { createExperimentModel, getExperimentTabs } from '../src/experiment.js'

describe('v9 AudioBraille 实验', () => {
  it('实验包含辨识和听书两个场景', () => {
    expect(getExperimentTabs()).toEqual(['recognition', 'reader'])
  })
  it('换模式会重置本轮状态', () => {
    const model = createExperimentModel()
    model.start('letters')
    model.selectMode('syllables')
    expect(model.snapshot()).toMatchObject({ mode: 'syllables', stage: 'idle', index: 0 })
  })
  it('多方题保留顺序并可重新开始', () => {
    const model = createExperimentModel()
    model.start('syllables')
    expect(model.snapshot().trials.length).toBeGreaterThan(1)
    model.restart()
    expect(model.snapshot().index).toBe(0)
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run tests/experiment-v9.test.js tests/reader-v9.test.js`
预期：FAIL，v9 model API 不存在。

- [ ] **步骤 3：实现实验模型和生命周期**

实验页面只通过 model 暴露 `selectMode`, `start`, `confirmShowcase`, `listen`, `submit`, `restart`, `stop`, `snapshot`。所有定时器保存到集合，`stop()` 和换页时清理；模式切换立即取消展示和语音。

多方音频必须：

```js
for (const cell of trial.cells) {
  await playAudioBraille(cell, { duration })
}
```

不能把 `[[...], [...]]` 传给 `buildChordNotes`。辨识完成显示正确率、再来一轮和换模式。

听书 controller 使用 `buildReadingDots()` 的方序列，暴露 `play`, `stop`, `setSpeed`, `snapshot`；页面切换和重新播放先停止上一轮。

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run tests/experiment-v9.test.js tests/experiment-v5.test.js tests/reader-v9.test.js tests/reader.test.js`
预期：PASS。

- [ ] **步骤 5：Commit**

```powershell
git add src/experiment.js src/reader.js tests/experiment-v9.test.js tests/reader-v9.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: v9 AudioBraille 实验双场景与可重启听书"
```

---

### 任务 6：笔记双朗读与生命周期收口

**文件：**
- 修改：`src/notes.js`、`src/speech.js`
- 创建：`tests/notes-v9.test.js`

- [ ] **步骤 1：编写失败测试**

```js
import { describe, it, expect, vi } from 'vitest'
import { getNotePlaybackLabel, buildNotePlaybackCells } from '../src/notes.js'

describe('v9 笔记朗读', () => {
  it('两个按钮名称明确区分', () => {
    expect(getNotePlaybackLabel('tts')).toContain('文字')
    expect(getNotePlaybackLabel('braille')).toContain('AudioBraille')
  })
  it('AudioBraille 回放按方拆开', () => {
    expect(buildNotePlaybackCells('⠍⠔⠁')).toEqual([[1, 3, 4], [3, 5], [1]])
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run tests/notes-v9.test.js`
预期：FAIL，v9 helpers 不存在。

- [ ] **步骤 3：实现笔记接口**

`notes.js` 提供明确的 `readTextAloud()` 和 `readBrailleAloud(speed)`，页面按钮文案分别为“文字朗读（TTS）”和“AudioBraille 回放”。TTS 朗读只读用户可读的转换文本；AudioBraille 只按 `extractDotsFromText()` 的单方序列播放。每次播放返回可停止句柄，换页调用 `stop()` 和 `cancelSpeech()`。

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run tests/notes-v9.test.js tests/notes-v5.test.js tests/notes.test.js`
预期：PASS。

- [ ] **步骤 5：Commit**

```powershell
git add src/notes.js src/speech.js tests/notes-v9.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "fix: v9 笔记明确区分文字朗读与 AudioBraille 回放"
```

---

### 任务 7：新的应用壳和四入口导航

**文件：**
- 重写：`src/app.js`、`index.html`
- 修改：`src/guide.js`
- 测试：`tests/smoke.test.js`、`tests/app-shell.test.js`

- [ ] **步骤 1：编写失败测试**

```js
import { describe, it, expect } from 'vitest'
import { buildTopNav, buildHomeActions } from '../src/app.js'

describe('v9 应用壳', () => {
  it('顶层导航只有四项', () => {
    expect(buildTopNav().map(x => x.id)).toEqual(['home', 'learning', 'experiment', 'notes'])
  })
  it('首页入口包含学习、实验、笔记和说明', () => {
    expect(buildHomeActions().map(x => x.action)).toEqual(['learning', 'experiment', 'notes', 'guide'])
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run tests/app-shell.test.js`
预期：FAIL，v9 应用壳 API 不存在。

- [ ] **步骤 3：重写 app.js/index.html**

`app.js` 只保留：

```js
const PAGES = {
  home: renderHome,
  learning: renderLearning,
  experiment: renderExperiment,
  notes: renderNotes
}
```

应用根层注册一个 `document.addEventListener('click', onClick)` 和一个 `window.addEventListener('keydown', onKeydown)`。所有按钮通过 `data-action`、`data-page`、`data-tab`、`data-item` 驱动；不再使用 `pageViews`、模块 `.bind()` 或页面模块直接 `innerHTML` 替换主容器。

页面切换执行顺序：停止 reader/experiment/notes 播放，`cancelSpeech()`，重置输入 controller，再更新 state 和渲染。

启动门使用独立 capture listener；按 0 时先 `preventDefault()`/`stopPropagation()`，解锁并移除两个 listener，然后只播报欢迎语一次。

顶栏 HTML 只包含：首页、学习盲文、AudioBraille 实验、笔记和语言按钮。学习页显示两个 tab；实验页显示两个 tab；说明内容为首页 `<details>`，包含键位图、控制键和四模块简介。

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run tests/app-shell.test.js tests/smoke.test.js tests/app-state.test.js`
预期：PASS。

- [ ] **步骤 5：Commit**

```powershell
git add src/app.js index.html src/guide.js tests/app-shell.test.js tests/smoke.test.js
 git -c user.name="pi" -c user.email="pi@local" commit -m "feat: v9 四入口应用壳与统一事件路由"
```

---

### 任务 8：明亮教育风 UI 和可访问性

**文件：**
- 重写：`src/styles.css`
- 修改：`index.html`、`src/i18n.js`
- 创建：`tests/ui-contract.test.js`

- [ ] **步骤 1：编写失败测试**

```js
import { describe, it, expect } from 'vitest'
import { UI_TOKENS, navClassFor } from '../src/ui-contract.js'

describe('v9 UI contract', () => {
  it('使用明亮中性色而非旧深色主题', () => {
    expect(UI_TOKENS.page).toBe('#f6f7f9')
    expect(UI_TOKENS.text).toBe('#20242a')
  })
  it('当前导航有明确 active 状态', () => {
    expect(navClassFor('learning', 'learning')).toContain('is-active')
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run tests/ui-contract.test.js`
预期：FAIL，UI contract 不存在。

- [ ] **步骤 3：实现视觉系统**

使用稳定 CSS token：

```css
:root {
  --page: #f6f7f9;
  --surface: #ffffff;
  --surface-muted: #f0f2f5;
  --text: #20242a;
  --text-muted: #5f6875;
  --line: #d9dee6;
  --brand: #2457c5;
  --brand-hover: #19469f;
  --success: #177245;
  --danger: #b42318;
  --focus: #173f8a;
}
```

删除深蓝紫、紫色渐变、背景光晕、霓虹发光和重复嵌套卡片。页面使用铺满视口的浅灰背景，白色内容面板只用于明确的工具区域。首页用四列入口网格；学习/实验使用主内容区和窄侧栏；单项教学使用固定尺寸点阵区，避免内容变化导致布局跳动。

所有按钮实现默认、hover、active、focus-visible、disabled 五种状态；导航在窄屏横向滚动而不变成超长竖栏；内容自然滚动但首页目标是一屏完成。点阵图用命名区域：`d1 d4 / d2 d5 / d3 d6`，每个点具有文字辅助标签，视觉状态不单靠颜色表达。

- [ ] **步骤 4：运行测试和构建**

运行：`npx vitest run tests/ui-contract.test.js tests/i18n.test.js && npm run build`
预期：PASS，构建成功。

- [ ] **步骤 5：Commit**

```powershell
git add src/styles.css src/i18n.js index.html src/ui-contract.js tests/ui-contract.test.js
 git -c user.name="pi" -c user.email="pi@local" commit -m "feat: v9 明亮教育风视觉系统与可访问控件状态"
```

---

### 任务 9：全量验证、浏览器走查和清理旧实现

**文件：**
- 修改：`package.json`（仅在需要增加验证脚本时）
- 修改：`AGENTS.md`
- 测试：全部 `tests/*.test.js`

- [ ] **步骤 1：运行全量单元测试**

运行：`npx vitest run`
预期：所有测试通过，输出只保留测试汇总和失败摘要。

- [ ] **步骤 2：运行构建和静态检查**

运行：`npm run build`；使用 `npx esbuild src/main.js --bundle --outfile=$env:TEMP\audiobraille-check.js` 检查入口语法；扫描 `src` 确认不存在 `teaching-v8` 引用、`pageViews`、`teaching.bind`、`experiment.bind` 和业务模块直接访问 `localStorage`。

- [ ] **步骤 3：启动预览并进行 Playwright 走查**

验证桌面和移动视口：

1. 启动门：其他键被拦截；按 0 解锁且不播报“当前无点位”。
2. 顶栏：四个入口一次点击可达；active 状态和页面标题同步。
3. 学习：四大区域 → 任意细项 → 任意项目；切换学/练/考；标记一个项目后刷新仍保留进度。
4. 中文拼音：声母/韵母 TTS 为描述式文案；单项页显示 Unicode、正确六点图、键位和点位。
5. 在线输入：点位键不播报；`*` 分方、`/` 回退、0 提交；Ctrl+R 不被拦截。
6. 实验：四种模式、展示环节、多方逐方音频、完成后再来一轮；进入听书 tab 后可播放和停止。
7. 笔记：保存/历史/导入导出可见；文字朗读和 AudioBraille 回放按钮含义不同；换页没有残留语音。
8. 语言切换：顶栏、四入口、tab、说明、按钮文案一致。

- [ ] **步骤 4：更新项目进度并提交**

在 `AGENTS.md` 的当前进度中记录 v9 重构、单元测试数量、构建和 Playwright 结果；删除 `.git-commit-msg`、测试页面等临时文件；确认 `git status --short` 只显示预期变更后提交：

```powershell
git add AGENTS.md
git -c user.name="pi" -c user.email="pi@local" commit -m "chore: v9 全量测试构建与浏览器走查完成"
```

---

## 检查点

- **检查点 1（任务 1-3 后）**：状态、存储边界、课程点位、TTS 描述和逐方输入；逐项对照规格第 2 节点位，确认点 23 是去声，U+2800 为空方。
- **检查点 2（任务 4-6 后）**：四层教学流程、进度持久化、多方实验播放、听书停止、笔记双朗读；确认没有多方数组直接进入单方音频函数。
- **检查点 3（任务 7-9 后）**：四入口路由、启动门事件、亮色 UI、响应式导航、i18n 键一致、全量测试和 Playwright 证据。

## 完成定义

- `npx vitest run` 全部通过。
- `npm run build` 成功。
- 桌面与移动 Playwright 走查通过，鼠标按钮一次点击即可切换页面。
- 顶层只保留四个入口，听书位于 AudioBraille 实验内部。
- 学习进度通过 `storage.js` 持久化，项目可自由选择。
- 中文声母/韵母不使用裸拼音 TTS；教学页面同时展示文字、Unicode 方和点阵。
- 页面切换不会遗留语音或定时器。
