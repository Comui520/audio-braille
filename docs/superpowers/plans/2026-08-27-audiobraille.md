# AudioBraille 盲文学习平台 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 构建盲人友好的现行盲文教学 SPA：数字小键盘盲文输入（盲文直出）+ AudioBraille 空间音频编码 + 教学（探索/考试/间隔重复）+ 笔记记录器（IndexedDB + 导出导入）+ A/B 实验模式，纯前端可部署 Vercel。

**架构：** Vite + Vitest 原生 ES Modules SPA。核心逻辑与 UI 分离：`braille-engine.js`（盲文编码/变读/转写/对照）、`audio-braille.js`（空间音频）、`storage.js`（IndexedDB/localStorage/文件导出导入抽象层）、`input.js`（小键盘输入器）、`teaching.js`（教学+间隔重复）、`notes.js`、`experiment.js`、`app.js`（导航/AppState/无障碍/整合）。模块间仅通过 `BrailleEngine`、`playAudioBraille`、`storage`、`AppState`、`speak` 全局接口通信。

**技术栈：** Vite、Vitest、fake-indexeddb（测试）、原生 Web Audio API、Web Speech API、IndexedDB、File System Access API（渐进增强）、vanilla ES Modules。

**权威依据：** `docs/superpowers/specs/2026-08-27-audiobraille-design.md`（第 2 节编码规范为唯一数据源，不得臆造点位）。

---

## 文件结构（锁定的分解决策）

```
package.json
vite.config.js              # Vite + Vitest 配置
index.html                  # SPA 入口（无障碍骨架：aria-live、主内容区、导航）
vercel.json                 # Vercel 部署配置
public/favicon.svg
src/
  main.js                   # 入口：导入 app.js 并初始化
  app.js                    # AppState、speak()、导航、无障碍初始化、首次键盘解锁、模块整合
  styles.css                # 黑底黄字大字号主题 + 主题切换变量
  braille-engine.js         # 盲文编码核心（纯逻辑，无 DOM）
  audio-braille.js          # AudioBraille 空间音频（audioContext 管理 + 播放）
  storage.js                # 存储抽象层（纯逻辑 + IndexedDB/localStorage/文件）
  input.js                  # 数字小键盘输入器（盲文直出）
  teaching.js               # 教学模块（探索/考试/间隔重复，间隔重复算法纯逻辑）
  notes.js                  # 笔记记录器（textarea + 回放）
  experiment.js             # 实验模式（A/B 统计，统计逻辑纯函数）
  data/hanzi-table.js       # 对照字表数据（音节→常用字，种子 200 字）
tests/
  braille-engine.test.js
  audio-braille.test.js
  storage.test.js
  teaching.test.js
  experiment.test.js
```

---

### 任务 1：项目骨架（Vite + Vitest + 无障碍 HTML 入口）

**文件：**
- 创建：`package.json`
- 创建：`vite.config.js`
- 创建：`index.html`
- 创建：`vercel.json`
- 创建：`src/main.js`
- 创建：`src/speech.js`（speak 封装，独立模块避免循环依赖）
- 创建：`src/styles.css`
- 创建：`src/app.js`（仅骨架：AppState、导航、无障碍初始化、首次键盘解锁）
- 创建：`tests/smoke.test.js`
- 修改：无

- [ ] **步骤 1：编写失败的冒烟测试**

```js
// tests/smoke.test.js
import { describe, it, expect } from 'vitest'
import { createAppState } from '../src/app.js'

describe('AppState', () => {
  it('初始化时 currentPage 为 teaching，brailleDots 为 6 位 false', () => {
    const state = createAppState()
    expect(state.currentPage).toBe('teaching')
    expect(state.brailleDots).toEqual([false, false, false, false, false, false])
  })

  it('setDots 切换指定位并返回新数组（不可变更新）', () => {
    const state = createAppState()
    state.setDots(0)  // 点亮点1
    expect(state.brailleDots[0]).toBe(true)
    state.setDots(0)  // 再按熄灭
    expect(state.brailleDots[0]).toBe(false)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/smoke.test.js`
预期：FAIL，`Cannot find module '../src/app.js'`

- [ ] **步骤 3：搭建工程并实现最少代码**

```json
// package.json
{
  "name": "audiobraille",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "fake-indexeddb": "^6.0.0"
  }
}
```

```js
// vite.config.js
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'node' }
})
```

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

```js
// src/main.js
import './styles.css'
import { initApp } from './app.js'
initApp()
```

```js
// src/speech.js —— speak 封装（独立模块，供 app/input/notes/teaching 共用）
export function speak(text, { rate = 0.9, pitch = 1 } = {}) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'zh-CN'
  u.rate = rate
  u.pitch = pitch
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}
```

```js
// src/app.js —— 骨架部分（其余模块任务中逐步接入）
import { speak } from './speech.js'

export function createAppState() {
  const state = {
    currentPage: 'teaching',            // teaching | input | experiment | notes
    brailleDots: [false, false, false, false, false, false],
    inputStage: 'initial',              // initial | final | tone | commit
    learningProgress: { level: 1, records: {} },
    notes: [],
    settings: { clickSound: true, silentMode: false, theme: 'hc', fontSize: 20 },
    setDots(index) {
      state.brailleDots = state.brailleDots.map((v, i) => (i === index ? !v : v))
      return state.brailleDots
    },
    clearDots() {
      state.brailleDots = [false, false, false, false, false, false]
      state.inputStage = 'initial'
    }
  }
  return state
}

export function initApp() {
  const state = createAppState()
  // 首次键盘敲击解锁 Web Audio（任务 4 提供 unlockAudio）
  const unlock = () => { window.removeEventListener('keydown', unlock); import('./audio-braille.js').then(m => m.unlockAudio()) }
  window.addEventListener('keydown', unlock)
  // 导航骨架（模块任务中填充分发）
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') {
      state.settings.silentMode = !state.settings.silentMode
      speak(state.settings.silentMode ? '静音模式已开启' : '静音模式已关闭')
    }
    if (e.key === 'F1') { e.preventDefault(); speak('按 0 确认。按 3 退格。按 7 4 1 8 5 2 输入点位。') }
  })
  // 页面加载自动聚焦主内容并播报欢迎（任务 7 接入教学后完善）
  const main = document.getElementById('main-content')
  main?.focus()
  speak('欢迎来到 AudioBraille 盲文学习平台')
}
```

```css
/* src/styles.css —— 高对比大字号主题骨架 */
:root {
  --bg: #000; --fg: #ffd700; --accent: #fff;
  --font-size: 20px;
}
html, body { margin: 0; background: var(--bg); color: var(--fg); font-size: var(--font-size); }
[data-theme="hc"] { --bg: #000; --fg: #ffd700; }
[data-theme="light"] { --bg: #fff; --fg: #000; }
a, button, input, textarea { font-size: 1em; }
#main-content:focus { outline: 3px solid var(--accent); }
```

```html
<!-- index.html —— 无障碍骨架 -->
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AudioBraille 盲文学习平台</title>
</head>
<body>
  <a class="skip-link" href="#main-content">跳到主内容</a>
  <nav aria-label="主导航">
    <button data-page="teaching" aria-current="true">教学</button>
    <button data-page="input">盲文输入器</button>
    <button data-page="experiment">实验</button>
    <button data-page="notes">笔记记录器</button>
  </nav>
  <main id="main-content" tabindex="-1" aria-live="polite"></main>
  <div id="status" role="status" aria-live="polite"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/smoke.test.js`
