# v12 学习体验修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 完善中文拼音音节课程覆盖、修正多方键位提示，并消除学习页 AudioBraille 与 TTS 的音频重叠。

**架构：** 音节课程使用独立的 391 个无声调有效基础音节清单；列表中的基础音节只出现一次，声调作为单项页的选择状态。现有盲文引擎仍负责声母、韵母、声调点位和省写规则。键位提示只改变显示/朗读文本的方间分隔符；学习 AudioBraille 播放动作只进入音频播放路径，不调用教学 TTS。

**技术栈：** JavaScript ES modules、Vitest、Vite、Web Speech API、Web Audio API；PowerShell 命令；现有 `INITIALS`、`FINALS`、`syllableToDots()`、`smartTone()` 和 `playCells()`。

---

## 文件清单

- 新增：`src/data/pinyin-syllables.js`——391 个无声调基础音节清单及来源注释。
- 修改：`src/curriculum.js`——使用基础音节清单，增加旧带声调 ID 归一化。
- 修改：`src/teaching.js`——支持基础音节、零声母拼写别名和单项声调覆盖。
- 修改：`src/app-state.js`——教学位置保存当前音节声调选择。
- 修改：`src/app.js`——渲染声调选择；学习 AudioBraille 播放只走音频路径。
- 修改：`src/cells.js`——方间键位提示从 `；` 改为 `*`。
- 修改：`tests/curriculum.test.js`——覆盖 391 项课程和复杂韵母。
- 修改：`tests/teaching-v9.test.js`——覆盖基础音节、声调覆盖和零声母别名。
- 修改：`tests/app-state.test.js`——覆盖教学声调状态。
- 修改：`tests/teaching-v5.test.js`——更新多方键位提示期望。
- 修改：`tests/app-shell.test.js`——覆盖声调选择和 AudioBraille 播放入口契约。
- 新增：`tests/pinyin-syllables.test.js`——校验清单数量、唯一性和关键韵母覆盖。

---

### 任务 1：完整基础音节课程与单项声调选择

**文件：**
- 创建：`src/data/pinyin-syllables.js`。
- 修改：`src/curriculum.js`、`src/teaching.js`、`src/app-state.js`、`src/app.js`。
- 测试：`tests/pinyin-syllables.test.js`、`tests/curriculum.test.js`、`tests/teaching-v9.test.js`、`tests/app-state.test.js`、`tests/app-shell.test.js`。

- [ ] **步骤 1：写失败测试**

在 `tests/pinyin-syllables.test.js` 中增加：

```js
import { describe, it, expect } from 'vitest'
import { PINYIN_SYLLABLES } from '../src/data/pinyin-syllables.js'
import { CURRICULUM } from '../src/curriculum.js'

describe('基础普通话音节清单', () => {
  it('包含 391 个唯一的无声调基础音节', () => {
    expect(PINYIN_SYLLABLES).toHaveLength(391)
    expect(new Set(PINYIN_SYLLABLES).size).toBe(391)
    expect(PINYIN_SYLLABLES.every(item => !/[1-4]$/.test(item))).toBe(true)
  })

  it('覆盖复杂韵母音节', () => {
    for (const item of ['bing', 'ying', 'guang', 'huang', 'jiong', 'qiong', 'bian', 'xian', 'yuan', 'juan', 'xuan']) {
      expect(PINYIN_SYLLABLES).toContain(item)
    }
  })

  it('课程列表直接使用基础清单', () => {
    const items = CURRICULUM.pinyin.sections.find(section => section.id === 'syllables').items
    expect(items).toBe(PINYIN_SYLLABLES)
    expect(items).not.toContain('ba1')
    expect(items).toContain('guang')
  })
})
```

在 `tests/teaching-v9.test.js` 增加：

```js
it('基础音节默认无调，单项声调可以覆盖', () => {
  expect(getTeachingItem('pinyin', 'syllables', 'ba').cells)
    .toEqual([[1, 2], [3, 5]])
  expect(getTeachingItem('pinyin', 'syllables', 'ba', 'zh', '1'))
    .toEqual(expect.objectContaining({ tone: '1', toneName: '阴平', cells: [[1, 2], [3, 5], [1]] }))
})

it('复杂韵母和零声母别名可以生成盲文', () => {
  expect(getTeachingItem('pinyin', 'syllables', 'bing').cells).toHaveLength(2)
  expect(getTeachingItem('pinyin', 'syllables', 'guang').cells).toHaveLength(2)
  expect(getTeachingItem('pinyin', 'syllables', 'yuan').cells).toHaveLength(2)
  expect(getTeachingItem('pinyin', 'syllables', 'ying').cells).toHaveLength(1)
})
```

在 `tests/app-state.test.js` 增加：

```js
it('教学状态保存音节声调选择', () => {
  const next = setTeachingLocation(createAppState(), {
    category: 'pinyin', section: 'syllables', item: 'ba', phase: 'learn', tone: '1'
  })
  expect(next.teaching.tone).toBe('1')
})
```

