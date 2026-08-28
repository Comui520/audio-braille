# v13 AudioBraille 实验系统实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 建立可区分试玩与正式研究、可使用大题库和多篇听书材料、可离线积累并在用户同意后批量上传的 AudioBraille 实验系统。

**架构：** 纯前端 Vite 应用继续部署在 Vercel；实验协议、刺激题库、听书材料和质量标记在前端版本化。浏览器将 formal 会话写入 IndexedDB 队列，用户同意上传后批量发送到 `/api/experiment`；Vercel Function 使用 Supabase 免费项目保存会话、逐题和听书记录。casual 与 training 数据不进入正式上传和主要统计。

**技术栈：** JavaScript ES modules、Vitest、Vite、Web Audio API、IndexedDB、Vercel Serverless Function、Supabase Postgres REST API；PowerShell 命令。

---

## 文件清单

- 新增：`src/experiment-protocol.js`——研究版本、参与者分层、阶段、数据字段白名单和质量标记。
- 新增：`src/experiment-bank.js`——大规模辨识刺激库、固定种子随机和分层抽样。
- 新增：`src/data/reader-passages.js`——至少 30 段有稳定编号的听书材料及版本。
- 修改：`src/experiment.js`——使用版本化题库、记录 stimulusId、逐题时间、重听和阶段。
- 修改：`src/reader.js`——支持按 passageId 播放固定材料，记录播放生命周期。
- 修改：`src/app-state.js`——增加 casual/formal、培训、参与者信息、正式实验阶段和上传状态。
- 修改：`src/app.js`——实现研究同意、背景分层、统一训练、四类辨识、听书理解和上传入口。
- 修改：`src/storage.js`——新增 formal 会话和待上传批次的 IndexedDB 接口。
- 新增：`api/experiment.js`——Vercel Function，校验并批量写入 Supabase。
- 新增：`supabase/experiment-schema.sql`——Supabase 表、唯一约束和索引。
- 修改：`src/styles.css`——训练、同意、背景资料、听书理解和上传状态的布局。
- 修改：`tests/experiment-v9.test.js`、`tests/experiment-v5.test.js`——迁移现有实验断言到版本化模型。
- 新增：`tests/experiment-protocol.test.js`——协议字段、参与者分层和质量标记。
- 新增：`tests/experiment-bank.test.js`——题库规模、随机可复现和分层抽样。
- 新增：`tests/reader-passages.test.js`——听书材料数量、编号、版本和可播放性。
- 新增：`tests/experiment-storage.test.js`——formal/casual 隔离、离线队列和批量上传记录。
- 新增：`tests/experiment-api.test.js`——API payload 校验和 Supabase 请求字段白名单。
- 修改：`tests/app-shell.test.js`、`tests/app-state.test.js`——研究流程入口和状态转换。

---

### 任务 1：建立研究协议与数据模型

**文件：**
- 创建：`src/experiment-protocol.js`。
- 修改：`src/app-state.js`。
- 测试：`tests/experiment-protocol.test.js`、`tests/app-state.test.js`。

- [ ] **步骤 1：写失败测试**

新增协议测试：

```js
import { describe, it, expect } from 'vitest'
import {
  STUDY_VERSION,
  DATA_CLASSES,
  FORMAL_PHASES,
  deriveCohort,
  validateParticipantProfile,
  validateFormalRecord
} from '../src/experiment-protocol.js'

describe('实验协议', () => {
  it('定义 casual、training、formal 三种数据类别', () => {
    expect(DATA_CLASSES).toEqual(['casual', 'training', 'formal'])
    expect(FORMAL_PHASES).toEqual(['consent', 'profile', 'training', 'recognition', 'reader', 'complete'])
    expect(STUDY_VERSION).toMatch(/^v13-/)
  })

  it('根据背景字段归类参与者', () => {
    expect(deriveCohort({ visionStatus: 'blind', brailleExperience: 'experienced' }))
      .toBe('blind-braille-experienced')
    expect(deriveCohort({ visionStatus: 'sighted', brailleExperience: 'beginner' }))
      .toBe('braille-trained')
    expect(deriveCohort({ visionStatus: 'sighted', brailleExperience: 'none' }))
      .toBe('sighted-braille-naive')
  })

  it('拒绝缺少正式同意或会话字段的记录', () => {
    expect(validateFormalRecord({ dataClass: 'formal' }).valid).toBe(false)
    expect(validateFormalRecord({ dataClass: 'formal', consentAccepted: true }).valid).toBe(false)
    expect(validateFormalRecord({
      dataClass: 'formal', consentAccepted: true, studyVersion: 'v13-1', participantId: 'p1', sessionId: 's1'
    }).valid).toBe(true)
  })
})
```

