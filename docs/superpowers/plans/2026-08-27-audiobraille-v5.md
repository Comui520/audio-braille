# AudioBraille v5 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 AudioBraille 从"教学/实验"扩展为四模块学习（中文拼音/英文/符号/数字）、逐方确认输入（`*`/`/` 切换）、AudioBraille 测试含展示环节、可调倍速听书、笔记双模式朗读的完整平台。

**架构：** 纯前端 SPA。新增 `src/data/symbols.js`（标点数据）、`src/reader.js`（听书）；重构 `src/teaching.js`（四子模块）、`src/input.js`（逐方确认 + `*`/`/`）、`src/experiment.js`（展示环节 + 三类辨识）、`src/notes.js`（双模式朗读）；`braille-engine.js` 增加符号编码。盲文编码仍以规格 v2 第 2 节为唯一权威，标点来自 GB/T 15720-2008 与 UEB。

**技术栈：** Vite 5 + Vitest 2 + fake-indexeddb（不变），Web Audio API（AudioBraille 编码）、Web Speech API（TTS）。

---

## 文件结构

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/braille-engine.js` | 修改 | 增加 `SYMBOLS_CN`/`SYMBOLS_EN` 编码、`symbolToDots` |
| `src/data/symbols.js` | 创建 | 中英标点 10 个数据表（含名称/点位/分类） |
| `src/input.js` | 重构 | 逐方确认输入（`*`下一个/`/`上一个/0提交），点位顺序无关 |
| `src/teaching.js` | 重构 | 四子模块（pinyin/latin/symbols/digits）学→练→考，学阶段逐步引导 |
| `src/experiment.js` | 重构 | 展示环节（左右声道对应关系）+ 数字/字母/拼音辨识 |
| `src/reader.js` | 创建 | 听书：可调倍速 AudioBraille 朗读 + 听懂问卷 |
| `src/notes.js` | 修改 | 双模式朗读（TTS 转读 / AudioBraille 直接读）+ 速度可调 |
| `src/app.js` | 重构 | 首页三入口（学习/输入/测试）+ 导航到四子模块 |
| `src/i18n.js` | 修改 | 新增全部文案（学习子模块/展示/听书/笔记朗读） |
| `src/styles.css` | 修改 | 首页入口卡片、子模块导航样式 |
| `index.html` | 修改 | 首页结构 |
| `tests/*` | 新增/修改 | 每个模块对应测试 |

---

### 任务 1：符号盲文数据表

**文件：**
- 创建：`src/data/symbols.js`
- 测试：`tests/symbols.test.js`

- [ ] **步骤 1：编写失败的测试**

```js
// tests/symbols.test.js
import { describe, it, expect } from 'vitest'
import { SYMBOLS_CN, SYMBOLS_EN, symbolToDots } from '../src/data/symbols.js'

describe('中文标点（GB/T 15720-2008）', () => {
  it('句号=点5+点23，逗号=点5', () => {
    expect(symbolToDots('cn', '。')).toEqual([5, 2, 3])
    expect(symbolToDots('cn', '，')).toEqual([5])
  })
  it('问号=点5+点3，叹号=点56+点2', () => {
    expect(symbolToDots('cn', '？')).toEqual([5, 3])
    expect(symbolToDots('cn', '！')).toEqual([5, 6, 2])
  })
  it('分号=点56，冒号=点36，顿号=点4', () => {
    expect(symbolToDots('cn', '；')).toEqual([5, 6])
    expect(symbolToDots('cn', '：')).toEqual([3, 6])
    expect(symbolToDots('cn', '、')).toEqual([4])
  })
  it('覆盖 10 个常用标点', () => {
    expect(Object.keys(SYMBOLS_CN)).toHaveLength(10)
  })
})

describe('英文标点（UEB）', () => {
  it('逗号=点2，句号=点256', () => {
    expect(symbolToDots('en', ',')).toEqual([2])
    expect(symbolToDots('en', '.')).toEqual([2, 5, 6])
  })
  it('问号=点236，叹号=点23456', () => {
    expect(symbolToDots('en', '?')).toEqual([2, 3, 6])
    expect(symbolToDots('en', '!')).toEqual([2, 3, 4, 5, 6])
  })
  it('覆盖 10 个常用标点', () => {
    expect(Object.keys(SYMBOLS_EN)).toHaveLength(10)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/symbols.test.js`
预期：FAIL，`Cannot find module '../src/data/symbols.js'`

- [ ] **步骤 3：编写实现代码**

```js
// src/data/symbols.js
// 标点盲文编码——权威来源：
//   中文：GB/T 15720-2008《中国盲文》4.3 标点符号
//   英文：UEB (Unified English Braille) 标点表
// 多方式标点用逗号分隔多个"方"（每方是点集合）

// 中文标点（GB/T 15720-2008）：值 = 每方点位数组的数组
// 句号(5,23) 逗号(5) 顿号(4) 分号(56) 问号(5,3) 叹号(56,2) 冒号(36) 省略号(5,5,5) 引号(56,235) 括号(5,2356,5,12356)
export const SYMBOLS_CN = {
  '。': [[5], [2, 3]],        // 句号：点5 + 点23
  '，': [[5]],                // 逗号：点5
  '、': [[4]],                // 顿号：点4
  '；': [[5, 6]],             // 分号：点56
  '：': [[3, 6]],             // 冒号：点36
  '？': [[5], [3]],           // 问号：点5 + 点3
  '！': [[5, 6], [2]],        // 叹号：点56 + 点2
  '…': [[5], [5], [5]],       // 省略号：点5×3
  '“': [[5, 6], [2, 3, 5]],   // 左引号
  '”': [[5, 6], [2, 3, 5]],   // 右引号（同左引号点位）
  '（': [[5], [2, 3, 5, 6]],  // 左括号
  '）': [[5], [1, 2, 3, 5, 6]] // 右括号
}

// 英文标点（UEB）：单方
export const SYMBOLS_EN = {
  ',': [[2]],
  '.': [[2, 5, 6]],
  '?': [[2, 3, 6]],
  '!': [[2, 3, 4, 5, 6]],
  ';': [[2, 3]],
  ':': [[2, 5]],
  '“': [[6], [2]],
  '”': [[6], [5]],
  '(': [[6], [1, 2, 6]],
  ')': [[6], [3, 4, 5]]
}

// 语言 → 符号表
const TABLES = { cn: SYMBOLS_CN, en: SYMBOLS_EN }

// 符号 → 点位数组（多方便平铺，每方之间用 -1 分隔？不用：直接返回每方数组的数组）
export function symbolToDots(lang, ch) {
  const table = TABLES[lang] || SYMBOLS_CN
  return table[ch] ? table[ch].map(f => [...f]) : null
}

// 中文标点名称（教学用）
export const CN_SYMBOL_NAMES = {
  '。': '句号', '，': '逗号', '、': '顿号', '；': '分号', '：': '冒号',
  '？': '问号', '！': '叹号', '…': '省略号', '“': '左引号', '”': '右引号',
  '（': '左括号', '）': '右括号'
}

// 英文标点名称（教学用）
export const EN_SYMBOL_NAMES = {
  ',': 'comma', '.': 'period', '?': 'question mark', '!': 'exclamation mark',
  ';': 'semicolon', ':': 'colon', '“': 'quote open', '”': 'quote close',
  '(': 'left paren', ')': 'right paren'
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/symbols.test.js`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/data/symbols.js tests/symbols.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 符号盲文数据表（中文 GB/T15720 + 英文 UEB 各10个）"
```

---

### 任务 2：输入逐方确认 + `*`/`/` 切换

**文件：**
- 修改：`src/input.js`
- 测试：`tests/input.test.js`（扩展）

- [ ] **步骤 1：编写失败的测试**

```js
// tests/input.test.js 追加
import { nextCell, prevCell, cellLabel } from '../src/input.js'

describe('逐方确认输入（v5）', () => {
  it('nextCell：声母→韵母→声调→提交', () => {
    expect(nextCell('initial')).toBe('final')
    expect(nextCell('final')).toBe('tone')
    expect(nextCell('tone')).toBe('commit')
  })
  it('prevCell：回退', () => {
    expect(prevCell('final')).toBe('initial')
    expect(prevCell('tone')).toBe('final')
    expect(prevCell('initial')).toBe('initial')
  })
  it('cellLabel：阶段名', () => {
    expect(cellLabel('initial')).toBe('声母')
    expect(cellLabel('final')).toBe('韵母')
    expect(cellLabel('tone')).toBe('声调')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/input.test.js`
预期：FAIL，`nextCell is not exported`

- [ ] **步骤 3：修改 input.js**

在 `src/input.js` 添加：

```js
// 逐方确认状态机（v5：拼音 声母→韵母→声调；英文字母单方）
export const CELL_ORDER = ['initial', 'final', 'tone']
export function nextCell(stage) {
  const i = CELL_ORDER.indexOf(stage)
  if (i === -1 || i >= CELL_ORDER.length - 1) return 'commit'
  return CELL_ORDER[i + 1]
}
export function prevCell(stage) {
  const i = CELL_ORDER.indexOf(stage)
  if (i <= 0) return 'initial'
  return CELL_ORDER[i - 1]
}
export function cellLabel(stage) {
  return { initial: '声母', final: '韵母', tone: '声调' }[stage] || '提交'
}
```

并将 `nextStageAfterConfirm` 替换为基于 `nextCell` 的实现（保留原导出名以兼容旧测试）：

```js
export function nextStageAfterConfirm(stage, withTone) {
  if (stage === 'initial') return 'final'
  if (stage === 'final') return withTone ? 'tone' : 'commit'
  if (stage === 'tone') return 'commit'
  return 'commit'
}
```

（此函数已正确，无需改——`nextCell`/`prevCell` 是 v5 新增独立导出。）

- [ ] **步骤 4：在 keydown 中接入 `*` 和 `/`**

在 `src/input.js` 的 `switch (e.key)` 中新增：

```js
case '*': {   // 下一个：进入下一阶段（声母→韵母→声调）
  e.preventDefault()
  if (state.currentPage !== 'teaching') break
  const cur = state.inputStage
  if (cur === 'tone') {
    // 已到最后阶段：无点位直接提交（输入器）
    const dots = state.brailleDots.map((v, i) => (v ? i + 1 : 0)).filter(Boolean)
    if (dots.length === 0) { speak(t('press0Submit')); break }
  }
  state.inputStage = nextStageAfterConfirm(cur, withTone())
  render()
  break
}
case '/': {   // 上一个：回退到上一阶段
  e.preventDefault()
  if (state.currentPage !== 'teaching') break
  state.inputStage = prevCell(state.inputStage)
  render()
  break
}
```

- [ ] **步骤 5：运行测试验证通过**

运行：`npx vitest run tests/input.test.js`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add src/input.js tests/input.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 输入逐方确认——*下一个//上一个阶段切换"
```

---

### 任务 3：教学四子模块（pinyin/latin/symbols/digits）

**文件：**
- 重构：`src/teaching.js`
- 测试：`tests/teaching-v5.test.js`

- [ ] **步骤 1：编写失败的测试**

```js
// tests/teaching-v5.test.js
import { describe, it, expect } from 'vitest'
import { pickLessonItem, LESSON_TYPES, TONE_NAMES } from '../src/teaching.js'

describe('教学四子模块（v5）', () => {
  it('LESSON_TYPES 含四种', () => {
    expect(LESSON_TYPES).toEqual(['pinyin', 'latin', 'symbols', 'digits'])
  })
  it('TONE_NAMES：1=阴平 2=阳平 3=上声 4=去声', () => {
    expect(TONE_NAMES['1']).toBe('阴平')
    expect(TONE_NAMES['2']).toBe('阳平')
    expect(TONE_NAMES['3']).toBe('上声')
    expect(TONE_NAMES['4']).toBe('去声')
  })
  it('pickLessonItem：pinyin 出声母题', () => {
    const item = pickLessonItem('pinyin', 0)
    expect(item.type).toBe('initial')
    expect(item.dots).toBeDefined()
  })
  it('pickLessonItem：latin 出字母题', () => {
    const item = pickLessonItem('latin', 0)
    expect(item.type).toBe('letter')
    expect(item.label).toBe('a')
  })
  it('pickLessonItem：symbols 出符号题', () => {
    const item = pickLessonItem('symbols', 0)
    expect(item.type).toBe('symbol')
    expect(item.dots).toBeDefined()
  })
  it('pickLessonItem：digits 出数字题', () => {
    const item = pickLessonItem('digits', 0)
    expect(item.type).toBe('digit')
    expect(item.dots).toBeDefined()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/teaching-v5.test.js`
预期：FAIL，`LESSON_TYPES is not exported`

- [ ] **步骤 3：重构 teaching.js**

核心：`initTeaching({ state, render, storage, kind })`，`kind ∈ LESSON_TYPES`；内部保留学→练→考三阶段，学阶段逐步引导。

```js
// src/teaching.js（v5 重构——四子模块）
import { speak } from './speech.js'
import { t } from './i18n.js'
import { LATIN_LETTERS, latinToDots, dotsToLatin } from './braille-engine.js'
import { INITIALS, FINALS, TONES, syllableToDots, dotsToUnicode } from './braille-engine.js'
import { SYMBOLS_CN, SYMBOLS_EN, symbolToDots, CN_SYMBOL_NAMES, EN_SYMBOL_NAMES } from './data/symbols.js'
import { playAudioBraille } from './audio-braille.js'

export const LESSON_TYPES = ['pinyin', 'latin', 'symbols', 'digits']
export const TONE_NAMES = { '1': '阴平', '2': '阳平', '3': '上声', '4': '去声' }

// 出题（纯逻辑）
export function pickLessonItem(kind, index, lang = 'zh') {
  if (kind === 'latin') {
    const letters = Object.keys(LATIN_LETTERS)
    const letter = letters[index % letters.length]
    return { type: 'letter', label: letter, dots: latinToDots(letter) }
  }
  if (kind === 'symbols') {
    const table = lang === 'en' ? SYMBOLS_EN : SYMBOLS_CN
    const names = lang === 'en' ? EN_SYMBOL_NAMES : CN_SYMBOL_NAMES
    const keys = Object.keys(table)
    const ch = keys[index % keys.length]
    return { type: 'symbol', label: names[ch] || ch, ch, dots: table[ch] }
  }
  if (kind === 'digits') {
    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
    const d = digits[index % digits.length]
    // 数字 = 数字符号(3456) + 对应字母方
    const letterMap = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e', '6': 'f', '7': 'g', '8': 'h', '9': 'i', '0': 'j' }
    return { type: 'digit', label: d, dots: [[3, 4, 5, 6], ...(latinToDots(letterMap[d]) ? [latinToDots(letterMap[d])] : [])] }
  }
  // pinyin：声母 → 韵母 → 带调音节 轮换
  const initials = Object.keys(INITIALS).filter(k => !['j', 'q', 'x'].includes(k))
  const finals = Object.keys(FINALS)
  const tones = Object.keys(TONES)
  const i = index % (initials.length + finals.length + 10)
  if (i < initials.length) {
    const inits = initials[i]
    return { type: 'initial', label: inits, dots: INITIALS[inits] }
  }
  if (i < initials.length + finals.length) {
    const fin = finals[i - initials.length]
    return { type: 'final', label: fin, dots: FINALS[fin] }
  }
  // 带调音节：声母+韵母+声调
  const m = ['m', 'b', 'l', 'n', 'h', 'd', 'g', 'z', 'sh', 'w']
  const f = ['a', 'a', 'e', 'i', 'ao', 'a', 'e', 'ao', 'i', 'o']
  const tone = tones[(i - initials.length - finals.length) % tones.length]
  const mi = (i - initials.length - finals.length) % m.length
  const init = m[mi], fin = f[mi]
  return { type: 'syllable', initial: init, final: fin, tone, dots: syllableToDots(init, fin, tone), label: `${init}${fin}${TONE_NAMES[tone] || ''}` }
}
```

`initTeaching` 内部结构（学→练→考）：

```js
export function initTeaching({ state, render, storage, kind = 'latin' }) {
  const reviewer = createReviewer()
  let phase = 'learn'       // learn | practice | exam
  let currentItem = null
  let index = 0
  let lessonEl = null
  let withTone = true       // 拼音全标调

  function setLesson(msg) { if (lessonEl) lessonEl.textContent = msg }

  function next() {
    if (phase === 'exam' && index >= 10) {
      const acc = Math.round((index - reviewer.reviewQueue().length) / 10 * 100)
      const msg = t('examOver', { accuracy: String(Math.max(0, acc)) })
      speak(msg); setLesson(msg)
      index = 0
      return
    }
    currentItem = pickLessonItem(kind, index)
    const L = currentItem.label
    if (phase === 'learn') {
      // 学：逐步引导——先介绍键位规则，再演示
      const hint = keyHintForDots(currentItem.dots)
      speak(t('learnItem', { label: L, hint }))
      setLesson(t('learnItem', { label: L, hint }))
    } else if (phase === 'practice') {
      speak(t('practiceItem', { label: L }))
      setLesson(t('practiceItem', { label: L }))
    } else {
      speak(t('q', { label: L }) + '，' + t('press0Submit'))
      setLesson(t('q', { label: L }) + '（' + t('press0Submit') + '）')
    }
    state.clearDots()
  }
  // ... checkAnswer / view / bind 同 v4，但 kind 参数化
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/teaching-v5.test.js`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/teaching.js tests/teaching-v5.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 教学四子模块（拼音/字母/符号/数字），pickLessonItem 纯逻辑可测"
```

---

### 任务 4：AudioBraille 测试——展示环节 + 三类辨识

**文件：**
- 重构：`src/experiment.js`
- 测试：`tests/experiment-v5.test.js`

- [ ] **步骤 1：编写失败的测试**

```js
// tests/experiment-v5.test.js
import { describe, it, expect } from 'vitest'
import { buildShowcase, SHOWCASE_DOTS } from '../src/experiment.js'

describe('AudioBraille 展示环节（v5）', () => {
  it('SHOWCASE_DOTS：左列1/2/3 + 右列4/5/6', () => {
    expect(SHOWCASE_DOTS).toEqual([[1], [2], [3], [4], [5], [6]])
  })
  it('buildShowcase 生成播报文案（点1左耳高音）', () => {
    const s = buildShowcase()
    expect(s[0].dot).toBe(1)
    expect(s[0].desc).toContain('左')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/experiment-v5.test.js`
预期：FAIL，`SHOWCASE_DOTS is not exported`

- [ ] **步骤 3：重构 experiment.js**

```js
// src/experiment.js（v5——展示环节 + 三类辨识）
import { playAudioBraille } from './audio-braille.js'
import { speak } from './speech.js'
import { t } from './i18n.js'
import { LATIN_LETTERS, latinToDots } from './braille-engine.js'
import { SYMBOLS_CN, SYMBOLS_EN } from './data/symbols.js'
import { INITIALS, FINALS, TONES, syllableToDots } from './braille-engine.js'

// 展示环节：左右声道对应关系
export const SHOWCASE_DOTS = [[1], [2], [3], [4], [5], [6]]
export function buildShowcase() {
  // 点1/2/3 = 左列（正弦波），点4/5/6 = 右列（方波）
  return SHOWCASE_DOTS.map(dots => {
    const d = dots[0]
    const side = d <= 3 ? '左' : '右'
    const row = d % 3 === 1 ? '高音' : d % 3 === 2 ? '中音' : '低音'
    return { dot: d, dots, desc: `点${d}：${side}耳${row}` }
  })
}

// 三类辨识题源
export function pickLetters(n = 10) { return [...Object.keys(LATIN_LETTERS)].sort(() => Math.random() - 0.5).slice(0, n) }
export function pickSyllables(n = 10) {
  const pool = [
    { initial: 'm', final: 'a', tone: '1' }, { initial: 'b', final: 'a', tone: '1' },
    { initial: 'h', final: 'ao', tone: '3' }, { initial: 'n', final: 'i', tone: '3' },
    { initial: 'l', final: 'e', tone: '4' }, { initial: 'd', final: 'a', tone: '1' },
    { initial: 'g', final: 'e', tone: '1' }, { initial: 'sh', final: 'i', tone: '4' },
    { initial: 'z', final: 'ao', tone: '3' }, { initial: 'x', final: 'ue', tone: '2' }
  ]
  return pool.sort(() => Math.random() - 0.5).slice(0, n)
}
export function pickSymbols(n = 10, lang = 'zh') {
  const table = lang === 'en' ? SYMBOLS_EN : SYMBOLS_CN
  return Object.keys(table).sort(() => Math.random() - 0.5).slice(0, n)
}
```

`initExperiment` 状态机：

```js
// stage: idle → showcase(展示) → confirm → trials(辨识) → done
// trials 由 mode 决定：letters | syllables | symbols | digits
export function initExperiment({ state, render }) {
  const exp = createExperiment()  // { addTrial(dots, guess, timeSec, correct), summarize() }
  let stage = 'idle'
  let current = null
  let mode = 'letters'
  let trials = []
  let idx = 0

  function setStatus(msg) { const el = document.querySelector('#exp-status'); if (el) el.textContent = msg }

  function playCurrent() { if (current) playAudioBraille(current.dots, { duration: 0.5 }) }

  function nextTrial() {
    if (idx >= trials.length) {
      stage = 'done'
      const s = exp.summarize()
      const acc = Math.round(s.accuracy * 100)
      const msg = t('expDone', { accuracy: String(acc), time: s.avgTime.toFixed(1) })
      setStatus(msg); speak(msg)
      return
    }
    const item = trials[idx]
    current = { ...item, startTime: performance.now() }
    setStatus(t('expListen', { label: String(idx + 1), total: String(trials.length) }))
  }

  return {
    exp, mode: () => mode,
    view() {
      const sec = document.createElement('section')
      sec.innerHTML = `<h1>${t('expTitle')}</h1>
        <div class="exp-modes">
          <button data-exp-mode="letters">${t('expModeLetters')}</button>
          <button data-exp-mode="syllables">${t('expModeSyllables')}</button>
          <button data-exp-mode="symbols">${t('expModeSymbols')}</button>
          <button data-exp-mode="digits">${t('expModeDigits')}</button>
        </div>
        <button data-exp="start">${t('expStart')}</button>
        <div id="exp-status" aria-live="polite"></div>`
      return sec
    },
    bind(container) {
      container.querySelector('[data-exp="start"]')?.addEventListener('click', () => this.start())
      container.querySelectorAll('[data-exp-mode]').forEach(btn => {
        btn.addEventListener('click', () => { mode = btn.dataset.expMode })
      })
    },
    start() {
      // 先展示，再确认，再测试
      stage = 'showcase'
      const showcase = buildShowcase()
      setStatus(t('expShowcase'))
      // 逐个播放展示音频（每个 0.5s，间隔 0.3s）
      showcase.forEach((s, i) => {
        setTimeout(() => {
          playAudioBraille(s.dots, { duration: 0.5 })
          speak(s.desc)
        }, i * 900)
      })
      // 展示完后进入 confirm
      setTimeout(() => {
        stage = 'confirm'
        setStatus(t('expConfirm'))
        speak(t('expConfirm'))
      }, showcase.length * 900 + 500)
    },
    handleKey0(dots) {
      if (stage === 'confirm') {
        stage = 'trials'; idx = 0
        trials = buildTrials(mode)
        speak(t('expIntro'))
        nextTrial()
        return
      }
      if (stage === 'trials') {
        if (dots.length === 0) { playCurrent(); return }  // 重听
        submitGuess(dots)
      }
    },
    replay() { playCurrent() }
  }

  function buildTrials(m) {
    if (m === 'letters') return pickLetters(10).map(letter => ({ kind: 'letter', label: letter, dots: latinToDots(letter) }))
    if (m === 'syllables') return pickSyllables(10).map(s => ({ kind: 'syllable', label: `${s.initial}${s.final}${TONE_NAMES[s.tone]}`, dots: syllableToDots(s.initial, s.final, s.tone) }))
    if (m === 'symbols') return pickSymbols(10).map(ch => ({ kind: 'symbol', label: ch, dots: SYMBOLS_CN[ch] || SYMBOLS_EN[ch] }))
    // digits
    const letterMap = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e', '6': 'f', '7': 'g', '8': 'h', '9': 'i', '0': 'j' }
    return Object.keys(letterMap).sort(() => Math.random() - 0.5).slice(0, 10).map(d => ({
      kind: 'digit', label: d,
      dots: [[3, 4, 5, 6], latinToDots(letterMap[d])]
    }))
  }

  function submitGuess(guessDots) {
    const correct = gradeDots(current.dots.flat(), guessDots)
    const elapsed = (performance.now() - current.startTime) / 1000
    exp.addTrial(current.dots.flat(), guessDots, elapsed, correct)
    speak(correct ? t('correct') : t('expWrong', { letter: current.label }))
    setStatus(correct ? t('correct') : t('expWrong', { letter: current.label }))
    state.clearDots()
    idx++
    setTimeout(nextTrial, 1600)
  }
}
```

（保留 `createExperiment`/`summarize`/`gradeDots`/`pickTrialDots`/`createAudioTrial` 原导出，供旧测试兼容。）

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/experiment-v5.test.js tests/experiment.test.js`
预期：PASS（旧测试兼容）

- [ ] **步骤 5：Commit**

```bash
git add src/experiment.js tests/experiment-v5.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 实验展示环节（左右声道对应）+ 四类辨识（字母/音节/符号/数字）"
```

---

### 任务 5：听书（可调倍速 AudioBraille 朗读 + 听懂问卷）

**文件：**
- 创建：`src/reader.js`
- 测试：`tests/reader.test.js`

- [ ] **步骤 1：编写失败的测试**

```js
// tests/reader.test.js
import { describe, it, expect } from 'vitest'
import { buildReadingDots, SAMPLE_TEXT, clampSpeed } from '../src/reader.js'

describe('听书（v5）', () => {
  it('SAMPLE_TEXT 内置示例短文', () => {
    expect(SAMPLE_TEXT.length).toBeGreaterThan(20)
  })
  it('clampSpeed 限制在 0.5~5x', () => {
    expect(clampSpeed(6)).toBe(5)
    expect(clampSpeed(0.2)).toBe(0.5)
    expect(clampSpeed(2)).toBe(2)
  })
  it('buildReadingDots 把文本转成点位序列（拼音音节逐方）', () => {
    const seq = buildReadingDots('ma')
    expect(seq.length).toBeGreaterThan(0)
    expect(seq[0]).toEqual([1, 3, 4])   // m
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/reader.test.js`
预期：FAIL，`Cannot find module '../src/reader.js'`

- [ ] **步骤 3：编写实现**

```js
// src/reader.js —— 听书：可调倍速 AudioBraille 朗读
import { playAudioBraille } from './audio-braille.js'
import { INITIALS, FINALS, TONES, syllableToDots } from './braille-engine.js'

// 内置示例短文（拼音转写）
export const SAMPLE_TEXT = 'mā ma hé wǒ yì qǐ xué xí máng wén'

// 拼音音节表（声母+韵母+声调 → 点位序列）
const SYLLABLE_RE = /^([a-z]+)([1-4])?$/
export function syllableToDotsSeq(syllable) {
  const m = syllable.match(SYLLABLE_RE)
  if (!m) return []
  const pinyin = m[1], tone = m[2]
  // 找声母（最长匹配）：b p m f d t n l g k h j q x zh ch sh r z c s
  const INITIAL_LIST = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's']
  let initial = '', final = pinyin
  for (const ini of INITIAL_LIST) {
    if (pinyin.startsWith(ini) && pinyin.length > ini.length) { initial = ini; final = pinyin.slice(ini.length); break }
  }
  if (!INITIALS[initial]) { initial = '' }
  if (!FINALS[final]) return []
  return syllableToDots(initial || '', final, tone || null).map(d => [...d])
}

// 把文本（空格分隔的音节串）转成点位序列
export function buildReadingDots(text) {
  return text.split(/\s+/).flatMap(w => syllableToDotsSeq(w))
}

// 速度限制
export function clampSpeed(x) {
  return Math.min(5, Math.max(0.5, x))
}

// 朗读控制器
export function createReader({ onTick = null } = {}) {
  let speed = 1
  let playing = false
  let cancel = null
  return {
    setSpeed(s) { speed = clampSpeed(s) },
    getSpeed() { return speed },
    async play(text) {
      if (playing) return
      playing = true
      const seq = buildReadingDots(text)
      for (let i = 0; i < seq.length; i++) {
        if (!playing) break
        const dur = 0.5 / speed   // 倍速：越快每方越短
        await playAudioBraille(seq[i], { duration: dur })
        onTick?.(i, seq.length)
        await new Promise(r => setTimeout(r, 100 / speed))
      }
      playing = false
    },
    stop() { playing = false }
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/reader.test.js`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/reader.js tests/reader.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 听书模块——可调倍速 AudioBraille 朗读（0.5x~5x）"
```

---

### 任务 6：笔记双模式朗读

**文件：**
- 修改：`src/notes.js`
- 测试：`tests/notes-v5.test.js`

- [ ] **步骤 1：编写失败的测试**

```js
// tests/notes-v5.test.js
import { describe, it, expect } from 'vitest'
import { buildPlaybackSequence, plainToSpeech } from '../src/notes.js'

describe('笔记双模式朗读（v5）', () => {
  it('plainToSpeech：盲文文本 → TTS 可读文本', () => {
    // ⠍ = m，⠛ = g（拉丁字母）
    expect(plainToSpeech('⠍⠛')).toBe('m g')
  })
  it('buildPlaybackSequence 保留（逐方播放）', () => {
    expect(buildPlaybackSequence([[1, 3, 4]])).toEqual([[1, 3, 4]])
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/notes-v5.test.js`
预期：FAIL，`plainToSpeech is not exported`

- [ ] **步骤 3：修改 notes.js**

```js
// 盲文文本 → TTS 可读文本（拉丁字母逐方转写，空格分隔）
import { dotsToLatin } from './braille-engine.js'
export function plainToSpeech(text) {
  return [...text]
    .filter(ch => ch.codePointAt(0) >= 0x2800 && ch.codePointAt(0) <= 0x28ff)
    .map(ch => {
      const dots = unicodeToDots(ch)
      return dotsToLatin(dots) || '·'
    })
    .join(' ')
}
```

并在 `initNotes` 返回对象中新增：

```js
// 双模式朗读：mode = 'tts'（盲文转文字 TTS）| 'braille'（AudioBraille 直接读）
async readAloud(mode = 'tts', speed = 1) {
  const dotsSeq = extractDotsFromText(current.plain)
  if (mode === 'tts') {
    const text = plainToSpeech(current.plain)
    speak(text || t('notesEmpty'))
    return
  }
  // AudioBraille 直接读：速度可调
  const { playAudioBraille } = await import('./audio-braille.js')
  for (const dots of dotsSeq) {
    await playAudioBraille(dots, { duration: 0.4 / speed })
    await new Promise(r => setTimeout(r, 120 / speed))
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run tests/notes-v5.test.js tests/notes.test.js`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/notes.js tests/notes-v5.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 笔记双模式朗读（TTS转读/AudioBraille直接读，速度可调）"
```

---

### 任务 7：页面架构重组（首页三入口 + 导航）

**文件：**
- 重构：`src/app.js`
- 修改：`index.html`、`src/styles.css`

- [ ] **步骤 1：重构 app.js**

页面视图注册表改为：

```js
const PAGES = {
  home: () => homeView(),            // 首页三入口
  teaching: () => teaching.view(),   // 学习（内四子模块）
  input: () => inputView(),          // 在线输入测试
  notes: () => notes.view(),         // 笔记
  experiment: () => experiment.view() // 新功能测试
}
```

首页视图（三入口卡片）：

```js
function homeView() {
  const sec = document.createElement('section')
  sec.className = 'home'
  sec.innerHTML = `
    <h1>${t('welcome')}</h1>
    <div class="home-cards">
      <button class="home-card" data-nav="teaching">📖 ${t('navTeaching')}</button>
      <button class="home-card" data-nav="input">⌨️ ${t('navInput')}</button>
      <button class="home-card" data-nav="experiment">🎧 ${t('navExperiment')}</button>
    </div>
    <div class="home-cards">
      <button class="home-card" data-nav="notes">📝 ${t('navNotes')}</button>
      <button class="home-card" data-nav="reader">📻 ${t('navReader')}</button>
    </div>`
  return sec
}
```

启动门解锁后 `state.currentPage = 'home'`，导航 click 处理 `data-nav`。

- [ ] **步骤 2：修改 index.html**

导航改为：首页 / 学习 / 输入 / 测试 / 笔记 / 听书

```html
<nav aria-label="主导航" class="main-nav">
  <button data-page="home" aria-current="true">首页</button>
  <button data-page="teaching">学习</button>
  <button data-page="input">输入</button>
  <button data-page="experiment">测试</button>
  <button data-page="notes">笔记</button>
  <button data-page="reader">听书</button>
</nav>
```

- [ ] **步骤 3：修改 styles.css**

新增 `.home-cards`、`.home-card`、`.exp-modes` 样式：

```css
.home-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1em; margin: 1.5em 0; }
.home-card {
  padding: 2em 1em;
  font-size: 1.2em;
  font-weight: 700;
  border-radius: var(--radius);
  background: var(--card);
  border: 2px solid var(--border);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}
.home-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.exp-modes { display: flex; gap: 0.4em; flex-wrap: wrap; margin: 1em 0; }
```

- [ ] **步骤 4：浏览器验证**

运行：`npm run build && node node_modules/vite/bin/vite.js preview --port 4173`
预期：首页显示三入口卡片，点击进入对应模块

- [ ] **步骤 5：Commit**

```bash
git add src/app.js index.html src/styles.css
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 页面架构重组——首页三入口卡片 + 六页导航（含听书）"
```

---

### 任务 8：i18n 补全 + 全量验证

**文件：**
- 修改：`src/i18n.js`
- 测试：全量

- [ ] **步骤 1：补充文案**

在 `src/i18n.js` 的 zh 和 en 字典中新增（键必须两边都有）：

```js
// zh
navReader: '听书',
homeTitle: 'AudioBraille 盲文学习平台',
expModeLetters: '字母辨识',
expModeSyllables: '拼音音节辨识',
expModeSymbols: '符号辨识',
expModeDigits: '数字辨识',
expShowcase: '先听每个点的声音：左列在左耳（正弦），右列在右耳（方波）',
readerTitle: '听书',
readerSpeed: '速度',
readerPlay: '播放',
readerStop: '停止',
readerUnderstand: '你能听懂吗？',
readerYes: '能听懂',
readerNo: '听不懂',
notesReadTTS: 'TTS朗读',
notesReadBraille: '盲文朗读',
```

```js
// en（一一对应）
navReader: 'Reader',
homeTitle: 'AudioBraille Braille Learning Platform',
expModeLetters: 'Letters',
expModeSyllables: 'Syllables',
expModeSymbols: 'Symbols',
expModeDigits: 'Digits',
expShowcase: 'First listen to each dot: left column in left ear (sine), right column in right ear (square)',
readerTitle: 'Reader',
readerSpeed: 'Speed',
readerPlay: 'Play',
readerStop: 'Stop',
readerUnderstand: 'Can you understand?',
readerYes: 'Yes',
readerNo: 'No',
notesReadTTS: 'TTS read',
notesReadBraille: 'Braille read',
```

- [ ] **步骤 2：全量测试**

运行：`npx vitest run`
预期：所有测试通过

- [ ] **步骤 3：构建 + 浏览器端到端验证**

运行：`npm run build`，然后 preview 验证：
1. 启动门 → 按 0 → 首页三入口
2. 学习 → 四子模块切换
3. 输入 → 逐方确认（`*` 下一个）
4. 测试 → 展示环节 → 辨识
5. 笔记 → 双模式朗读
6. 听书 → 倍速播放

- [ ] **步骤 4：Commit**

```bash
git add src/i18n.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: i18n 补全（听书/展示/笔记朗读文案）+ 全量验证"
```

---

## 审查检查点

- **检查点 1（任务 1-3 后）**：符号数据表与 GB/T 15720/UEB 逐项比对；输入 `*`/`/` 状态机；教学四子模块出题
- **检查点 2（任务 4-6 后）**：实验展示环节音频编码正确；听书倍速；笔记双模式朗读
- **检查点 3（任务 7-8 后）**：页面架构、i18n 键一致性、全量测试 + 浏览器端到端

**审查配方**（子代理 fresh 上下文，只读）：文件清单 + 检查清单 + 与规格逐项比对，不执行命令不写文件。

---

## 已知风险与对策

| 风险 | 对策 |
|---|---|
| 标点点位记忆错误 | 任务 1 测试逐项断言 GB/T 15720/UEB 查证值；审查检查点 1 逐项比对 |
| `*`/`/` 与 NVDA/JAWS 快捷键冲突 | 仅在非组合键、无修饰键时拦截；小键盘区键 |
| 多方式符号（中文标点 2 方）评分 | `gradeDots` 用 `flat()` 展平后无序比较 |
| AudioBraille 倍速播放 CPU | 每方 duration 缩短，间隔缩短；停止按钮中断循环 |
| i18n 键漏翻译 | 任务 8 测试断言 zh/en 键集合一致（已有） |
