# AudioBraille v13：可积累的听觉实验与统计数据方案

日期：2026-08-27
状态：总体方案已确认，待实现

## 1. 目标与方法学边界

AudioBraille 实验需要能够长期积累数据，并区分：

1. 用户只是体验或试玩；
2. 用户正在参加可用于研究分析的正式实验。

“题库足够大”用于降低固定少数题目造成的难度偏差，但它本身不等于统计显著。系统必须同时固定实验版本、随机规则、参与者分层、训练流程、结果字段和数据质量标记。正式结论由后期根据参与者数量、效应大小和预先确定的统计方法得出。

本版本建立可复现、可积累、可导出的实验基础设施，不在产品内自动宣称研究结论成立。

## 2. 实验模式

### 2.1 随便体验模式

随便体验面向不想参加正式研究的用户：

- 可以直接播放展示和题目；
- 不要求填写背景资料；
- 不要求同意研究数据收集；
- 结果只保存在当前浏览器；
- 不上传到 Supabase；
- 不进入正式研究数据集。

体验数据可以用于本地显示即时反馈，但不得混入正式准确率、反应时间或听书理解率。

### 2.2 正式研究模式

正式研究入口必须明确标注“参加正式实验”，流程为：

```text
研究说明与同意
  ↓
背景资料
  ↓
AudioBraille 统一教学
  ↓
练习与校准，不计入正式结果
  ↓
听觉辨识四个模式
  ↓
听书场景
  ↓
结果摘要
  ↓
用户再次确认后批量上传
```

用户未同意上传时，正式实验仍可完成；数据只保存在本地，并提供 JSON/CSV 导出。用户撤回上传意愿时，待上传队列停止发送。

## 3. 参与者分层

不让用户直接选择“专家”身份，而是收集原始字段后由分析程序归类。字段允许“不愿回答”：

```text
visionStatus: sighted | low-vision | blind | undisclosed
brailleExperience: none | beginner | experienced | undisclosed
audioEncodingExperience: none | some | audiobraille-trained | undisclosed
```

主要分析分层：

1. `blind-braille-experienced`：盲人或低视力且有盲文经验；
2. `braille-trained`：学过盲文但没有 AudioBraille 经验；
3. `sighted-braille-naive`：明眼且没有盲文经验。

分层结果只是自报资料，不宣称经过身份验证。没有足够资料的参与者保留在原始数据中，但不进入需要明确分组的比较分析。

盲文经验和 AudioBraille 经验必须分开记录。一个资深盲人即使没有接触过 AudioBraille，也应进入第一组，并同时记录其训练前和训练后阶段，而不是把训练前低分解释为 AudioBraille 的最终能力。

## 4. 统一教学与质量阶段

正式测试前，所有参与者使用同一版本的 AudioBraille 教学：

1. 播放完整规则说明；
2. 播放点 1–6 的单点声音；
3. 播放若干多点方示例；
4. 完成不计分练习；
5. 完成固定校准题。

教学和练习阶段记录但不进入主要正式结果。校准题用于标记：

```text
trainingStarted
trainingCompleted
calibrationPassed
calibrationAttempts
```

校准失败不自动删除数据，而是设置 `qualityFlags`，后期由研究者决定是否纳入某种分析。

## 5. 听觉辨识正式实验

### 5.1 题库

四种模式都使用带版本的刺激题库。每个刺激至少包含：

```js
{
  stimulusId,
  bankVersion,
  mode,
  label,
  cells,
  cellCount,
  dotCount,
  leftColumnCount,
  rightColumnCount,
  difficultyStratum
}
```

题库不由完全随机的声母×韵母笛卡尔积生成。拼音使用已确认的 391 个基础音节和现有声调编码；字母、数字、符号使用各自完整有效表。

### 5.2 分层随机

正式题目在每个模式内使用固定随机种子和分层抽样：