在 `tests/app-state.test.js` 增加：

```js
it('默认没有进入正式实验，正式阶段从同意开始', () => {
  const state = createAppState()
  expect(state.experiment.researchMode).toBe('casual')
  expect(state.experiment.formalPhase).toBe(null)
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```text
npx vitest run tests/experiment-protocol.test.js tests/app-state.test.js
```

预期：协议模块不存在，或 `createAppState()` 没有研究状态字段。

- [ ] **步骤 3：实现最少代码**

在 `src/experiment-protocol.js` 定义：

```js
export const STUDY_VERSION = 'v13-1'
export const DATA_CLASSES = ['casual', 'training', 'formal']
export const FORMAL_PHASES = ['consent', 'profile', 'training', 'recognition', 'reader', 'complete']
export const VISION_STATUSES = ['sighted', 'low-vision', 'blind', 'undisclosed']
export const BRAILLE_EXPERIENCE = ['none', 'beginner', 'experienced', 'undisclosed']
export const AUDIO_EXPERIENCE = ['none', 'some', 'audiobraille-trained', 'undisclosed']
```

`deriveCohort()` 只根据自报字段返回三个主要组或 `unclassified`。`validateParticipantProfile()` 检查字段是否在固定枚举中。`validateFormalRecord()` 检查 `dataClass === 'formal'` 时必须存在 `consentAccepted === true`、`studyVersion`、`participantId` 和 `sessionId`，并返回 `{ valid, errors }`。

在 `createAppState()` 中增加：

```js
experiment: {
  mode: 'letters', stage: 'idle', trials: [], index: 0,
  results: [], researchMode: 'casual', formalPhase: null,
  participantId: null, sessionId: null, profile: null,
  consentAccepted: false, trainingCompleted: false,
  uploadStatus: 'idle'
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：

```text
npx vitest run tests/experiment-protocol.test.js tests/app-state.test.js
```

预期：通过，现有页面和实验模型测试没有被修改行为破坏。

- [ ] **步骤 5：Commit**

```powershell
git add src/experiment-protocol.js src/app-state.js tests/experiment-protocol.test.js tests/app-state.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 建立实验协议和参与者数据模型"
```

---

### 任务 2：建立大规模辨识刺激库与分层随机

**文件：**
- 创建：`src/experiment-bank.js`。
- 修改：`src/experiment.js`。
- 测试：`tests/experiment-bank.test.js`、`tests/experiment-v5.test.js`、`tests/experiment-v9.test.js`。

- [ ] **步骤 1：写失败测试**

```js
import { describe, it, expect } from 'vitest'
import { buildRecognitionBank, sampleRecognitionTrials } from '../src/experiment-bank.js'

describe('辨识刺激库', () => {
  it('四类刺激都有稳定 ID，拼音库远大于当前十几道样例', () => {
    const banks = buildRecognitionBank()
    expect(banks.letters.length).toBe(26)
    expect(banks.digits.length).toBe(10)
    expect(banks.syllables.length).toBeGreaterThan(1000)
    expect(banks.symbols.length).toBeGreaterThan(10)
    for (const items of Object.values(banks)) {
      expect(new Set(items.map(item => item.stimulusId)).size).toBe(items.length)
    }
  })

  it('相同种子得到相同顺序，不同种子可以得到不同顺序', () => {
    const bank = buildRecognitionBank().syllables
    const a = sampleRecognitionTrials(bank, 24, 'seed-a')
    const b = sampleRecognitionTrials(bank, 24, 'seed-a')
    const c = sampleRecognitionTrials(bank, 24, 'seed-b')
    expect(a.map(item => item.stimulusId)).toEqual(b.map(item => item.stimulusId))
    expect(a.map(item => item.stimulusId)).not.toEqual(c.map(item => item.stimulusId))
  })

  it('抽样平衡不同方数和声调层级', () => {
    const trials = sampleRecognitionTrials(buildRecognitionBank().syllables, 30, 'balanced')
    expect(new Set(trials.map(item => item.cellCount)).size).toBeGreaterThan(1)
    expect(new Set(trials.map(item => item.tone || 'none')).size).toBeGreaterThan(2)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```text
npx vitest run tests/experiment-bank.test.js tests/experiment-v5.test.js tests/experiment-v9.test.js
```

预期：`experiment-bank.js` 不存在，现有实验只使用小型 `PINYIN_POOL`。

- [ ] **步骤 3：实现最少代码**

`buildRecognitionBank()` 使用：

- `LATIN_LETTERS` 生成 26 个字母刺激；
- `DIGIT_LETTERS` 生成 10 个数字刺激；
- 当前完整符号表生成符号刺激；
- `PINYIN_SYLLABLES` 与 `[null, '1', '2', '3', '4']` 组合生成拼音刺激；
- 每个拼音刺激通过 `getTeachingItem()` 或等价的现有引擎路径生成 `cells`；
- ID 格式固定为 `letters:a`、`digits:1`、`symbols:comma`、`syllables:ba:tone-1`；
- 元数据包含 `cellCount`、`dotCount`、左右列点数和 `difficultyStratum`。

`sampleRecognitionTrials(bank, count, seed)` 使用本地 seeded PRNG，不修改全局 `Math.random`。先按 `difficultyStratum`、`cellCount` 和声调层级分桶，再轮询各桶抽取，最后使用种子打散。数量不足时只在明确记录 `replacement: true` 后允许重复；数字题默认覆盖全部 10 个。

`buildTrials(mode, n, lang, options)` 兼容旧签名，正式模式使用新题库和 `stimulusId`，casual 模式也使用同一题库但标记 `dataClass: 'casual'`。

- [ ] **步骤 4：运行测试验证通过**

运行：

```text
npx vitest run tests/experiment-bank.test.js tests/experiment-v5.test.js tests/experiment-v9.test.js
```

- [ ] **步骤 5：Commit**

```powershell
git add src/experiment-bank.js src/experiment.js tests/experiment-bank.test.js tests/experiment-v5.test.js tests/experiment-v9.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 建立分层随机 AudioBraille 刺激库"
```

---

### 任务 3：统一训练、正式辨识和逐题质量记录

**文件：**
- 修改：`src/experiment.js`、`src/app.js`、`src/app-state.js`、`src/styles.css`。
- 测试：`tests/experiment-v9.test.js`、`tests/app-shell.test.js`。

- [ ] **步骤 1：写失败测试**

在实验模型测试中增加：

```js
it('正式辨识记录训练阶段、刺激 ID、反应时间和重听次数', () => {
  const model = createExperimentModel({ trialCount: 1, dataClass: 'formal', studyVersion: 'v13-1' })
  model.start('syllables', { seed: 'test', phase: 'formal' })
  model.confirmShowcase()
  model.listen()
  const trial = model.snapshot().trials[0]
  const result = model.submit(trial.cells.map(cell => [...cell]), {
    submittedAt: 1200,
    replayCount: 2
  })
  expect(result.record).toMatchObject({
    stimulusId: trial.stimulusId,
    phase: 'formal',
    replayCount: 2,
    reactionTimeMs: expect.any(Number)
  })
})
```

在 `tests/app-shell.test.js` 增加正式入口的纯 HTML 断言：

```js
it('正式实验入口要求同意并收集最少背景字段', () => {
  const html = buildResearchEntryHtml()
  expect(html).toContain('正式实验')
  expect(html).toContain('同意')
  expect(html).toContain('盲文经验')
  expect(html).toContain('AudioBraille 经验')
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```text
npx vitest run tests/experiment-v9.test.js tests/app-shell.test.js
```

预期：实验结果没有逐题研究字段，应用没有正式研究入口构造函数。

- [ ] **步骤 3：实现最少代码**

实验模型增加：

```js
createExperimentModel({ trialCount, lang, dataClass, studyVersion, phase })
```

`submit()` 返回 `{ correct, state, record }`，记录：

```text
trialId
stimulusId
trialIndex
mode
phase
studyVersion
listenStartedAt
submittedAt
reactionTimeMs
replayCount
responseCells
expectedCellsHash
correct
```

增加统一训练阶段：

- 六点单点播放；
- 多点方播放；
- 固定练习题；
- 固定校准题；
- 校准结果写入 `trainingCompleted`、`calibrationPassed` 和 `qualityFlags`。

训练结果标记为 `dataClass: 'training'`，不进入 formal 主要结果。

`src/app.js` 导出：

```js
export function buildResearchEntryHtml() {
  return `<section class="research-entry"><h2>正式实验</h2><p>本实验收集匿名的听觉辨识和听书体验数据，用于研究 AudioBraille 的可用性。你可以随时停止。</p><label><input type="checkbox" data-field="consent"> 我同意匿名实验数据用于研究</label><select data-field="visionStatus"><option value="sighted">明眼</option><option value="low-vision">低视力</option><option value="blind">盲人</option><option value="undisclosed">不愿回答</option></select><select data-field="brailleExperience"><option value="none">没有盲文经验</option><option value="beginner">初学盲文</option><option value="experienced">熟悉盲文</option><option value="undisclosed">不愿回答</option></select><select data-field="audioEncodingExperience"><option value="none">没有 AudioBraille 经验</option><option value="some">接触过类似听觉编码</option><option value="audiobraille-trained">完成过 AudioBraille 训练</option><option value="undisclosed">不愿回答</option></select></section>`
}
```

formal 入口创建随机 `participantId`、`sessionId`，同意前不创建上传任务。研究状态从 consent 依次进入 profile、training、recognition；casual 入口不显示背景表单。

- [ ] **步骤 4：运行测试验证通过**

运行：

```text
npx vitest run tests/experiment-v9.test.js tests/app-shell.test.js tests/teaching-speech.test.js
```

- [ ] **步骤 5：Commit**

```powershell
git add src/experiment.js src/app.js src/app-state.js src/styles.css tests/experiment-v9.test.js tests/app-shell.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 增加正式实验训练和逐题记录"
```

---

### 任务 4：建立多材料听书场景与理解反馈

**文件：**
- 创建：`src/data/reader-passages.js`。
- 修改：`src/reader.js`、`src/app.js`、`src/app-state.js`、`src/styles.css`。
- 测试：`tests/reader-passages.test.js`、`tests/experiment-v9.test.js`、`tests/app-shell.test.js`。

- [ ] **步骤 1：写失败测试**

```js
import { describe, it, expect } from 'vitest'
import { READER_BANK_VERSION, READER_PASSAGES } from '../src/data/reader-passages.js'
import { buildPassageSequence, createReaderTrialRecord } from '../src/reader.js'

describe('听书材料库', () => {
  it('至少有30段稳定编号材料，长度分层', () => {
    expect(READER_PASSAGES.length).toBeGreaterThanOrEqual(30)
    expect(new Set(READER_PASSAGES.map(item => item.passageId)).size).toBe(READER_PASSAGES.length)
    expect(new Set(READER_PASSAGES.map(item => item.lengthStratum)).size).toBeGreaterThan(1)
    expect(READER_PASSAGES.every(item => item.passageVersion === READER_BANK_VERSION)).toBe(true)
  })

  it('每段材料都能生成非空 AudioBraille 方序列', () => {
    for (const passage of READER_PASSAGES) {
      expect(buildPassageSequence(passage).length).toBeGreaterThan(0)
    }
  })

  it('听书结果记录是否听懂和概括文本', () => {
    expect(createReaderTrialRecord({ passageId: 'reader-001', selfReportedUnderstood: true, summaryText: '摘要' }))
      .toMatchObject({ passageId: 'reader-001', selfReportedUnderstood: true, summaryText: '摘要' })
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```text
npx vitest run tests/reader-passages.test.js tests/experiment-v9.test.js tests/app-shell.test.js
```

预期：材料库不存在，当前只有一段 `SAMPLE_TEXT`，播放结束后没有理解反馈。

- [ ] **步骤 3：实现最少代码**

创建至少 30 段自有短文材料，每段包含：

```js
{
  passageId: 'reader-001',
  passageVersion: 'reader-v13-1',
  title: '日常出行',
  text: '一位学生在早晨整理书包，准备乘车去学校。',
  pinyin: 'yi1 wei4 xue2 sheng1 zai4 zao3 chen2 zheng3 li3 shu1 bao1 zhun3 bei4 cheng2 che1 qu4 xue2 xiao4',
  lengthStratum: 'short' | 'medium' | 'long',
  topicStratum: 'daily' | 'nature' | 'learning' | 'work',
  difficultyStratum: 'low' | 'medium' | 'high'
}
```

`pinyin` 使用现有 `syllableToDotsSeq()` 可解析的带调/不带调拼音串，材料的 AudioBraille 序列由现有权威引擎生成。`buildPassageSequence()` 返回副本，不修改共享材料。

`createReaderTrialRecord()` 创建：

```text
passageTrialId
passageId
passageVersion
passageIndex
playStartedAt
playCompletedAt
playedDurationMs
completed
pauseCount
replayCount
playbackSpeed
selfReportedUnderstood
summaryText
summarySubmitted
```

formal 听书流程从材料库按种子抽取 3 段，至少覆盖两个长度层级。播放未完成时不显示理解按钮；完成后显示“听懂了/没听懂”。点击“听懂了”后显示普通文字 textarea，允许提交空概括但记录 `summarySubmitted: false`。casual 听书仍可直接播放，但不进入 formal 上传。

- [ ] **步骤 4：运行测试验证通过**

运行：

```text
npx vitest run tests/reader-passages.test.js tests/experiment-v9.test.js tests/app-shell.test.js
```

- [ ] **步骤 5：Commit**

```powershell
git add src/data/reader-passages.js src/reader.js src/app.js src/app-state.js src/styles.css tests/reader-passages.test.js tests/experiment-v9.test.js tests/app-shell.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 增加多材料听书理解实验"
```

---

### 任务 5：本地实验记录与离线上传队列

**文件：**
- 修改：`src/storage.js`。
- 创建：`src/experiment-data.js`。
- 测试：`tests/experiment-storage.test.js`。

- [ ] **步骤 1：写失败测试**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { createStorage } from '../src/storage.js'
import { buildUploadBatch, markUploadResult } from '../src/experiment-data.js'

describe('实验本地数据队列', () => {
  let storage
  beforeEach(async () => { storage = createStorage(); await storage.init() })

  it('casual 数据不进入 formal 上传批次', async () => {
    await storage.saveExperimentSession({ sessionId: 'casual-1', dataClass: 'casual' })
    await storage.saveExperimentSession({ sessionId: 'formal-1', dataClass: 'formal', consentAccepted: true })
    const batch = await buildUploadBatch(storage)
    expect(batch.sessions.map(item => item.sessionId)).toEqual(['formal-1'])
  })

  it('保存 formal 会话、逐题记录和听书记录', async () => {
    await storage.saveExperimentSession({ sessionId: 's1', dataClass: 'formal', consentAccepted: true })
    await storage.saveExperimentTrial({ eventId: 't1', sessionId: 's1', stimulusId: 'letters:a' })
    await storage.saveReaderTrial({ eventId: 'r1', sessionId: 's1', passageId: 'reader-001' })
    const batch = await buildUploadBatch(storage)
    expect(batch.trials).toHaveLength(1)
    expect(batch.readerTrials).toHaveLength(1)
  })

  it('上传失败保留队列，成功后标记已上传', async () => {
    await storage.saveExperimentSession({ sessionId: 's1', dataClass: 'formal', consentAccepted: true })
    await markUploadResult(storage, ['s1'], { ok: false })
    expect((await buildUploadBatch(storage)).sessions).toHaveLength(1)
    await markUploadResult(storage, ['s1'], { ok: true })
    expect((await buildUploadBatch(storage)).sessions).toHaveLength(0)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```text
npx vitest run tests/experiment-storage.test.js
```

预期：实验存储接口和批量构造函数不存在。

- [ ] **步骤 3：实现最少代码**

在 IndexedDB 版本 1 的数据库中增加对象仓库：

```text
experimentSessions: keyPath sessionId
experimentTrials: keyPath eventId
readerTrials: keyPath eventId
experimentUploads: keyPath batchId
```

保持已有 `notes` 和 `progress` 仓库不变；若数据库升级到版本 2，`onupgradeneeded` 只新增缺失仓库。

`src/experiment-data.js` 提供：

```js
saveFormalSession(storage, session)
saveTrial(storage, trial)
saveReaderTrial(storage, record)
buildUploadBatch(storage)
markUploadResult(storage, sessionIds, result)
exportExperimentData(storage, format = 'json' | 'csv')
```

`buildUploadBatch()` 只选择 `dataClass === 'formal'`、`consentAccepted === true` 且未标记上传成功的记录；返回一个批次 ID 和 sessions/trials/readerTrials 数组。CSV 导出包含字段标题和转义换行，不上传原文材料。

- [ ] **步骤 4：运行测试验证通过**

运行：

```text
npx vitest run tests/experiment-storage.test.js tests/storage.test.js
```

- [ ] **步骤 5：Commit**

```powershell
git add src/storage.js src/experiment-data.js tests/experiment-storage.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 增加实验本地记录和离线队列"
```

---

### 任务 6：Vercel Function 与 Supabase 数据表

**文件：**
- 创建：`api/experiment.js`。
- 创建：`supabase/experiment-schema.sql`。
- 创建：`tests/experiment-api.test.js`。
- 修改：`vercel.json`，如需增加函数配置。

- [ ] **步骤 1：写失败测试**

将 API 处理函数设计为可注入 `fetch` 的 `handleExperimentRequest(request, deps)`，新增：

```js
it('拒绝没有同意标记的 formal payload', async () => {
  const response = await handleExperimentRequest(requestOf({ dataClass: 'formal', consentAccepted: false }), fakeDeps())
  expect(response.status).toBe(400)
})

it('只向 Supabase 发送白名单字段并支持重复 eventId', async () => {
  const deps = fakeDeps()
  const response = await handleExperimentRequest(requestOf(validBatch()), deps)
  expect(response.status).toBe(200)
  expect(deps.requests.every(request => !JSON.stringify(request.body).includes('service_role'))).toBe(true)
})

it('缺少服务端配置时返回可重试错误', async () => {
  const response = await handleExperimentRequest(requestOf(validBatch()), fakeDeps({ configured: false }))
  expect(response.status).toBe(503)
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```text
npx vitest run tests/experiment-api.test.js
```

预期：`api/experiment.js` 不存在。

- [ ] **步骤 3：实现最少代码**

`api/experiment.js`：

- 只接受 `POST`；
- 解析 `{ batchId, studyVersion, sessions, trials, readerTrials }`；
- 校验 session 同意标记、ID 格式、版本字段、数组长度和数值范围；
- 丢弃未列入白名单的字段；
- 使用 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 环境变量；
- 服务端密钥只在 Function 内使用，不能进入前端 bundle；
- 对三个表使用 Supabase REST `POST`，以 `eventId`/`sessionId` 唯一约束处理重复上传；
- 成功返回 `{ ok: true, batchId }`；
- 配置缺失返回 503，校验失败返回 400，数据库失败返回 502。

创建 `supabase/experiment-schema.sql`：

```sql
create table if not exists experiment_sessions (
  session_id text primary key,
  participant_id text not null,
  study_version text not null,
  client_version text not null,
  data_class text not null check (data_class = 'formal'),
  consent_accepted boolean not null default false,
  cohort text,
  profile jsonb not null default '{}'::jsonb,
  random_seed text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  quality_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists experiment_trials (
  event_id text primary key,
  session_id text not null references experiment_sessions(session_id),
  stimulus_id text not null,
  mode text not null,
  phase text not null,
  trial_index integer not null,
  reaction_time_ms integer,
  replay_count integer not null default 0,
  response_cells jsonb not null default '[]'::jsonb,
  expected_cells_hash text,
  correct boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists reader_trials (
  event_id text primary key,
  session_id text not null references experiment_sessions(session_id),
  passage_id text not null,
  passage_version text not null,
  passage_index integer not null,
  played_duration_ms integer,
  completed boolean not null,
  pause_count integer not null default 0,
  replay_count integer not null default 0,
  playback_speed numeric,
  self_reported_understood boolean,
  summary_text text,
  summary_submitted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists upload_receipts (
  batch_id text primary key,
  session_ids jsonb not null,
  received_at timestamptz not null default now()
);
```

表字段按 v13 规格保存原始 JSONB 和常用索引字段；不保存 IP、邮箱、姓名、原文材料或服务端密钥。SQL 中为 `session_id`、`stimulus_id`、`passage_id`、`study_version`、`data_class` 建索引。

- [ ] **步骤 4：运行测试验证通过**

运行：

```text
npx vitest run tests/experiment-api.test.js
```

- [ ] **步骤 5：Commit**

```powershell
git add api/experiment.js supabase/experiment-schema.sql tests/experiment-api.test.js vercel.json
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 增加实验数据 Vercel 接口"
```

---

### 任务 7：接入正式流程、上传和研究者导出

**文件：**
- 修改：`src/app.js`、`src/app-state.js`、`src/storage.js`、`src/experiment-data.js`、`src/styles.css`。
- 修改：`index.html`，补充同意与隐私入口文本。
- 测试：`tests/app-shell.test.js`、`tests/app-state.test.js`、`tests/experiment-storage.test.js`。

- [ ] **步骤 1：写失败测试**

新增状态转换测试：

```js
it('正式实验必须按 consent → profile → training → recognition → reader → complete 前进', () => {
  const state = createAppState()
  expect(beginFormalExperiment(state).experiment.formalPhase).toBe('consent')
  expect(acceptConsent(beginFormalExperiment(state)).experiment.formalPhase).toBe('profile')
})
```

新增壳测试：

```js
it('正式实验提供上传状态和本地导出入口', () => {
  const html = buildFormalUploadStatusHtml('pending')
  expect(html).toContain('导出实验数据')
  expect(html).toContain('等待上传')
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```text
npx vitest run tests/app-shell.test.js tests/app-state.test.js tests/experiment-storage.test.js
```

预期：正式流程状态函数和上传状态视图不存在。

- [ ] **步骤 3：实现最少代码**

应用流程：

1. 首页提供“随便体验”和“参加正式实验”两个入口；
2. casual 入口沿用现有实验，不显示同意、背景表单和上传按钮；
3. formal 入口完成同意、背景资料、统一训练和校准；
4. 四类听觉辨识模式按固定顺序完成；
5. 抽取 3 段听书材料，播放完成后显示“听懂了/没听懂”；
6. “听懂了”后显示普通文字概括 textarea；
7. 完成后生成正式会话记录并写入 IndexedDB；
8. 用户主动点击“上传正式实验数据”时批量请求 `/api/experiment`；
9. 离线或 503 时显示“已保存在本机，稍后可重试”，不丢数据；
10. 提供“导出实验数据 JSON”和“导出实验数据 CSV”，导出内容包含版本、会话、逐题和听书记录，不包含材料原文。

上传请求只发送 formal 且 consentAccepted 的批次。上传完成后保存 receipt，重复点击不会重复产生服务端记录。页面显示上传成功、等待上传和上传失败三种状态。

- [ ] **步骤 4：运行测试验证通过**

运行：

```text
npx vitest run tests/app-shell.test.js tests/app-state.test.js tests/experiment-storage.test.js
```

- [ ] **步骤 5：Commit**

```powershell
git add src/app.js src/app-state.js src/storage.js src/experiment-data.js src/styles.css index.html tests/app-shell.test.js tests/app-state.test.js tests/experiment-storage.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 接入正式实验和匿名批量上传"
```

---

### 任务 8：完整验证、文档和浏览器走查

**文件：**
- 新增：`docs/superpowers/specs/2026-08-27-audiobraille-v13-experiment-data-dictionary.md`。
- 新增：`docs/experiment-analysis.md`。
- 修改：`README.md`，如果仓库已有 README。
- 修改：`AGENTS.md`。

- [ ] **步骤 1：补研究数据字典和后期分析说明**

数据字典逐字段说明：

```text
participantId / sessionId / eventId
cohort / visionStatus / brailleExperience / audioEncodingExperience
studyVersion / clientVersion / bankVersion / randomSeed
stimulusId / passageId / phase / dataClass
correct / reactionTimeMs / replayCount / pauseCount
selfReportedUnderstood / summaryText / summarySubmitted
qualityFlags / analysisEligibility
```

分析说明固定：

- casual 不进入正式结论；
- training 不进入主要准确率；
- formal 按参与者和刺激分别汇总；
- 不把逐题行数当作独立参与者数量；
- 听书“听懂了”与概括人工评分分开；
- 题库和材料按版本分开分析。

- [ ] **步骤 2：运行完整测试和构建**

运行：

```text
npx vitest run
npm run build
```

预期：所有测试通过，Vite 构建成功。

- [ ] **步骤 3：浏览器验证 casual/formal 隔离**

启动预览：

```powershell
node node_modules/vite/bin/vite.js preview --port 4178 --strictPort --host 127.0.0.1
```

使用浏览器验证：

1. casual 入口可以直接体验，不显示同意和上传；
2. formal 入口先显示同意和背景字段；
3. 未同意时不会产生上传请求；
4. 训练阶段的记录不进入 formal 结果；
5. 正式辨识四种模式使用带版本刺激 ID；
6. 题目抽样在刷新同一会话时保持种子顺序；
7. 听书材料编号不同，至少有三段；
8. 播放未完成时没有理解按钮；
9. 播放完成后出现“听懂了/没听懂”；
10. 点击“听懂了”后出现普通文字概括输入框；
11. 完成后可以导出 JSON/CSV；
12. API 未配置时数据仍留在本地并显示可重试状态；
13. 页面不展示或上传原文材料、姓名、邮箱和 IP。

- [ ] **步骤 4：更新项目进度并 Commit**

```powershell
git add docs/superpowers/specs/2026-08-27-audiobraille-v13-experiment-data-dictionary.md docs/experiment-analysis.md README.md AGENTS.md
git -c user.name="pi" -c user.email="pi@local" commit -m "docs: 补充实验数据字典和分析说明"
```

---

## 计划自检

- v13 规格第 1–3 节：任务 1、3、7 覆盖 casual/formal 隔离、同意、参与者字段和统一训练。
- v13 规格第 5 节：任务 2、3 覆盖大刺激库、固定版本、分层随机、逐题 ID 和质量记录。
- v13 规格第 6 节：任务 4 覆盖至少 30 段材料、播放完成判断、听懂按钮和普通文字概括。
- v13 规格第 7 节：任务 5、6、7 覆盖匿名 ID、IndexedDB 队列、批量上传、Vercel Function、Supabase 和 JSON/CSV 备用导出。
- v13 规格第 8–9 节：任务 2、4、8 覆盖题库/材料版本、随机种子、分析口径和数据字典。
- v13 非目标：计划没有账号系统、身份验证、自动概括评分或统计显著性宣称。
- 现有实验的四类模式、逐方输入和 AudioBraille 播放继续复用，不修改权威盲文编码表。
- 任务顺序满足依赖：协议 → 题库 → 正式辨识 → 听书 → 本地存储 → API → 应用接入 → 完整验证。
- 计划没有未定义的占位步骤；每个任务都有文件、测试、命令和提交边界。