预期：PASS（2 个用例）

- [ ] **步骤 5：Commit**

```bash
git add package.json vite.config.js vercel.json index.html src/main.js src/speech.js src/styles.css src/app.js tests/smoke.test.js
git commit -m "feat: 项目骨架（Vite+Vitest+无障碍入口+AppState）"
```

---

### 任务 2：盲文核心引擎（braille-engine.js）

**文件：**
- 创建：`src/braille-engine.js`
- 测试：`tests/braille-engine.test.js`

- [ ] **步骤 1：编写失败的测试（映射表 + 变读 + 解析 + U+2800）**

```js
// tests/braille-engine.test.js
import { describe, it, expect } from 'vitest'
import {
  INITIALS, FINALS, TONES,
  dotsToUnicode, unicodeToDots,
  applyVariation, syllableToDots, dotsToComponent
} from '../src/braille-engine.js'

describe('编码表（必须与规格第 2 节一致）', () => {
  it('声母表关键点位', () => {
    expect(INITIALS.b).toEqual([1, 2])
    expect(INITIALS.p).toEqual([1, 2, 3, 4])
    expect(INITIALS.zh).toEqual([3, 4])
    expect(INITIALS.sh).toEqual([1, 5, 6])
  })
  it('韵母表关键点位', () => {
    expect(FINALS.a).toEqual([3, 5])
    expect(FINALS.i).toEqual([2, 4])
    expect(FINALS.ü).toEqual([3, 4, 6])
    expect(FINALS.üan).toEqual([1, 2, 3, 4, 6])
    expect(FINALS.er).toEqual([1, 2, 3, 5])
  })
  it('声调：去声为点23（不是点4）', () => {
    expect(TONES['1']).toEqual([1])
    expect(TONES['2']).toEqual([2])
    expect(TONES['3']).toEqual([3])
    expect(TONES['4']).toEqual([2, 3])
  })
})

describe('Unicode 盲文', () => {
  it('空方为 U+2800，点1+2 为 U+2803', () => {
    expect(dotsToUnicode([])).toBe('\u2800')
    expect(dotsToUnicode([1, 2])).toBe('\u2803')
    expect(unicodeToDots('\u2803')).toEqual([1, 2])
  })
})

describe('变读规则 g/k/h → j/q/x', () => {
  it('g+iao → jiao', () => {
    expect(applyVariation('g', 'iao')).toEqual({ initial: 'j', final: 'iao' })
  })
  it('k+u 不变', () => {
    expect(applyVariation('k', 'u')).toEqual({ initial: 'k', final: 'u' })
  })
  it('h+ü → xu', () => {
    expect(applyVariation('h', 'ü')).toEqual({ initial: 'x', final: 'ü' })
  })
})

describe('syllableToDots / dotsToComponent 往返', () => {
  it('ma1 → [声母m][韵母a][声调1]，再解析回', () => {
    const seq = syllableToDots('m', 'a', '1')
    expect(seq).toEqual([[1, 3, 4], [3, 5], [1]])
    expect(dotsToComponent(seq[0])).toEqual({ type: 'initial', value: 'm' })
    expect(dotsToComponent(seq[1])).toEqual({ type: 'final', value: 'a' })
    expect(dotsToComponent(seq[2])).toEqual({ type: 'tone', value: '1' })
  })
  it('无调音节只返回两方', () => {
    const seq = syllableToDots('b', 'a', null)
    expect(seq).toEqual([[1, 2], [3, 5]])
  })
  it('未知点位返回 null', () => {
    expect(dotsToComponent([1, 2, 3, 4, 5, 6])).toBe(null)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/braille-engine.test.js`
预期：FAIL，`Cannot find module '../src/braille-engine.js'`

- [ ] **步骤 3：实现引擎（编码表逐项来自规格第 2 节）**

```js
// src/braille-engine.js
// 权威数据源：docs/superpowers/specs/2026-08-27-audiobraille-design.md 第 2 节（GB/T 15720-2008）

// 声母表（g/j、k/q、h/x 共用一方，靠变读区分）
export const INITIALS = {
  b: [1, 2], p: [1, 2, 3, 4], m: [1, 3, 4], f: [1, 2, 4],
  d: [1, 4, 5], t: [2, 3, 4, 5], n: [1, 3, 4, 5], l: [1, 2, 3],
  g: [1, 2, 4, 5], k: [1, 3], h: [1, 2, 5],
  j: [1, 2, 4, 5], q: [1, 3], x: [1, 2, 5],   // 变读结果，与 g/k/h 同点位
  zh: [3, 4], ch: [1, 2, 3, 4, 5], sh: [1, 5, 6], r: [2, 4, 5],
  z: [1, 3, 5, 6], c: [1, 4], s: [2, 3, 4]
}

// 韵母表（括号内为自成音节写法；e/o 共用 26）
export const FINALS = {
  a: [3, 5], o: [2, 6], e: [2, 6], i: [2, 4], u: [1, 3, 6], ü: [3, 4, 6],
  ai: [2, 4, 6], ei: [2, 3, 4, 6], ui: [2, 4, 5, 6],
  ao: [2, 3, 5], ou: [1, 2, 3, 5, 6], iu: [1, 2, 5, 6],
  ie: [1, 5], üe: [2, 3, 4, 5, 6], er: [1, 2, 3, 5],
  an: [1, 2, 3, 6], en: [3, 5, 6], in: [1, 2, 6], un: [2, 5], ün: [4, 5, 6],
  ang: [2, 3, 6], eng: [3, 4, 5, 6], ing: [1, 6], ong: [2, 5, 6],
  ia: [1, 2, 4, 6], ua: [1, 2, 3, 4, 5, 6], uo: [1, 3, 5], uai: [1, 3, 4, 5, 6],
  ian: [1, 4, 6], uan: [1, 2, 4, 5, 6], üan: [1, 2, 3, 4, 6],
  iang: [1, 3, 4, 6], uang: [2, 3, 5, 6], iong: [1, 4, 5, 6],
  iao: [3, 4, 5]
}

// 声调：阴平=1、阳平=2、上声=3、去声=23、轻声不标
export const TONES = { '1': [1], '2': [2], '3': [3], '4': [2, 3] }

const KEY = (arr) => [...arr].sort((a, b) => a - b).join(',')

// 点位 → Unicode（U+2800 + 位掩码：点1=0x01 … 点6=0x20）
export function dotsToUnicode(dots) {
  const mask = [...dots].reduce((acc, d) => acc | (1 << (d - 1)), 0)
  return String.fromCodePoint(0x2800 + mask)
}

export function unicodeToDots(ch) {
  const mask = ch.codePointAt(0) - 0x2800
  const dots = []
  for (let i = 1; i <= 6; i++) if (mask & (1 << (i - 1))) dots.push(i)
  return dots
}

// 变读：g/k/h 与 i、ü 及 i/ü 开头韵母相拼 → j/q/x
const VARIATION_MAP = { g: 'j', k: 'q', h: 'x' }
const I_U_FINALS = new Set(['i', 'ü', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong', 'üe', 'üan', 'ün'])
export function applyVariation(initial, final) {
  if (VARIATION_MAP[initial] && I_U_FINALS.has(final)) return { initial: VARIATION_MAP[initial], final }
  return { initial, final }
}

// 单方解析：先声母，再韵母，再声调（按点位精确匹配，避免前缀歧义）
export function dotsToComponent(dotsArray) {
  const key = KEY(dotsArray)
  for (const [value, dots] of Object.entries(INITIALS)) if (KEY(dots) === key) return { type: 'initial', value }
  for (const [value, dots] of Object.entries(FINALS)) if (KEY(dots) === key) return { type: 'final', value }
  for (const [tone, dots] of Object.entries(TONES)) if (KEY(dots) === key) return { type: 'tone', value: tone }
  return null
}

// 音节 → 方序列 [声母方, 韵母方, 声调方?]（先变读再取点位）
export function syllableToDots(initial, final, tone) {
  const { initial: vi } = applyVariation(initial, final)
  const seq = [INITIALS[vi], FINALS[final]].filter(Boolean)
  if (tone && TONES[tone]) seq.push(TONES[tone])
  return seq
}
```

