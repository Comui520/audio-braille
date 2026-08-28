# AudioBraille v12：完整音节课程、键位提示与学习音频分离

日期：2026-08-27
状态：设计已确认，待实现

## 1. 目标

一次解决三个独立但都影响学习体验的问题：

1. 音节练习从当前重复的 100 项扩展为完整的基础普通话音节清单，并在单项内选择声调。
2. 多方键位提示使用实际操作键 `*` 作为方间分隔符。
3. 学习页“播放 AudioBraille”只播放 AudioBraille，不同时触发文字 TTS。

## 2. 音节课程

### 2.1 当前问题

当前 `PINYIN_SYLLABLES` 有 100 项，结构是 20 个基础音节各自列出：

```text
ba1 ba2 ba3 ba4 ba
bo1 bo2 bo3 bo4 bo
...
```

列表渲染又去掉末尾声调数字，所以用户看到重复的 `ba`、`bo`。数据只覆盖 `a/o/i/u/e` 五个简单韵母，缺少 `ing`、`uang`、`iong`、`ian`、`üan` 等重要组合。

### 2.2 新课程结构

音节练习使用 391 个无声调基础音节，每个基础音节在列表中只出现一次：

```text
ba
bo
bi
bu
...
biang
bing
guang
jiong
xuan
```

进入一个音节项目后提供声调选择：

```text
无调 | 阴平 | 阳平 | 上声 | 去声
```

选中的声调作为当前学习项目的展示、练习和考试目标，但不作为列表中的重复条目。默认选择“无调”。

每个音节的盲文方由现有 `syllableToDots(initial, final, tone)` 生成，不新增或复制点位表。声调省写继续遵循现有 `smartTone/applyToneReduction` 规则：如果某个声调省写，界面显示所选声调名称，同时显示实际生成的方数和省写提示。

### 2.3 数据来源与筛选

基础列表采用以下公开 JSON 数据源中的实际 `syllables` 数组：

```text
https://raw.githubusercontent.com/sangpham2710/pinyin-practice/main/data/pinyin_syllables.json
```

该文件实际数组长度为 391，按普通话基础有效组合组织，并包含 `ying`、`bing`、`guang`、`jiong`、`bian`、`yuan`、`juan`、`xuan` 等复杂韵母组合。课程只使用无声调基础字符串；不把声调重复展开到数组中。

资料中出现 393、410、411 等数量差异，原因是是否纳入特殊读音、边缘音节、台湾国语项目和罕见项目不同。本次以 391 个清单作为应用内固定课程数据，不用声母与韵母笛卡尔积推导。

列表数据应放入独立的 `src/data/pinyin-syllables.js`，由 `curriculum.js` 引入，避免课程文件继续保存大段混合数据。

### 2.4 零声母与现有编码

清单中可能出现 `yi`、`wu`、`yu` 等普通话书写形式。课程解析需要将其映射到现有引擎的零声母韵母规则：

```text
yi → initial=''、final='i'
wu → initial=''、final='u'
yu → initial=''、final='ü'
```

`ju/qu/xu` 等项目继续使用现有引擎的变读和 `FINALS` 数据。不得在课程层重复定义点位。

### 2.5 进度

进度仍按基础音节项目 ID 保存，例如 `pinyin.syllables.biang`。声调选择是项目内的当前学习配置，不把一个音节扩展成五个进度条目。已有旧进度中的 `ba1`、`ba2` 等 ID 应在读取或迁移时归一化为基础 ID `ba`，避免已有学习记录全部丢失。

## 3. 多方键位提示

`keyHintForCells()` 的格式改为：

- 同一方内的多个点位键用空格：`7 4 8`
- 方与方之间使用 `*`：`7 4 8*5*5`

示例：

```text
数字 1：1 8 5 2*7
拼音三方：5*5*5
```

该字符串既用于视觉提示，也用于描述式语音；不得再使用中文分号作为方间操作提示。

## 4. 学习页音频

学习项目的“播放 AudioBraille”动作只调用 AudioBraille 播放序列：

```js
void playCells(item.cells)
```

不调用：

```js
speak(buildTeachingSpeech(item, getLang()))
```

教学说明文字继续显示在页面中；需要文字 TTS 时必须使用明确的文字朗读动作，不由 AudioBraille 按钮隐式触发。播放前应取消正在进行的旧 TTS，防止之前的语音残留与 AudioBraille 重叠。

## 5. 代码边界

- `src/data/pinyin-syllables.js`
  - 新增 391 个无声调基础音节常量。
- `src/curriculum.js`
  - 移除现有 100 项重复数组。
  - 音节小节改用 391 个基础 ID。
  - 对旧带声调 ID 提供归一化兼容。
- `src/teaching.js`
  - 支持基础音节 ID 与声调选择参数。
  - 支持 `yi/wu/yu` 零声母书写形式。
  - 返回所选声调、声调名称、实际 cells 和省写状态。
- `src/app-state.js`
  - 教学位置增加当前音节声调字段，默认 `null` 表示无调。
- `src/app.js`
  - 音节单项页渲染五种声调选择和实际方数提示。
  - 点击“播放 AudioBraille”只调用音频播放，不调用 TTS。
  - 页面切换和声调切换时保留现有生命周期取消逻辑。
- `src/cells.js`
  - `keyHintForCells()` 将方间分隔符从 `；` 改为 `*`。
- `src/teaching-speech.js`
  - 保持描述式教学语音接口不变，供明确需要 TTS 的场景使用。

## 6. 测试验收

### 音节课程

1. 音节课程项目数量为 391。
2. 列表中没有 `ba1`、`ba2` 等重复声调 ID。
3. 列表包含 `ing`、`uang`、`iong`、`ian`、`üan` 的有效组合示例。
4. `getTeachingItem('pinyin', 'syllables', 'ba')` 默认返回无调 `ba` 的两方。
5. 选择阴平后返回三方或按省写规则返回实际方数，并显示 `阴平`。
6. `yi`、`wu`、`yu` 可以取得正确的零声母盲文方。
7. 旧进度 ID `ba1` 可以归一化到 `ba`。
8. 音节项目仍保留声母方、韵母方、声调方边界。

### 键位提示

9. 单方多个点位仍显示空格分隔，例如 `7 4 8`。
10. 多方显示 `*` 分隔，例如 `5*5*5`。
11. 不再输出 `；` 作为方间键位提示。

### 学习音频

12. 学习项目的 AudioBraille 播放动作不调用 TTS。
13. AudioBraille 播放仍按方顺序执行。
14. 既有描述式教学 TTS 测试继续通过。

### 完整验证

```text
npx vitest run
npm run build
```

并用浏览器验证音节列表、声调选择、键位提示和学习播放期间没有 TTS 重叠。
