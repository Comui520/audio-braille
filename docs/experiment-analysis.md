# AudioBraille v13 后期分析说明

本文是研究者使用正式实验导出数据的分析约定，不由前端自动执行，也不在产品内宣称统计显著。分析脚本应把协议、题库和材料版本作为显式条件，并保存清洗前后的记录数。

## 1. 分析数据集边界

1. 只使用 `dataClass = formal` 且 `consentAccepted = true` 的会话及其子记录。
2. `casual` 永远不进入正式准确率、反应时间或听书理解率。
3. `training` 记录用于描述训练完成、校准通过和质量情况，不进入主要正式准确率。
4. `analysisEligibility` 是质量筛选字段。主分析可预先规定使用 `eligible`，并把 `incomplete`、`calibration-failed`、`invalid` 作为排除或敏感性分析层；不得在看到结果后临时选择规则。
5. 按 `studyVersion`、`protocolVersion`、`recognitionBankVersion` 和 `readerBankVersion` 分开检查。题库、材料、题量、播放速度或随机规则发生变化时，不应无标记合并。

## 2. 参与者分层

从 `profile` 的原始自报字段重新推导或核对 `cohort`：

- `blind-braille-experienced`：`blind` 或 `low-vision` 且盲文经验为 `experienced`；
- `braille-trained`：盲文经验为 `beginner` 或 `experienced`，但不满足上一条件；
- `sighted-braille-naive`：明眼且没有盲文经验；
- 其他组合保留为 `unclassified`。

AudioBraille 经验单独作为协变量或描述变量，不得用它替代盲文经验。`undisclosed` 不应被当成 `none`。

## 3. 听觉辨识主要指标

### 3.1 参与者/模式层级

对每位参与者、每个 `mode` 汇总：

- 正确题数 / 有效题数；
- 准确率及其不确定性区间；
- `reactionTimeMs` 的中位数和分位数；
- 错误题的反应时间；
- `replayCount` 的均值、中位数和分布；
- 完成题数、缺失题数和质量标记。

把参与者作为抽样单位。逐题行数不能当作独立参与者数量；需要推断时，应使用参与者层级汇总、按参与者聚类的区间，或预先指定的混合效应/广义混合效应模型。

### 3.2 刺激层级

按 `stimulusId` 和 `bankVersion` 汇总正确率、有效回答数和反应时间，用于估计题目难度与发现异常刺激。相同 `stimulusId` 在不同题库版本中不得直接合并。

使用 `responseCells` 与题目方数进行错误分类时，固定以下互斥优先顺序，并在脚本中测试：

1. 方数错误；
2. 方内点位错误；
3. 方序错误；
4. 完全正确。

`expectedCellsHash` 只用于记录版本化答案校验；若需要更细的点位错误分析，应在受控分析环境中依据同版本题库恢复答案，不把答案原文加入公开导出。

正式流程的模式顺序固定为字母 → 拼音音节 → 符号 → 数字，因此模式差异可能与疲劳、练习和顺序有关；不能将其直接解释为纯粹的模式难度差异。正式抽样使用 `randomSeed`，复现分析时保留该字段和刺激 ID。

## 4. 听书指标

按 `participantId`、`passageId`、`passageVersion` 和 `lengthStratum`/`topicStratum`（从材料库连接）汇总：

- 播放完成率：`completed = true` 的比例；
- 主观听懂率：在已完成材料中 `selfReportedUnderstood = true` 的比例；
- 概括提交率：听懂材料中 `summarySubmitted = true` 的比例；
- `pauseCount`、`replayCount` 和播放时长分布；
- 材料长度、主题和难度层级之间的描述性差异。

“听懂了”是主观指标，不能直接当作客观理解正确。`summaryText` 必须由研究者按照预先制定、统一的人工评分方案编码；前端不会自动评分。概括评分应与主观听懂率分开报告，记录评分者、盲法和一致性方法。

正式播放速度固定为 1x；若未来协议允许调速，必须提升版本，并把 `playbackSpeed` 作为分析条件，而不是与当前 1x 数据直接混合。

## 5. 缺失值、重试与质量

- 不完整会话和未完成材料保留在原始数据集中，主分析排除规则须事先声明。
- 校准失败不删除数据；用 `calibration-failed` 标记，并可作为质量敏感性分析层。
- 重听不是重复独立试题；保留 `replayCount`，不要复制成多行有效回答。
- 反应时间为空、负值或超出协议上限的记录应标记无效，而不是静默替换为零。
- 重复上传由 `sessionId`/`eventId` 幂等处理；分析前检查重复事件和跨会话 ID 冲突。
- 报告每一步筛选前后的会话数、参与者数、辨识题数和听书段数。

## 6. 推荐的输出表

至少输出以下互相独立的汇总：

1. `participant_summary`：每位参与者、版本、分层、模式准确率/反应时间和质量标记；
2. `stimulus_summary`：每个题目版本的有效数、正确率和难度描述；
3. `reader_summary`：每位参与者和材料版本的完成、主观听懂、概括提交及行为指标；
4. `flow_report`：同意、训练开始、校准、四类辨识、三段听书和完成阶段的流程漏斗。

所有汇总都应能回溯到 `sessionId`、`participantId`、`eventId` 或稳定的题目/材料编号。公开分享前再做小样本单元风险审查；匿名 ID 并不保证开放文本概括中绝无可识别信息。

## 7. 不应做出的结论

- 不把试玩或训练结果混入正式研究结论；
- 不把逐题记录数称为参与者数量；
- 不把自报“听懂了”称为客观理解正确；
- 不跨协议/题库/材料版本静默合并；
- 不依据单次运行自动宣称 AudioBraille 已经统计显著或普遍有效；
- 不把自报的视力或经验字段当作身份认证。