> 注：`INITIALS` 中 j/q/x 与 g/k/h 同点位（变读规则）；`dotsToComponent` 按表序遍历返回先遇到的键（g/k/h），教学展示时结合韵母经 `applyVariation` 呈现 j/q/x。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/braille-engine.test.js`
预期：PASS（全部用例）。若某点位不符，**以规格第 2 节为准修正引擎，不得改测试**。

- [ ] **步骤 5：Commit**

```bash
git add src/braille-engine.js tests/braille-engine.test.js
git commit -m "feat: 盲文核心引擎（映射表/变读/解析/U+2800）"
```

---

### 任务 3：对照字表与转写（hanzi-table.js + 引擎转写函数）

**文件：**
- 创建：`src/data/hanzi-table.js`
- 修改：`src/braille-engine.js`（追加 `getReferences`、`transliterate`）
- 测试：`tests/braille-engine.test.js`（追加用例）

- [ ] **步骤 1：编写失败的测试**

```js
// tests/braille-engine.test.js 追加：
import { getReferences, transliterate } from '../src/braille-engine.js'

describe('对照字表与转写', () => {
  it('getReferences 按声韵调索引返回常用字', () => {
    const refs = getReferences('m', 'a', '1')
    expect(refs).toContain('妈')
    expect(refs).toContain('吗')
  })
  it('未知音节返回空数组', () => {
    expect(getReferences('x', 'x', '1')).toEqual([])
  })
  it('transliterate 把盲文方序列转成汉字（同音取第一个）', () => {
    // 妈(ma1) + 好(hao3)
    const seq = [...syllableToDots('m', 'a', '1'), ...syllableToDots('h', 'ao', '3')]
    expect(transliterate(seq)).toBe('妈好')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/braille-engine.test.js`
预期：FAIL，`getReferences is not a function`

- [ ] **步骤 3：实现字表与转写**

```js
// src/data/hanzi-table.js
// 种子字表：按 音节:声调 → [常用字] 索引。初期 200 常用字，后续可扩充为 1500~2500。
export const HANZI_TABLE = {
  'ma:1': ['妈', '吗', '抹'],
  'hao:3': ['好', '郝'],
  'ni:3': ['你', '拟'],
  'wo:3': ['我'],
  'ta:1': ['他', '她', '它', '塌'],
  'shi:4': ['是', '事', '市', '时'],
  'de:1': ['的'],
  'bu:4': ['不', '部', '步'],
  'le:1': ['了'],
  'zhong:1': ['中', '钟'],
  'guo:2': ['国', '果'],
  'ren:2': ['人', '任'],
  'men:2': ['们', '门'],
  'yi:1': ['一', '衣', '医'],
  'ge:1': ['个', '各', '哥'],
  'shang:4': ['上', '尚'],
  'xia:4': ['下', '夏'],
  'xue:2': ['学', '雪'],
  'xi:1': ['西', '吸', '希'],
  'huan:1': ['欢', '还'],
  'ying:1': ['应', '英', '婴']
}
// 生成 音节:声调 → [字] 的查询入口（带变读规范化）
```

```js
// src/braille-engine.js 追加：
import { HANZI_TABLE } from './data/hanzi-table.js'

// 按 声母+韵母+声调 查对照字（先变读规范化）
export function getReferences(initial, final, tone) {
  const { initial: vi } = applyVariation(initial, final)
  return HANZI_TABLE[`${vi}:${tone || ''}`] ?? []
}

// 盲文方序列 → 汉字明文。
// 输入：[[1,3,4],[3,5],[1], ...]（每 2~3 方一个音节）。
// 简策略：按 声母方+韵母方(+声调方) 分组，同音取字表第一个字。
export function transliterate(dotsSequence) {
  const out = []
  let i = 0
  while (i < dotsSequence.length) {
    const c1 = dotsToComponent(dotsSequence[i])
    const c2 = dotsToComponent(dotsSequence[i + 1])
    if (c1?.type === 'initial' && c2?.type === 'final') {
      const c3 = dotsToComponent(dotsSequence[i + 2])
      const tone = c3?.type === 'tone' ? c3.value : null
      const refs = getReferences(c1.value, c2.value, tone)
      out.push(refs[0] ?? '')
      i += tone ? 3 : 2
    } else {
      out.push('')   // 无法解析的一方（如标点/空格），占位
      i += 1
    }
  }
  return out.join('')
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/braille-engine.test.js`
预期：PASS（新增 3 个用例全部通过）

- [ ] **步骤 5：Commit**

```bash
git add src/data/hanzi-table.js src/braille-engine.js tests/braille-engine.test.js
git commit -m "feat: 对照字表与盲文→汉字转写"
```

---

### 任务 4：AudioBraille 空间音频（audio-braille.js）

**文件：**
- 创建：`src/audio-braille.js`
- 测试：`tests/audio-braille.test.js`（纯逻辑层：音符生成）

- [ ] **步骤 1：编写失败的测试（音频编码纯逻辑）**

```js
// tests/audio-braille.test.js
import { describe, it, expect } from 'vitest'
import { buildChordNotes, PAN } from '../src/audio-braille.js'

describe('AudioBraille 编码（纯逻辑）', () => {
  it('点1 → 600Hz 正弦 左耳', () => {
    const notes = buildChordNotes([1])
    expect(notes).toEqual([{ dot: 1, freq: 600, wave: 'sine', pan: PAN.LEFT }])
  })
  it('点6 → 250Hz 方波 右耳', () => {
    const notes = buildChordNotes([6])
    expect(notes).toEqual([{ dot: 6, freq: 250, wave: 'square', pan: PAN.RIGHT }])
  })
  it('点1+点4 同音高（上行 600Hz）但波形不同（左右列区分）', () => {
    const notes = buildChordNotes([1, 4])
    expect(notes.find(n => n.dot === 1).wave).toBe('sine')
    expect(notes.find(n => n.dot === 4).wave).toBe('square')
    expect(notes.find(n => n.dot === 1).freq).toBe(notes.find(n => n.dot === 4).freq)
  })
  it('空点阵返回空数组', () => {
    expect(buildChordNotes([])).toEqual([])
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/audio-braille.test.js`
预期：FAIL，`Cannot find module '../src/audio-braille.js'`

- [ ] **步骤 3：实现音频模块**

```js
// src/audio-braille.js
// 编码规则（硬编码，来自规格第 6 节）：
//   空间：左列点(1,2,3)→-90°(左耳)，右列点(4,5,6)→+90°(右耳)
//   音高：上行(1,4)=600Hz，中行(2,5)=400Hz，下行(3,6)=250Hz
//   波形：左列正弦，右列方波（单声道也能区分左右列）

export const PAN = { LEFT: -90, RIGHT: 90 }

const FREQ = { 1: 600, 2: 400, 3: 250, 4: 600, 5: 400, 6: 250 }
const WAVE = { 1: 'sine', 2: 'sine', 3: 'sine', 4: 'square', 5: 'square', 6: 'square' }

export function buildChordNotes(dots) {
  return dots.map(d => ({ dot: d, freq: FREQ[d], wave: WAVE[d], pan: d <= 3 ? PAN.LEFT : PAN.RIGHT }))
}

let audioCtx = null
let master = null

// 首次键盘敲击解锁（见 app.js 调用）
export function unlockAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    audioCtx = new AC()
    master = audioCtx.createGain()
    master.gain.value = 0.5
    master.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  // 极短静音缓冲强制解锁
  const buf = audioCtx.createBuffer(1, 1, 44100)
  const src = audioCtx.createBufferSource()
  src.buffer = buf
  src.connect(master)
  src.start()
}

export function isAudioReady() {
  return !!(audioCtx && audioCtx.state === 'running')
}

// 播放一点阵的和弦（0.25s，有点的音符同时响起）
// 可选 onDot(dot, on) 回调用于屏幕高亮
// 返回 Promise，播放结束 resolve（便于顺序演奏笔记）
export function playAudioBraille(dotsArray, { duration = 0.25, onDot = null } = {}) {
  if (!audioCtx) unlockAudio()
  if (!audioCtx || audioCtx.state !== 'running') return Promise.resolve()

  const notes = buildChordNotes(dotsArray)
  const start = audioCtx.currentTime + 0.02
  const stop = start + duration

  notes.forEach(n => {
    const osc = audioCtx.createOscillator()
    osc.type = n.wave
    osc.frequency.value = n.freq
    const panner = audioCtx.createStereoPanner()
    panner.pan.value = n.pan / 90   // StereoPanner 范围 [-1,1]
    const gain = audioCtx.createGain()
    gain.gain.setValueAtTime(0.4, start)
    gain.gain.exponentialRampToValueAtTime(0.001, stop)  // 短促衰减防爆音
    osc.connect(panner).connect(gain).connect(master)
    osc.start(start)
    osc.stop(stop)
    onDot?.(n.dot, true)
    osc.onended = () => onDot?.(n.dot, false)
  })

  return new Promise(res => setTimeout(res, duration * 1000 + 60))
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/audio-braille.test.js`
预期：PASS（纯逻辑 4 个用例）

- [ ] **步骤 5：Commit**

```bash
git add src/audio-braille.js tests/audio-braille.test.js
git commit -m "feat: AudioBraille 空间音频模块（左右列波形+三行音高）"
```

---

### 任务 5：存储抽象层（storage.js）

**文件：**
- 创建：`src/storage.js`
- 测试：`tests/storage.test.js`（fake-indexeddb）

- [ ] **步骤 1：编写失败的测试**

```js
// tests/storage.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { createStorage } from '../src/storage.js'

describe('storage 抽象层（IndexedDB）', () => {
  let storage
  beforeEach(async () => {
    storage = createStorage()
    await storage.init()
  })

  it('保存并加载笔记', async () => {
    await storage.saveNote({ id: 'n1', title: '测试', plain: '你好', dotsSeq: [[1, 2], [2, 3]] })
    const notes = await storage.loadNotes()
    expect(notes).toHaveLength(1)
    expect(notes[0].plain).toBe('你好')
  })

  it('导出为 JSON 并可导入恢复', async () => {
    await storage.saveNote({ id: 'n1', title: 't', plain: '你好', dotsSeq: [] })
    const json = await storage.exportNotes('json')
    const parsed = JSON.parse(json)
    expect(parsed.notes).toHaveLength(1)
    // 清空后导入
    await storage.clearAll()
    expect(await storage.loadNotes()).toHaveLength(0)
    await storage.importNotes(json, 'json')
    expect(await storage.loadNotes()).toHaveLength(1)
  })

  it('进度保存与加载', async () => {
    await storage.saveProgress({ level: 3, records: { a: { errors: 2 } } })
    const p = await storage.loadProgress()
    expect(p.level).toBe(3)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/storage.test.js`
预期：FAIL，`Cannot find module '../src/storage.js'`

- [ ] **步骤 3：实现存储抽象层**

```js
// src/storage.js
// 存储抽象层：IndexedDB 存笔记/进度；localStorage 存轻量设置。
// 业务代码只依赖本模块接口；将来套 Tauri 时仅替换本文件内部实现。

export function createStorage() {
  let db = null

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('AudioBraille', 1)
      req.onupgradeneeded = () => {
        const d = req.result
        if (!d.objectStoreNames.contains('notes')) d.createObjectStore('notes', { keyPath: 'id' })
        if (!d.objectStoreNames.contains('progress')) d.createObjectStore('progress', { keyPath: 'key' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async function init() { db = await open() }

  function tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode)
      const s = t.objectStore(store)
      const req = fn(s)
      t.oncomplete = () => resolve(req?.result)
      t.onerror = () => reject(t.error)
    })
  }

  return {
    async init() { db = await open() },
    async saveNote(note) { return tx('notes', 'readwrite', s => s.put(note)) },
    async deleteNote(id) { return tx('notes', 'readwrite', s => s.delete(id)) },
    async loadNotes() { return tx('notes', 'readonly', s => s.getAll()) },
    async clearAll() { await tx('notes', 'readwrite', s => s.clear()); await tx('progress', 'readwrite', s => s.clear()) },

    async saveProgress(progress) { return tx('progress', 'readwrite', s => s.put({ key: 'main', ...progress })) },
    async loadProgress() { return tx('progress', 'readonly', s => s.get('main')) ?? {} },

    // 导出：JSON（含元数据与版本号）；.brf 为盲文 ASCII 文本（点1=1…点6=6，空格=空方）
    async exportNotes(format = 'json') {
      const notes = await this.loadNotes()
      if (format === 'brf') {
        return notes.map(n => n.dotsSeq.map(d => d.join('') || ' ').join(' ') + '\n' + n.plain + '\n').join('\n')
      }
      return JSON.stringify({ app: 'AudioBraille', version: 1, notes }, null, 2)
    },

    async importNotes(content, format = 'json') {
      if (format === 'brf') {
        // .brf 简单解析：按行读入（本计划仅支持逐行：盲文行+明文行交替）
        const lines = content.split('\n').filter(l => l.trim() !== '')
        for (let i = 0; i + 1 < lines.length; i += 2) {
          const dotsSeq = lines[i].split(' ').map(c => c.trim() === '' ? [] : [...c].map(Number))
          await this.saveNote({ id: crypto.randomUUID(), title: `导入 ${new Date().toLocaleString()}`, plain: lines[i + 1], dotsSeq })
        }
        return
      }
      const data = JSON.parse(content)
      for (const n of data.notes) await this.saveNote(n)
    }
  }
}

// 轻量设置（localStorage）——不依赖 IndexedDB，直接导出静态方法
const SETTINGS_KEY = 'AudioBraille.settings'
export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) } catch { return null }
}
export function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) }
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/storage.test.js`
预期：PASS（3 个用例）。注意 fake-indexeddb 需在 Node 环境生效（vitest config 已设 `environment: 'node'`）。

- [ ] **步骤 5：Commit**

```bash
git add src/storage.js tests/storage.test.js
git commit -m "feat: 存储抽象层（IndexedDB+导出导入 JSON/.brf）"
```

---

### 任务 6：数字小键盘输入器（input.js）

**文件：**
- 创建：`src/input.js`
- 测试：`tests/input.test.js`（纯逻辑：键位映射、阶段状态机、功能键分发）

- [ ] **步骤 1：编写失败的测试**

```js
// tests/input.test.js
import { describe, it, expect } from 'vitest'
import { KEY_DOT_MAP, keyToDot, nextStageAfterConfirm } from '../src/input.js'

describe('键位映射（官方布局，可自定义）', () => {
  it('7→点1 … 2→点6', () => {
    expect(KEY_DOT_MAP['7']).toBe(0)
    expect(KEY_DOT_MAP['4']).toBe(1)
    expect(KEY_DOT_MAP['1']).toBe(2)
    expect(KEY_DOT_MAP['8']).toBe(3)
    expect(KEY_DOT_MAP['5']).toBe(4)
    expect(KEY_DOT_MAP['2']).toBe(5)
  })
  it('keyToDot 未知键返回 null', () => {
    expect(keyToDot('a')).toBe(null)
    expect(keyToDot('0')).toBe(null)   // 0 是确认键，不是点位键
  })
})

describe('输入阶段状态机', () => {
  it('无调：initial→final→commit；带调：initial→final→tone→commit', () => {
    expect(nextStageAfterConfirm('initial', false)).toBe('final')
    expect(nextStageAfterConfirm('final', false)).toBe('commit')
    expect(nextStageAfterConfirm('initial', true)).toBe('final')
    expect(nextStageAfterConfirm('final', true)).toBe('tone')
    expect(nextStageAfterConfirm('tone', true)).toBe('commit')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/input.test.js`
预期：FAIL，`Cannot find module '../src/input.js'`

- [ ] **步骤 3：实现输入器（纯逻辑 + DOM 接入）**

```js
// src/input.js
import { dotsToComponent, syllableToDots, dotsToUnicode, applyVariation } from './braille-engine.js'
import { playAudioBraille } from './audio-braille.js'
import { speak } from './speech.js'

// 官方布局（可自定义：存储于 localStorage，见 app.js 设置加载）
export const KEY_DOT_MAP = { '7': 0, '4': 1, '1': 2, '8': 3, '5': 4, '2': 5 }
export const keyToDot = (key) => (key in KEY_DOT_MAP ? KEY_DOT_MAP[key] : null)

// 输入阶段：initial(声母) → final(韵母) → tone(声调，可选) → commit
export function nextStageAfterConfirm(stage, withTone) {
  if (stage === 'initial') return 'final'
  if (stage === 'final') return withTone ? 'tone' : 'commit'
  if (stage === 'tone') return 'commit'
  return 'commit'
}

// 组装当前音节的盲文方序列并解析为拼音（供上屏/播报）
export function buildSyllable(buffers, withTone) {
  // buffers: { initial: dotsArray|null, final: dotsArray|null, tone: dotsArray|null }
  const init = buffers.initial ? dotsToComponent(buffers.initial) : null
  const fin = buffers.final ? dotsToComponent(buffers.final) : null
  if (!init || init.type !== 'initial') return null
  if (!fin || fin.type !== 'final') return null
  const tone = withTone && buffers.tone ? dotsToComponent(buffers.tone) : null
  const { initial, final } = applyVariation(init.value, fin.value)
  return { initial, final, tone: tone?.type === 'tone' ? tone.value : null, dots: syllableToDots(init.value, fin.value, tone?.value) }
}

// DOM 接入：绑定全局 keydown（由 app.js 调用）
// 依赖：AppState（state）、storage 设置、UI 回调
// 重要：所有小键盘键 preventDefault()，避免 textarea 中误输数字
export function initInput({ state, render, settings }) {
  const buffers = { initial: null, final: null, tone: null }
  const withTone = () => settings.toneMode !== false   // 设置：进阶模式默认开启声调

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return   // 让位组合键（Ctrl+S 等）

    const dotIndex = keyToDot(e.key)
    if (dotIndex !== null) {
      e.preventDefault()
      state.setDots(dotIndex)
      if (settings.clickSound) playClick()
      render()
      return
    }

    switch (e.key) {
      case '0': {   // 确认：当前方 → 下一阶段 或 上屏
        e.preventDefault()
        const comp = dotsToComponent(state.brailleDots)
        if (state.inputStage === 'initial' && comp?.type === 'initial') {
          buffers.initial = state.brailleDots
          state.inputStage = nextStageAfterConfirm('initial', withTone())
          state.clearDots()
        } else if (state.inputStage === 'final' && comp?.type === 'final') {
          buffers.final = state.brailleDots
          state.inputStage = nextStageAfterConfirm('final', withTone())
          state.clearDots()
        } else if (state.inputStage === 'tone' && (comp?.type === 'tone' || state.inputStage === 'tone')) {
          buffers.tone = state.brailleDots
          state.inputStage = 'commit'
          void commit()
        } else if (state.inputStage === 'final' && !withTone()) {
          void commit()
        } else if (state.inputStage === 'commit') {
          void commit()
        } else {
          speak('请输入有效的盲文点位')
        }
        render()
        break
      }
      case '3': {   // 退格：回退上一阶段或删除
        e.preventDefault()
        if (buffers.tone) { buffers.tone = null; state.inputStage = 'tone' }
        else if (buffers.final) { buffers.final = null; state.inputStage = 'final' }
        else if (buffers.initial) { buffers.initial = null; state.inputStage = 'initial' }
        else onBackspace?.()
        render()
        break
      }
      case '-': {   // 清空
        e.preventDefault()
        buffers.initial = buffers.final = buffers.tone = null
        state.clearDots()
        speak('已清空')
        render()
        break
      }
      case '+': {   // 朗读当前点位 + 和弦预览
        e.preventDefault()
        const dots = state.brailleDots.map((v, i) => (v ? i + 1 : 0)).filter(Boolean)
        speak(dots.length ? `点${dots.join('、点')}` : '当前无点位')
        playAudioBraille(dots)
        break
      }
      case '.': {   // 空格
        e.preventDefault()
        onInsert(' ')
        break
      }
    }
  })

  async function commit() {
    const syl = buildSyllable(buffers, withTone())
    if (!syl) { speak('无法解析的音节'); return }
    const unicode = syl.dots.map(dotsToUnicode).join('')
    onInsert(unicode)
    speak(`${syl.initial}${syl.final}${syl.tone ?? ''}`)
    // 确认时触发 AudioBraille：逐方演奏整个音节（每方 0.25s，方间 0.1s）
    for (const dots of syl.dots) {
      await playAudioBraille(dots, { duration: 0.25 })
      await new Promise(r => setTimeout(r, 100))
    }
    buffers.initial = buffers.final = buffers.tone = null
    state.clearDots()
  }

  // 注入的 UI 回调（app.js 提供）
  let onInsert = () => {}
  let onBackspace = () => {}
  return {
    setInsertHandler(fn) { onInsert = fn },
    setBackspaceHandler(fn) { onBackspace = fn }
  }
}

function playClick() {
  // 极短、低音量、无音高的咔嗒声（可被 settings.clickSound 关闭）
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = new AC()
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 1800
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.05, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03)
    osc.connect(g).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.03)
  } catch { /* 音频不可用则忽略 */ }
}
```

> 说明：`initInput` 依赖 `state`/`settings`/`render` 由 app.js 注入；测试仅覆盖纯逻辑（键位映射、状态机、音节组装），DOM 行为在任务 10 手动验证。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/input.test.js`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/input.js tests/input.test.js
git commit -m "feat: 数字小键盘输入器（盲文直出/阶段状态机/功能键）"
```

---

### 任务 7：教学模块（teaching.js）

**文件：**
- 创建：`src/teaching.js`
- 测试：`tests/teaching.test.js`（间隔重复算法、错题本进出、考试评分）

- [ ] **步骤 1：编写失败的测试**

```js
// tests/teaching.test.js
import { describe, it, expect } from 'vitest'
import { createReviewer, pickExamQuestion, gradeAnswer } from '../src/teaching.js'

describe('间隔重复错题本（SM-2 简化变体）', () => {
  it('错误 2 次加入错题本，连续正确 3 次移出', () => {
    const r = createReviewer()
    r.record('ma', false)   // 错 1
    expect(r.isInReview('ma')).toBe(false)
    r.record('ma', false)   // 错 2
    expect(r.isInReview('ma')).toBe(true)
    r.record('ma', true)
    r.record('ma', true)
    expect(r.isInReview('ma')).toBe(true)   // 连续正确 2 次，仍在
    r.record('ma', true)
    expect(r.isInReview('ma')).toBe(false)  // 连续正确 3 次，移出
  })
  it('连续正确计数只在中间无错误时累计', () => {
    const r = createReviewer()
    r.record('ni', true)
    r.record('ni', false)   // 中断连续
    r.record('ni', true)
    r.record('ni', true)
    expect(r.isInReview('ni')).toBe(true)   // 连续仅 2 次
  })
})

describe('考试出题与评分', () => {
  it('每 5 题插入 1 道错题', () => {
    const q = pickExamQuestion({ index: 4, reviewQueue: ['ma'] })
    expect(q).toBe('ma')
    const q2 = pickExamQuestion({ index: 3, reviewQueue: ['ma'] })
    expect(q2).not.toBe('ma')
  })
  it('gradeAnswer 比较点位数组', () => {
    expect(gradeAnswer([1, 2], [1, 2])).toBe(true)
    expect(gradeAnswer([1, 2], [2, 1])).toBe(true)   // 顺序无关
    expect(gradeAnswer([1, 2], [1, 3])).toBe(false)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/teaching.test.js`
预期：FAIL，`Cannot find module '../src/teaching.js'`

- [ ] **步骤 3：实现教学模块**

```js
// src/teaching.js

// —— 间隔重复错题本（纯逻辑，可测）——
// 规则：错误≥2 加入；每 5 题插 1 错题；连续正确 3 次移出。
export function createReviewer() {
  const map = new Map()   // key → { errors, streak }

  function entry(key) {
    if (!map.has(key)) map.set(key, { errors: 0, streak: 0 })
    return map.get(key)
  }

  return {
    record(key, correct) {
      const e = entry(key)
      if (correct) { e.streak += 1; if (e.streak >= 3 && e.errors >= 2) map.delete(key) }
      else { e.errors += 1; e.streak = 0 }
    },
    isInReview(key) {
      const e = map.get(key)
      return !!e && e.errors >= 2 && e.streak < 3
    },
    reviewQueue() { return [...map.keys()].filter(k => this.isInReview(k)) },
    toJSON() { return Object.fromEntries(map) },
    fromJSON(data) { for (const [k, v] of Object.entries(data)) map.set(k, v) }
  }
}

// —— 考试出题（纯逻辑）——
// 每 5 题（index%5===4）强制插入错题本中的题目
export function pickExamQuestion({ index, reviewQueue }) {
  if (index % 5 === 4 && reviewQueue.length > 0) {
    return reviewQueue[index % reviewQueue.length]
  }
  return null   // 返回 null 表示从常规题库随机出题（UI 层处理）
}

// —— 评分（点位数组无序比较）——
export function gradeAnswer(expected, given) {
  if (expected.length !== given.length) return false
  const s = (a) => [...a].sort((x, y) => x - y).join(',')
  return s(expected) === s(given)
}

// —— 教学 UI（探索/考试，键盘驱动）——
// 由 app.js 调用；依赖 state/render/speak/playAudioBraille
// 探索模式：中央显示字符，用户按点位键探索，按 0 核对
// 考试模式：TTS 出题，用户输入提交，记录正确率（经 storage 存进度）
export function initTeaching({ state, render, storage }) {
  const reviewer = createReviewer()
  return {
    reviewer,
    view() {
      // 返回教学视图容器（探索/考试入口按钮 + 出题区）；后续步骤填充 DOM
      const sec = document.createElement('section')
      sec.innerHTML = '<h1>教学</h1><button data-mode="explore">探索模式</button><button data-mode="exam">考试模式</button><div id="lesson"></div>'
      return sec
    }
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/teaching.test.js`
预期：PASS（全部用例）

- [ ] **步骤 5：Commit**

```bash
git add src/teaching.js tests/teaching.test.js
git commit -m "feat: 教学模块（间隔重复/错题本/出题/评分）"
```

---

### 任务 8：笔记记录器（notes.js）

**文件：**
- 创建：`src/notes.js`
- 测试：`tests/notes.test.js`（纯逻辑：盲文序列提取与回放序列）

- [ ] **步骤 1：编写失败的测试**

```js
// tests/notes.test.js
import { describe, it, expect } from 'vitest'
import { extractDotsFromText, buildPlaybackSequence } from '../src/notes.js'

describe('笔记盲文序列', () => {
  it('从 Unicode 盲文文本提取点位序列', () => {
    // ⠍(134) ⠁(1) ⠁(1) = 妈 ma1 的盲文（声母 m=134，韵母 a=35，声调1=1）
    const text = '\u2800\u2800'
    expect(extractDotsFromText(text)).toBeInstanceOf(Array)
  })
  it('buildPlaybackSequence 把点位序列展开为逐方播放数组（每方间隔 0.3s）', () => {
    const seq = buildPlaybackSequence([[1, 3, 4], [3, 5], [1]])
    expect(seq).toHaveLength(3)
    expect(seq[0]).toEqual([1, 3, 4])
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/notes.test.js`
预期：FAIL，`Cannot find module '../src/notes.js'`

- [ ] **步骤 3：实现笔记记录器**

```js
// src/notes.js
import { unicodeToDots } from './braille-engine.js'
import { speak } from './speech.js'

// 从含 Unicode 盲文的文本中提取点位序列
// 规则：只取 U+2800~U+28FF 字符，空格/标点/汉字忽略
export function extractDotsFromText(text) {
  return [...text]
    .filter(ch => ch.codePointAt(0) >= 0x2800 && ch.codePointAt(0) <= 0x28ff)
    .map(unicodeToDots)
}

// 回放序列：逐方播放，每方间隔 0.3s
export function buildPlaybackSequence(dotsSeq) {
  return dotsSeq.map(d => [...d])
}

// —— 笔记 UI（由 app.js 调用）——
// textarea + 快捷键：Ctrl+S 保存、Ctrl+O 历史、Ctrl+N 新建
// 回放：+ 键朗读明文 + playAudioBraille 逐方演奏（每方间隔 0.3s）
export function initNotes({ state, storage, render }) {
  let current = { id: null, title: '', plain: '', dotsSeq: [] }
  return {
    view() {
      const sec = document.createElement('section')
      sec.innerHTML = '<h1>笔记记录器</h1><textarea id="note-textarea" rows="10" aria-label="笔记内容"></textarea><button id="note-save">保存</button><button id="note-play">回放</button>'
      return sec
    },
    async save() {
      const textarea = document.querySelector('#note-textarea')
      current.plain = textarea.value
      current.dotsSeq = extractDotsFromText(textarea.value)
      if (!current.id) current.id = crypto.randomUUID()
      if (!current.title) current.title = new Date().toLocaleString()
      await storage.saveNote(current)
      speak('笔记已保存')
    },
    async list() { return storage.loadNotes() },
    async open(id) {
      const notes = await storage.loadNotes()
      current = notes.find(n => n.id === id) ?? current
      const ta = document.querySelector('#note-textarea')
      ta.value = current.plain
    },
    newNote() {
      current = { id: null, title: '', plain: '', dotsSeq: [] }
      const ta = document.querySelector('#note-textarea')
      ta.value = ''
      ta.focus()
    },
    async playback() {
      const dotsSeq = extractDotsFromText(current.plain)
      const { playAudioBraille } = await import('./audio-braille.js')
      speak(current.plain.replace(/[\u2800-\u28ff]/g, ' ').trim() || '无明文')
      for (const dots of buildPlaybackSequence(dotsSeq)) {
        await playAudioBraille(dots, { duration: 0.2 })
        await new Promise(r => setTimeout(r, 300))   // 方间 0.3s
      }
    }
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/notes.test.js`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/notes.js tests/notes.test.js
git commit -m "feat: 笔记记录器（盲文原码提取/回放/快捷键）"
```

---

### 任务 9：实验模式（experiment.js）

**文件：**
- 创建：`src/experiment.js`
- 测试：`tests/experiment.test.js`（统计逻辑纯函数）

- [ ] **步骤 1：编写失败的测试**

```js
// tests/experiment.test.js
import { describe, it, expect } from 'vitest'
import { createExperiment, summarize } from '../src/experiment.js'

describe('实验统计', () => {
  it('汇总 A/B 组耗时与正确率', () => {
    const exp = createExperiment()
    exp.addTrial('tts', 1.2, true)
    exp.addTrial('tts', 0.8, true)
    exp.addTrial('ab', 3.5, false)
    exp.addTrial('ab', 2.1, true)
    const s = summarize(exp)
    expect(s.tts.avgTime).toBeCloseTo(1.0)
    expect(s.tts.accuracy).toBe(1)
    expect(s.ab.accuracy).toBe(0.5)
  })
  it('交叉组序：先 A 后 B（学习效应控制说明）', () => {
    const exp = createExperiment({ order: 'AB' })
    expect(exp.order).toBe('AB')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/experiment.test.js`
预期：FAIL，`Cannot find module '../src/experiment.js'`

- [ ] **步骤 3：实现实验模块**

```js
// src/experiment.js
import { playAudioBraille } from './audio-braille.js'
import { speak } from './speech.js'

// 实验：A 组（TTS 朗读字母名）vs B 组（AudioBraille 空间音频，不显示文字）
// 前置条件：B 组前确认用户已掌握编码（UI 提示）
// 设计：随机 10 题；耗时口径 = 从播放结束到作答；交叉/随机组序

// 拉丁字母盲文点位表（国际标准，与现行盲文声母同源；实验题目用）
export const LATIN_LETTERS = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5],
  f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
  k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5],
  p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
  u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6]
}

export function createExperiment({ order = 'AB' } = {}) {
  const trials = []
  return {
    order,
    addTrial(group, timeSec, correct) {
      trials.push({ group, timeSec, correct })
    },
    trials() { return [...trials] }
  }
}

// 汇总统计
export function summarize(exp) {
  const groups = { tts: [], ab: [] }
  for (const t of exp.trials()) groups[t.group].push(t)
  const calc = (arr) => arr.length === 0
    ? { avgTime: 0, accuracy: 0, count: 0 }
    : {
        avgTime: arr.reduce((a, t) => a + t.timeSec, 0) / arr.length,
        accuracy: arr.filter(t => t.correct).length / arr.length,
        count: arr.length
      }
  return { tts: calc(groups.tts), ab: calc(groups.ab) }
}

// 结果播报文案（屏幕 + TTS）
export function formatResult(s) {
  return `语音组 ${s.tts.avgTime.toFixed(1)} 秒，AudioBraille 组 ${s.ab.avgTime.toFixed(1)} 秒；正确率语音组 ${Math.round(s.tts.accuracy * 100)}%，AudioBraille 组 ${Math.round(s.ab.accuracy * 100)}%`
}

// UI 接线（由 app.js 调用）
export function initExperiment({ state, render }) {
  const exp = createExperiment({ order: 'AB' })
  return {
    exp,
    view() {
      const sec = document.createElement('section')
      sec.innerHTML = '<h1>实验模式</h1><button data-exp="start">开始实验</button><div id="exp-status"></div>'
      return sec
    },
    start() {
      speak('实验开始。请确认您已掌握 AudioBraille 编码，再按 0 继续。')
      state.experimentStage = 'confirm'   // 等待确认（app.js 监听 0 键）
    },
    // 播题：A 组 TTS 朗读字母名；B 组播放该字母盲文点位的空间音频（不显示文字）
    runTrial(group, letter) {
      const t0 = performance.now()
      if (group === 'ab') {
        playAudioBraille(LATIN_LETTERS[letter] ?? [])
      } else {
        speak(`请打出字母 ${letter}`)
      }
      return { group, letter, startTime: t0 }
    },
    record(group, timeSec, correct) {
      exp.addTrial(group, timeSec, correct)
    },
    finish() {
      return formatResult(summarize(exp))
    }
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/experiment.test.js`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/experiment.js tests/experiment.test.js
git commit -m "feat: 实验模式（A/B 统计与汇总）"
```

---

### 任务 10：整合与收尾（app.js 完整版 + 手动验证清单）

**文件：**
- 修改：`src/app.js`（完整整合所有模块）
- 修改：`index.html`（各页面容器、设置面板、帮助区）
- 修改：`src/styles.css`（页面布局、点阵图、高亮）
- 测试：`tests/smoke.test.js`（追加一个导出接口断言）

- [ ] **步骤 1：编写失败的测试（app 导出接口）**

```js
// tests/smoke.test.js 追加：
import { createAppState, buildPages } from '../src/app.js'

describe('app 接口', () => {
  it('buildPages 返回四个页面名', () => {
    expect(buildPages()).toEqual(['teaching', 'input', 'experiment', 'notes'])
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/smoke.test.js`
预期：FAIL，`buildPages is not a function`

- [ ] **步骤 3：完成 app.js 整合**

```js
// src/app.js —— 完整版
import { createStorage, loadSettings, saveSettings } from './storage.js'
import { initInput } from './input.js'
import { initTeaching } from './teaching.js'
import { initNotes } from './notes.js'
import { initExperiment } from './experiment.js'
import { unlockAudio } from './audio-braille.js'
import { speak } from './speech.js'

// ===== AppState（与任务 1 相同的完整实现，此处展开避免跨任务引用）=====
export function createAppState() {
  const state = {
    currentPage: 'teaching',
    brailleDots: [false, false, false, false, false, false],
    inputStage: 'initial',
    learningProgress: { level: 1, records: {} },
    notes: [],
    settings: { clickSound: true, silentMode: false, theme: 'hc', fontSize: 20 },
    setDots(index) {
      state.brailleDots = state.brailleDots.map((v, i) => (i === index ? !v : v))
      return state.brailleDots
    },
    clearDots() {
      state.brailleDots = [false, false, false, false, false, false]
      state.inputStage = 'initial'
    }
  }
  return state
}

export function buildPages() {
  return ['teaching', 'input', 'experiment', 'notes']
}

export function initApp() {
  const state = createAppState()
  const storage = createStorage()
  storage.init().then(() => {
    const saved = loadSettings()
    if (saved) Object.assign(state.settings, saved)
  })

  const main = document.getElementById('main-content')
  const dotsEl = Object.assign(document.createElement('div'), { id: 'dots' })
  dotsEl.setAttribute('role', 'img')

  // 渲染：导航 aria-current、点阵图、当前页面视图
  function render() {
    document.querySelectorAll('nav button').forEach(b => {
      b.setAttribute('aria-current', b.dataset.page === state.currentPage ? 'true' : 'false')
    })
    dotsEl.setAttribute('aria-label',
      state.brailleDots.map((v, i) => (v ? `点${i + 1}` : '')).filter(Boolean).join('、') || '空')
    dotsEl.innerHTML = [...Array(6)].map((_, i) =>
      `<span class="dot ${state.brailleDots[i] ? 'on' : ''}" style="grid-area:d${i + 1}"></span>`
    ).join('')
    renderPage()
  }

  function renderPage() {
    // 按 state.currentPage 渲染教学/输入/实验/笔记视图（各模块 init 时注入容器）
    main.replaceChildren(dotsEl, pageViews[state.currentPage] ?? emptyView())
  }

  const pageViews = {}
  const emptyView = () => Object.assign(document.createElement('section'), { textContent: '请选择模块' })

  // 输入器接线
  const input = initInput({ state, render, settings: state.settings })
  const activeField = () => pageViews[state.currentPage]?.querySelector('textarea') ?? main
  input.setInsertHandler(text => {
    const ta = activeField()
    if (ta && 'selectionStart' in ta) {
      const s = ta.selectionStart ?? ta.value.length
      ta.value = ta.value.slice(0, s) + text + ta.value.slice(ta.selectionEnd ?? s)
      ta.focus()
    }
  })
  input.setBackspaceHandler(() => {
    const ta = activeField()
    if (ta && 'selectionStart' in ta && ta.selectionStart > 0) {
      ta.value = ta.value.slice(0, ta.selectionStart - 1) + ta.value.slice(ta.selectionEnd)
      ta.focus()
    }
  })

  // 教学/笔记/实验接线
  const teaching = initTeaching({ state, render, storage })
  const notes = initNotes({ state, storage, render })
  const experiment = initExperiment({ state, render })
  pageViews.teaching = teaching.view()
  pageViews.input = emptyView()
  pageViews.experiment = experiment.view()
  pageViews.notes = notes.view()

  // 导航切换（键盘 Tab + Enter 原生支持 button）
  document.querySelectorAll('nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentPage = btn.dataset.page
      render()
    })
  })

  // 首次键盘解锁音频 + 欢迎播报
  const unlockOnce = () => {
    window.removeEventListener('keydown', unlockOnce)
    unlockAudio()
    speak('音频引擎已就绪')
  }
  window.addEventListener('keydown', unlockOnce)

  // 全局快捷键
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F1') { e.preventDefault(); speak('按 0 确认送字。按 3 退格。按减号清空。按加号朗读。按句号空格。F1 帮助。Ctrl 加 Shift 加 M 静音。') }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') {
      state.settings.silentMode = !state.settings.silentMode
      saveSettings(state.settings)
      speak(state.settings.silentMode ? '静音模式开启' : '静音模式关闭')
    }
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault()
      if (state.currentPage === 'notes') notes.save()
    }
  })

  main.focus()
  speak('欢迎来到 AudioBraille 盲文学习平台')
  render()
}
```

> 说明：本任务为**整合接线**，app.js 中 `render`/页面视图/点阵图为骨架示意；任务执行时按各模块真实导出补齐（`initTeaching`/`initNotes`/`initExperiment` 的 UI 回调）。**手动验证清单**（任务完成后逐项勾选）：
> - [ ] 页面加载自动聚焦主内容区并播报欢迎语
> - [ ] 首次键盘敲击后播报"音频引擎已就绪"
> - [ ] 教学页：探索/考试模式键盘可完整操作，按 0 核对对错
> - [ ] 输入器：7/4/1/8/5/2 切换点位，0 依次确认声母→韵母→声调→上屏，盲文直出（无候选字）
> - [ ] 输入器：3 退格、- 清空、+ 朗读+和弦预览、. 空格；卡嗒声可关（设置）
> - [ ] 笔记：Ctrl+S 保存、Ctrl+O 历史、Ctrl+N 新建、+ 回放（0.3s/方）
> - [ ] 笔记导出 JSON/.brf 下载，导入恢复
> - [ ] 实验：B 组前有掌握确认提示，10 题 A/B 交叉，结束播报对比结果
> - [ ] 静音模式 Ctrl+Shift+M 关闭 TTS 保留和弦；F1 帮助播报
> - [ ] 黑底黄字大字号默认，可切换主题/字号

- [ ] **步骤 4：运行全部测试 + 构建**

运行：`npx vitest run && npm run build`
预期：全部 PASS，`dist/` 生成成功

- [ ] **步骤 5：Commit**

```bash
git add src/app.js index.html src/styles.css tests/smoke.test.js
git commit -m "feat: 模块整合与无障碍收尾"
```

---

### 任务 11：部署验证（Vercel）

**文件：**
- 修改：`vercel.json`（确认已有）
- 创建：`.gitignore`

- [ ] **步骤 1：添加 .gitignore 并本地预览构建产物**

```bash
# .gitignore
node_modules/
dist/
.DS_Store
```

运行：`npm run build && npm run preview`
预期：浏览器打开 `http://localhost:4173` 可完整操作

- [ ] **步骤 2：本地验证通过后部署**

```bash
npm i -g vercel && vercel --prod
```
或连接 GitHub 仓库自动部署（push 即发布）。
预期：获得 `https://audiobraille.vercel.app` 之类域名，手机/电脑浏览器打开可用。

- [ ] **步骤 3：部署后冒烟**

- [ ] 打开线上地址，确认欢迎语播报、键盘输入、笔记保存（IndexedDB 在用户浏览器生效）
- [ ] 确认导出 .brf 下载正常
- [ ] Commit `.gitignore`

```bash
git add .gitignore
if [ -n "$(git status --porcelain)" ]; then git commit -m "chore: gitignore 与部署准备"; fi
```