- 字母：从 26 个字母中抽取不重复项目；
- 数字：同一轮覆盖 0–9，不把重复数字伪装成独立刺激；
- 符号：从完整符号表中抽取，不足时使用全部项目；
- 拼音：从 391 个基础音节及声调组合中抽取，并平衡无调/带调、两方/三方、点位数量和韵母类别；
- 每个模式尽量避免同一参与者在同一轮重复刺激；
- 随机种子、题库版本、刺激 ID 和抽样层级全部写入会话记录。

第一阶段默认题量：

```text
字母：20 题
数字：10 题，覆盖全部数字
符号：最多 20 题，按当前符号库实际数量取样
拼音：20 题
```

题量是每位参与者的测试负担，不是题库总量。题库总量应保持远大于单次题量，以便不同参与者覆盖不同刺激。

### 5.3 单题流程

正式单题流程：

```text
播放当前刺激
  ↓
参与者输入盲文方
  ↓
按 0 提交
  ↓
记录正确/错误、用时和输入
  ↓
进入下一题
```

允许重听，但每次重听都记录。正式页面不显示刺激标签或正确答案；训练和结果反馈页面可以显示答案。

每题记录：

```text
trialId
stimulusId
trialIndex
mode
listenStartedAt
submittedAt
reactionTimeMs
replayCount
responseCells
expectedCellsHash
correct
phase: training | formal
```

保存 `stimulusId` 而不是只保存标签，防止题库更新后无法还原具体刺激。

## 6. 听书正式场景

### 6.1 材料库

听书不使用单一 `SAMPLE_TEXT` 无限循环。材料库使用带版本的固定编号：

```js
{
  passageId,
  passageVersion,
  title,
  text,
  brailleCells,
  lengthStratum,
  topicStratum,
  difficultyStratum
}
```

第一阶段材料库至少包含 30 段不同材料，按短、中、长和不同主题分层。材料文本存放在公开仓库中，使用自有或明确可使用的文本；上传数据只保存 `passageId` 和 `passageVersion`，不上传原文。

每个参与者从材料库中按固定随机种子抽取 3 段，至少覆盖不同长度层级。材料库可以继续扩充，但已发布的 `passageVersion` 不得被静默替换。

### 6.2 播放与理解流程

正式听书流程：

```text
显示材料编号和播放按钮
  ↓
完整播放材料
  ↓
播放结束后显示“是否听懂”
  ↓
选择“听懂了”或“没听懂”
  ↓
若选择“听懂了”，显示普通文字概括输入框
  ↓
提交或跳过概括
```

播放未完成时不得显示理解按钮。允许暂停、停止和重播，但全部记录。播放速度在正式版本中固定；如果未来允许调速，速度必须进入数据字段并作为分析条件。

“听懂了”是主观理解指标，不直接等于客观理解正确。概括文本作为开放式回答，由研究者后期按照统一评分标准人工编码。- 应用不在浏览器中自动给开放式概括评分；概括评分由研究者后期统一人工编码。

每段材料记录：

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
selfReportedUnderstood
summaryText
summarySubmitted
```

选择“没听懂”时 `summaryText` 为空；选择“听懂了”但不填写概括时，`summarySubmitted` 为 `false`，不能把空概括当成正确回答。

## 7. 统计数据与隐私

### 7.1 匿名标识

浏览器端生成随机 UUID：

```text
participantId：一个浏览器参与者标识
sessionId：一次正式实验会话标识
trialId/passageTrialId：单题或单段标识
```

不收集：

- 姓名；
- 邮箱；
- IP 地址；
- 精确位置；
- 设备指纹；
- 原始音频；
- 未经必要说明的跨站追踪标识。

参与者背景和概括文本属于用户主动提交的研究数据，上传前必须明确告知用途，并提供本地删除和导出入口。

### 7.2 数据分层

服务器数据必须带有：

```text
dataClass: casual | training | formal
analysisEligibility: eligible | incomplete | calibration-failed | invalid
studyVersion
clientVersion
```

`casual` 不上传。`training` 不参与正式主要准确率。`formal` 只有在用户同意后上传。

### 7.3 主要分析指标

听觉辨识：

- 每位参与者、每种模式的准确率；
- 每个刺激的正确率，用于估计题目难度；
- 中位反应时间和错误反应时间；
- 重听次数；
- 错误类型：方数错误、方内点位错误、方序错误；
- 参与者分层和训练阶段差异。

听书：

- 播放完成率；
- 主观听懂率；
- 概括提交率；
- 概括人工评分；
- 暂停、重播和停止行为；
- 不同材料长度和难度下的差异。

同一参与者的多道题不是完全独立样本。后期分析应保留参与者 ID，用参与者层级汇总或混合效应模型处理，不能简单把所有题目行数当成独立人数。

## 8. 纯前端部署与在线收集

部署结构：

```text
GitHub
  ↓
