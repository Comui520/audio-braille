# AudioBraille v13 正式实验数据字典

- 协议版本：`v13-1`
- 协议实现：`protocol-v13-1`
- 客户端版本：`web-v13-1`
- 适用范围：正式实验（`dataClass = formal`）的本地记录、JSON/CSV 导出和 `/api/experiment` 批量上传。

## 1. 数据边界

AudioBraille 将数据分为 `casual`、`training` 和 `formal` 三类。试玩数据不进入上传批次；训练与校准记录可以保存在本机，但不进入正式主要准确率；只有用户明确同意研究用途的正式会话才允许进入上传批次。

浏览器生成匿名 `participantId` 和 `sessionId`。系统不采集姓名、邮箱、IP、精确位置、设备指纹或原始音频。参与者背景是自报字段；概括文本是用户主动提交的开放式回答，上传前应向参与者说明研究用途。

正式上传批次包括一个或多个会话、辨识逐题记录和听书逐段记录。客户端用 `batchId` 跟踪批次，服务端以 `sessionId` 和子记录 `eventId` 幂等合并重复上传。题库/材料原文不作为实验记录字段上传。

## 2. 公共字段

| 字段 | 类型/值域 | 出现位置 | 含义与分析规则 |
|---|---|---|---|
| `participantId` | string | session | 匿名浏览器参与者标识；用于参与者级汇总，不等同于身份认证。 |
| `sessionId` | string | session/trial/readerTrial | 一次正式实验会话标识；子记录必须引用已有会话。 |
| `eventId` | string | trial/readerTrial | 子记录幂等事件标识；辨识记录通常由 `trialId` 派生，听书记录由 `passageTrialId` 派生。 |
| `dataClass` | `casual \| training \| formal` | all | 数据层级。正式上传只接受 `formal`。 |
| `phase` | `training \| formal` | trial；reader 使用 formal | 区分校准/练习和正式结果；`training` 不计入主要准确率。 |
| `studyVersion` | string | session/trial | 研究协议版本；不同版本不得无标记混合。 |
| `protocolVersion` | string | session/record | 数据协议实现版本。当前为 `protocol-v13-1`。 |
| `clientVersion` | string | session/record | 产生记录的前端版本。当前为 `web-v13-1`。 |
| `analysisEligibility` | `eligible \| incomplete \| calibration-failed \| invalid` | session/record | 质量筛选建议，不是自动统计结论；研究者须根据预注册规则决定纳入范围。 |
| `qualityFlags` | string[] | session | 质量提示，例如 `calibration-failed`；不能据此删除原始记录。 |

## 3. 会话记录 `experiment_sessions`

| 字段 | 类型/值域 | 说明 |
|---|---|---|
| `sessionId` / `participantId` | string | 匿名 ID；数据库分别对应 `session_id` / `participant_id`。 |
| `consentAccepted` | boolean | 正式上传必须为 `true`；同意前不得建立上传任务。 |
| `cohort` | string | 由原始背景字段推导的分析分层：`blind-braille-experienced`、`braille-trained`、`sighted-braille-naive` 或 `unclassified`。这是自报分层。 |
| `profile` | object | 只允许三个字段：`visionStatus`、`brailleExperience`、`audioEncodingExperience`。每个字段都允许 `undisclosed`。 |
| `randomSeed` | string | 正式题目和听书材料抽样使用的可复现种子；不把随机顺序当作新的研究条件。 |
| `recognitionBankVersion` / `readerBankVersion` | string | 分别固定辨识题库和听书材料库版本。 |
| `startedAt` / `completedAt` | ISO 时间字符串或 null | 会话生命周期；完成时间为空表示尚未完成或未可靠保存。 |
| `analysisEligibility` | enum | 新会话通常为 `incomplete`；完成正式流程后可为 `eligible`；校准失败时可为 `calibration-failed`。 |
| `uploadStatus` | local-only status | IndexedDB 本地状态（如 `pending`、`uploaded`）；服务端表不依赖此字段。 |

### 背景字段

- `visionStatus`: `sighted`（明眼）、`low-vision`（低视力）、`blind`（盲人）、`undisclosed`。
- `brailleExperience`: `none`、`beginner`、`experienced`、`undisclosed`。
- `audioEncodingExperience`: `none`、`some`、`audiobraille-trained`、`undisclosed`。