在 `tests/app-shell.test.js` 增加纯 HTML 契约测试，要求导出 `buildTonePickerHtml()`：

```js
it('音节单项包含五种声调选择', () => {
  const html = buildTonePickerHtml('1')
  expect(html).toContain('data-action="teaching-tone"')
  expect(html).toContain('阴平')
  expect(html).toContain('阳平')
  expect(html).toContain('上声')
  expect(html).toContain('去声')
  expect(html).toContain('无调')
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```text
npx vitest run tests/pinyin-syllables.test.js tests/curriculum.test.js tests/teaching-v9.test.js tests/app-state.test.js tests/app-shell.test.js
```

预期：清单文件不存在，或当前课程仍是 100 个带声调后缀项目；失败原因必须是目标功能缺失，不是测试结构错误。

- [ ] **步骤 3：实现最少代码**

创建 `src/data/pinyin-syllables.js`，写入来源为：

```text
https://raw.githubusercontent.com/sangpham2710/pinyin-practice/main/data/pinyin_syllables.json
```

导出不含声调数字的 391 项 `PINYIN_SYLLABLES`。数据只保存基础书写形式，不用声母和韵母笛卡尔积生成。

在 `src/curriculum.js` 中：

```js
import { PINYIN_SYLLABLES } from './data/pinyin-syllables.js'
```

让 `pinyin.syllables.items` 直接引用该数组，不再保存 `ba1`、`ba2` 等重复项目。

在 `src/teaching.js` 中将 `getTeachingItem` 扩展为兼容可选声调覆盖：

```js
export function getTeachingItem(categoryId, sectionId, itemId, lang = 'zh', toneOverride = null) {
  // 旧 itemId 的末尾 1~4 继续解析为 tone；基础 itemId 使用 toneOverride
}
```

解析顺序：

1. `ba1` 等旧 ID 解析为基础 `ba` 和声调 `1`。
2. 基础 ID `ba` 使用 `toneOverride`，默认 `null`。
3. 使用 `syllableToDots(initial, final, tone)` 生成方序列。
4. 返回 `tone`、`toneName`、`cells` 和 `unicode`。

`parseSyllable()` 必须支持普通拼音书写到现有 `FINALS` 的映射，不修改引擎点位表：

```js
const ZERO_INITIAL_ALIASES = {
  yi: ['','i'], wu: ['','u'], yu: ['','ü'],
  ya: ['','ia'], ye: ['','ie'], yao: ['','iao'], you: ['','iu'],
  yan: ['','ian'], yin: ['','in'], yang: ['','iang'], ying: ['','ing'], yong: ['','iong'],
  wa: ['','ua'], wo: ['','uo'], wai: ['','uai'], wei: ['','ui'],
  wan: ['','uan'], wen: ['','un'], wang: ['','uang'], weng: ['','eng']
}
const JQX_UMAP = { ju: 'ü', jue: 'üe', juan: 'üan', jun: 'ün', qu: 'ü', que: 'üe', quan: 'üan', qun: 'ün', xu: 'ü', xue: 'üe', xuan: 'üan', xun: 'ün' }
```

优先使用已有声母长匹配，再使用这些别名；例如 `yuan` 解析为零声母 `üan`，`guang` 解析为 `g + uang`，`bing` 解析为 `b + ing`。如果清单中有当前 `FINALS` 不支持的项目，测试必须暴露它，不能静默生成空 `cells`。

在 `src/app-state.js` 的 `teaching` 中增加 `tone: null`，`setTeachingLocation()` 复制 `location.tone ?? null`。

在 `src/app.js` 导出：

```js
export function buildTonePickerHtml(selected = null) {
  const tones = [[null, '无调'], ['1', '阴平'], ['2', '阳平'], ['3', '上声'], ['4', '去声']]
  return `<div class="tone-picker" role="group" aria-label="选择声调">${tones.map(([tone, label]) => `<button class="tone-option${selected === tone ? ' is-active' : ''}" data-action="teaching-tone" data-tone="${tone ?? ''}">${label}</button>`).join('')}</div>`
}
```

在音节单项页仅对 `teaching.category === 'pinyin' && teaching.section === 'syllables'` 渲染该选择器，并用：

```js
const item = getTeachingItem('pinyin', 'syllables', teaching.item, getLang(), teaching.tone)
```

切换音节项目时将 `tone` 重置为 `null`；点击 `teaching-tone` 只更新 `state.teaching.tone`、清除当前答题缓冲并重新渲染。页面显示所选声调名称和实际方数；若 `smartTone` 省写导致实际方数减少，显示“按国家通用盲文规则省写”说明。

- [ ] **步骤 4：运行目标测试验证通过**

运行：

```text
npx vitest run tests/pinyin-syllables.test.js tests/curriculum.test.js tests/teaching-v9.test.js tests/app-state.test.js tests/app-shell.test.js
```

预期：所有目标测试通过，旧 `ba1` 兼容测试仍通过。

- [ ] **步骤 5：运行完整回归和构建**

运行：

```text
npx vitest run
npm run build
```

预期：全量测试和构建成功。

- [ ] **步骤 6：Commit**

```powershell
git add src/data/pinyin-syllables.js src/curriculum.js src/teaching.js src/app-state.js src/app.js tests/pinyin-syllables.test.js tests/curriculum.test.js tests/teaching-v9.test.js tests/app-state.test.js tests/app-shell.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 完善基础拼音音节课程"
```

---

### 任务 2：修正多方键位提示分隔符

**文件：**
- 修改：`src/cells.js`。
- 测试：`tests/teaching-v5.test.js`、`tests/cells.test.js`。

- [ ] **步骤 1：写失败测试**

增加：

```js
it('多方键位提示使用星号对应确认操作', () => {
  expect(keyHintForCells([[3, 4, 5, 6], [1], [1]])).toBe('1 8 5 2*7*7')
  expect(keyHintForCells([[1], [1], [1]])).not.toContain('；')
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```text
npx vitest run tests/teaching-v5.test.js tests/cells.test.js
```

预期：当前结果为 `1 8 5 2；7；7`，新断言失败。

- [ ] **步骤 3：实现最少代码**

在 `src/cells.js` 中只把方间连接符从：

```js
.join('；')
```

改为：

```js
.join('*')
```

方内点位仍使用空格，不改变 `toCells()` 或点位映射。

- [ ] **步骤 4：运行测试验证通过**

运行：

```text
npx vitest run tests/teaching-v5.test.js tests/cells.test.js
```

预期：通过；单方 `7 4 8` 不受影响。

- [ ] **步骤 5：Commit**

```powershell
git add src/cells.js tests/teaching-v5.test.js tests/cells.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "fix: 用星号分隔多方键位提示"
```

---

### 任务 3：学习 AudioBraille 与 TTS 分离

**文件：**
- 修改：`src/app.js`。
- 测试：`tests/app-shell.test.js`，并用浏览器语音探针做行为验证。

- [ ] **步骤 1：写失败测试**

在 `tests/app-shell.test.js` 增加可测试的播放计划接口：

```js
import { buildLearningPlayback } from '../src/app.js'

it('学习 AudioBraille 播放计划不包含 TTS', () => {
  expect(buildLearningPlayback({ cells: [[1, 2]], label: 'b' })).toEqual({
    cells: [[1, 2]],
    speech: null
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```text
npx vitest run tests/app-shell.test.js
```

预期：`buildLearningPlayback` 不存在，测试失败。

- [ ] **步骤 3：实现最少代码**

在 `src/app.js` 导出：

```js
export function buildLearningPlayback(item) {
  return { cells: item?.cells || [], speech: null }
}
```

将学习项目动作从：

```js
speak(buildTeachingSpeech(item, getLang()))
void playCells(item.cells)
```

改为：

```js
const playback = buildLearningPlayback(item)
void playCells(playback.cells)
```

不删除 `buildTeachingSpeech` 或其他明确的教学 TTS 路径；只移除该 AudioBraille 按钮的隐式 TTS。

- [ ] **步骤 4：运行测试验证通过**

运行：

```text
npx vitest run tests/app-shell.test.js tests/teaching-speech.test.js
```

预期：通过，描述式教学 TTS 独立测试仍通过。

- [ ] **步骤 5：Commit**

```powershell
git add src/app.js tests/app-shell.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "fix: 分离学习 AudioBraille 与文字朗读"
```

- [ ] **步骤 6：浏览器验证**

启动最新预览并验证：

1. 进入学习盲文的音节单项页，列表中只显示基础音节，不出现 `ba1`、`ba2`。
2. 页面存在“无调、阴平、阳平、上声、去声”五个选择。
3. 选择声调后，盲文方数和 Unicode 内容更新；例如 `ba + 阴平` 显示三方。
4. 音节列表可找到 `bing`、`guang`、`jiong`、`xuan` 等复杂组合。
5. 多方键位提示显示 `*`，不显示 `；`。
6. 点击“播放 AudioBraille”时只收到 AudioBraille 音频调用，不收到 `speechSynthesis.speak` 调用。

---

## 计划自检

- v12 规格第 2.1–2.5 节：任务 1 覆盖 391 项清单、复杂韵母、声调选择、省写、零声母和进度 ID。
- v12 规格第 3 节：任务 2 覆盖同方空格、方间 `*`。
- v12 规格第 4 节：任务 3 覆盖 AudioBraille 单独播放、TTS 保留和行为验证。
- 不修改权威盲文点位表，不使用笛卡尔积生成音节，不引入语义分析，不修改 textarea 文档光标或导入导出格式。
- 所有步骤包含明确文件、测试、命令和预期结果。
- 所有实现接口、文件路径和验证方式均已明确。