Vercel 静态前端 + /api/experiment 无服务器函数
  ↓
Supabase 免费项目
```

浏览器端：

1. 正式实验记录先写入 IndexedDB；
2. 用户同意后，在会话完成或用户主动上传时批量发送；
3. 上传失败时保留待上传队列；
4. 使用 `sessionId + eventId` 保证重复上传幂等；
5. 提供 JSON/CSV 导出作为备用；
6. casual 数据不进入上传队列。

Vercel Function：

- 校验 JSON schema；
- 校验研究版本和题库版本；
- 校验字段白名单和值域；
- 拒绝缺少同意标记的 formal 数据；
- 限制单次 payload 大小和上传频率；
- 使用 Vercel 环境变量保存 Supabase 服务端密钥；
- 不把服务端密钥打入前端 bundle；
- 返回明确的成功、重复或可重试错误。

Supabase 表至少包括：

```text
experiment_sessions
experiment_trials
reader_trials
upload_receipts
```

表中保存原始记录和质量字段，不在数据库写入不可追溯的“最终统计结论”。统计结果由后期导出后分析生成。

第一阶段使用 Vercel 和 Supabase 免费层。免费层有配额和可能的项目休眠限制，不能承诺无限量或永久可用；在线不可用时，JSON/CSV 导出仍是完整备用路径。

## 9. 版本和可复现性

以下版本必须写入正式会话：

```text
studyVersion
clientVersion
recognitionBankVersion
readerBankVersion
randomSeed
protocolVersion
```

改变题库、训练说明、播放速度、题量、随机规则或评分规则时，必须提升相应版本号。旧数据按照原版本分析，不与新协议无标记混合。

## 10. 非目标

本版本不实现：

- 账号系统；
- 登录和个人身份认证；
- 自动判断参与者是否真的为盲人或资深盲文用户；
- 浏览器内自动给开放式概括评分；
- 自动宣称统计显著；
- 把 casual 数据用于正式结论；
- 通过前端隐藏字段来声称数据不可伪造。

## 11. 验收标准

1. casual 模式不上传数据。
2. formal 模式在同意前不上传数据。
3. 训练题不进入正式主要结果。
4. 三类参与者背景字段可记录并可区分 AudioBraille 经验。
5. 听觉辨识四种模式使用带版本题库和分层随机。
6. 每道题保存 `stimulusId`、题库版本和输入结果。
7. 听书使用至少 30 段带编号材料，而不是固定单段循环。
8. 听书播放完成后才出现“听懂了/没听懂”。
9. 选择“听懂了”后可以填写普通文字概括。
10. 概括文本上传时保留材料编号但不上传原文。
11. 浏览器离线时记录进入 IndexedDB 待上传队列。
12. 上传请求批量发送并支持幂等重试。
13. Vercel Function 不向前端暴露 Supabase 服务端密钥。
14. JSON/CSV 导出可以作为在线收集失败时的备用方式。
15. 版本变更不会静默混合不同协议数据。
16. 后期分析可以按参与者、刺激题、材料和实验阶段分别汇总。