AudioBraille 经验必须与盲文经验分开解释。`cohort` 由分析程序根据原始字段推导，不允许参与者直接选择“专家”标签。

## 4. 辨识逐题记录 `experiment_trials`

| 字段 | 类型/值域 | 说明 |
|---|---|---|
| `trialId` / `eventId` | string | 单题标识；`eventId` 是上传幂等键。 |
| `stimulusId` | string | 版本化题目标识；不能只依赖展示标签。 |
| `bankVersion` | string | 该题所属辨识题库版本。 |
| `mode` | `letters \| syllables \| symbols \| digits` | 辨识模式。正式流程固定顺序为字母、拼音音节、符号、数字。 |
| `trialIndex` | integer | 该模式内从 0 开始的题目序号。 |
| `listenStartedAt` / `submittedAt` | number 或 null | 客户端时间戳（毫秒）；缺失时反应时长可能为空。 |
| `reactionTimeMs` | non-negative integer 或 null | 从本题开始监听到提交的客户端毫秒数；重听次数另列，不能把重听简单解释为反应时间。 |
| `replayCount` | non-negative integer | 本题重听次数。 |
| `responseCells` | array of dot arrays | 参与者输入的盲文方序列；用于方数、点位和方序错误分析。 |
| `expectedCellsHash` | string 或 null | 正确答案方序列的哈希；不上传答案原始方序列。 |
| `correct` | boolean | 按完整方序列比较得到的本题结果。 |

正式第一阶段默认题量为：字母 20、拼音音节 20、符号按题库实际数量（当前最多 20）、数字 10 且覆盖 0–9。题量和题库版本改变时必须提升相应版本。

## 5. 听书逐段记录 `reader_trials`

| 字段 | 类型/值域 | 说明 |
|---|---|---|
| `passageTrialId` / `eventId` | string | 单段材料的幂等标识。 |
| `passageId` | string | 稳定材料编号；用于还原材料版本和分层，不上传原文。 |
| `passageVersion` | string | 材料库版本；不得静默替换已发布材料。 |
| `passageIndex` | non-negative integer | 本会话中的材料顺序，从 0 开始。正式流程固定抽取 3 段。 |
| `playStartedAt` / `playCompletedAt` | ISO 时间字符串或 null | 播放生命周期时间。 |
| `playedDurationMs` | non-negative integer 或 null | 客户端记录的播放时长。 |
| `completed` | boolean | 是否完整播放到结束；理解按钮只有播放完成后出现。 |
| `pauseCount` / `replayCount` | non-negative integer | 暂停和重播行为次数。 |
| `playbackSpeed` | number | 正式版本固定为 `1`；试玩可调速时必须作为条件保留。 |
| `selfReportedUnderstood` | boolean 或 null | 主观“听懂了/没听懂”，不等于客观理解正确。 |
| `summaryText` | string 或 null | 用户主动填写的普通文字概括；选择“没听懂”时为空。 |
| `summarySubmitted` | boolean | 是否提交了非空概括；听懂但跳过概括时为 `false`。 |

## 6. 导出与上传白名单

- JSON 导出结构为 `{ app, version, sessions, trials, readerTrials }`。
- CSV 导出将三类记录合并，并增加 `recordType`（`session`、`trial`、`readerTrial`）。对象字段序列化为 JSON 字符串。
- 导出只选取已同意正式会话及其正式子记录。
- 导出清理 `text`、`pinyin`、`title`、`plain`、`passageText`、`materialText`、`brailleCells` 等材料/原文字段；session profile 只保留三个规定的背景字段。
- `/api/experiment` 只接受正式、已同意且版本字段完整的批次，并将字段映射为 Supabase 的 snake_case 表字段。Supabase 服务端密钥只在 Vercel Function 环境变量中使用，不进入浏览器 bundle。
- 上传失败时记录仍留在 IndexedDB 待上传队列；JSON/CSV 是在线收集失败时的完整备用路径。

## 7. 使用限制

本字典描述原始采集字段，不是统计结果表。研究者在分析前应记录筛选、版本、缺失值和质量标记处理规则，并保留原始导出副本。不得把匿名 ID 解读为身份核验，也不得把应用内的即时正确/错误反馈表述为统计显著结论。


