# AGENTS.md — AudioBraille 项目协作规则（必须遵守）

> 本文件是项目**唯一的权威协作规则**。任何会话（包括上下文压缩后的新会话）开始工作时，必须先读本文件，再读规格与计划。规则冲突时以本文件为准。

---

## 0. 项目一句话

盲人友好的现行盲文教学 SPA（AudioBraille 空间音频 + 小键盘盲文输入 + 教学 + 笔记 + 实验），纯前端，Vite + Vitest，部署 Vercel。

## 1. 文档地图（先读这些）

| 文档 | 路径 | 作用 |
|---|---|---|
| 协作规则 | `AGENTS.md`（本文件） | 必须遵守的规则 |
| 设计规格 | `docs/superpowers/specs/2026-08-27-audiobraille-design.md` | 设计决策 + **盲文编码规范（第 2 节）** |
| 实现计划 | `docs/superpowers/plans/2026-08-27-audiobraille.md` | 11 个任务的 TDD 步骤，含全部代码 |

**顺序**：新会话/新代理 → 先读 AGENTS.md → 再读规格第 1-2 节 → 再读计划 → 才动手。

## 2. 本机环境铁律

- **shell 只能用 PowerShell**（ctx_execute language: "shell" 运行的就是 PowerShell）。**没有 bash**（bash 工具报 "No bash shell found" 属正常，不要尝试安装）。
- 路径用 Windows 风格：`D:\AudioBraille\...`；PowerShell 命令里可用 `Set-Location 'D:\AudioBraille'`。
- git 可用（`D:\git\Git\cmd\git.exe`）；commit 需带身份参数：`git -c user.name="pi" -c user.email="pi@local" commit ...`。
- 本项目已在 git 仓库内（`D:\AudioBraille\.git`），勿重复 `git init`。

## 3. 执行模式（用户已确认，勿改）

- **内联执行**：11 个任务全部由主会话（我）逐任务 TDD 执行，不用子代理执行代码。
- **完成点审查**：每完成 2~3 个任务设一个检查点，派**一个只读审查子代理**（reviewer 类）检查。
- **审查配方**：子代理用 **fresh** 上下文（不 fork 主会话），任务描述必须自包含：文件清单 + 检查清单 + 与规格第 2 节编码表逐项比对。子代理不执行命令、不写文件，只读。
- 子代理与主会话隔离，看不到对话历史——任务描述要包含全部必要上下文。

## 4. TDD 与 git 纪律

- 每个任务：写失败测试 → 运行确认失败 → 实现最少代码 → 运行确认通过 → **commit**。
- commit 频繁、粒度小、message 带 `feat:/fix:/docs:/chore:` 前缀。
- **测试失败时，以规格第 2 节为准修正引擎代码，不得改测试来迁就实现。**
- 每个任务以可独立测试的交付物结束。

## 5. 盲文编码铁律（数据源唯一）

- 编码表（声母 18 / 韵母 34 / 声调）**唯一权威来源**：规格第 2 节（源自 GB/T 15720-2008 与维基百科现行盲文条目）。**不得凭记忆臆造点位**。
- 已知易错点：
  - **去声 = 点 23，不是点 4**。
  - **U+2800 是空方**；有点的方 = `U+2800 + 位掩码`（点1=0x01…点6=0x20）。
  - 现行盲文 = 声母方 + 韵母方 + 声调方（**最多三方，各方独立**）；"声韵合拼一方"是汉语双拼盲文，本项目不用。
  - g/k/h 与 i、ü 及 i/ü 开头韵母相拼 → 变读 j/q/x；INITIALS 中 j/q/x 与 g/k/h 同点位。
  - e 与 o 共用点位 `26`。
- 若需新增盲文数据（如更多汉字、.brf 规则），先查证再写入，并在规格第 2.8 节补资料来源。

## 6. 架构约束（勿破坏）

- 模块接口：`BrailleEngine`（braille-engine.js）、`playAudioBraille`（audio-braille.js）、`storage`（storage.js）、`AppState`、`speak`。
- **speak 在独立模块 `src/speech.js`**——input/notes/teaching 从 speech.js 导入，**严禁**从 app.js 导入 speak（循环依赖）。
- **输入器是盲文直出**：上屏 Unicode 盲文方，无候选字选词。9/6 键不用于候选切换。对照字表仅用于教学反馈/转写。
- **storage.js 是唯一存储入口**：业务代码不得直接触碰 IndexedDB/localStorage/文件 API；为将来 Tauri 套壳预留边界。
- 教学分级：初级 = 声母方+韵母方（无调）；进阶 = +声调方（全标调，国家通用盲文思路）。
- **不要拦截 Ctrl+R**（浏览器刷新）；全局快捷键需与 NVDA/JAWS 避让。
- 输入时所有小键盘键位 `preventDefault()`，避免 textarea 误输数字。

## 7. Token 节省惯例

- 大输出（测试/构建/日志）用 `ctx_execute` 过滤：只回显 FAIL/错误行，不把几百行读进对话。
- 分析文件用 `ctx_execute_file`（沙箱内处理，不读全文进上下文）。
- 计划里已有全部实现代码，内联执行时**照抄并适配**，避免重复设计推理。
- 多命令研究用 `ctx_batch_execute`；网页内容用 `ctx_fetch_and_index` 后 `ctx_search`。
- 审查子代理的任务描述用固定"配方"模板，避免让子代理探索。

## 8. 已知陷阱清单（出现即查）

- Ctrl+R 拦截浏览器刷新 → 进度改为 load 时自动恢复。
- "候选字"概念曾混淆 → 已定盲文直出；如需候选字需求回归，先与用户确认。
- 四声点位错误、U+2800 空方误解、单声道 AudioBraille 无法区分左右列（已用波形区分：左正弦/右方波）。
- 实验模式题目对盲人须**音频口播**（不能说"随机显示"）；B 组前须确认用户已掌握编码。
- 笔记跨设备不共享（浏览器沙箱）→ 导出 .brf/JSON 备份。

## 9. 当前进度（每次会话结束更新本节）

- [x] 规格 v2 已批准并 commit（`docs/superpowers/specs/2026-08-27-audiobraille-design.md`）
- [x] 实现计划 11 任务已批准并 commit（`docs/superpowers/plans/2026-08-27-audiobraille.md`）
- [x] 任务 1：项目骨架
- [x] 任务 2：盲文核心引擎
- [x] 任务 3：对照字表与转写
- [x] 任务 4：AudioBraille 空间音频
- [x] 任务 5：存储抽象层
- [x] 任务 6：数字小键盘输入器
- [x] 任务 7：教学模块
- [x] 任务 8：笔记记录器
- [x] 任务 9：实验模式
- [x] 任务 10：整合与收尾
- [ ] 任务 11：部署验证（Vercel）

**进度更新规则**：每完成一个任务，勾选本节对应项并 commit。

