# AudioBraille

> 一个面向盲文学习者、无障碍学习者与交互研究者的中文盲文学习和 AudioBraille 空间音频实验平台。

[![GitHub](https://img.shields.io/badge/GitHub-Comui520%2Faudio--braille-181717?logo=github)](https://github.com/Comui520/audio-braille)
[![Built with Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/tests-339%20passing-2ea44f)](https://github.com/Comui520/audio-braille)

## 项目简介

AudioBraille 是一个纯前端的盲文学习与交互实验原型。它帮助用户从中文现行盲文的点位、拼音、声调、英文、数字和常用符号开始学习，并通过数字小键盘进行盲文直出输入。

项目的另一条主线是 **AudioBraille**：尝试把盲文方中的点位映射为空间音频，让用户通过左右耳、音高和波形差异来辨识盲文。这个方向目前是一个可运行的探索性原型，重点在于教学、体验和早期可用性反馈。

> AudioBraille 不宣称替代传统触觉盲文，也不是经过教育效果、临床效果或普适性验证的辅助阅读产品。它是一个开放的教学平台与交互研究原型。

## 适合谁使用？

- 想学习中文现行盲文的明眼初学者；
- 盲人、低视力用户以及希望反馈非视觉交互的体验者；
- 盲文教师、无障碍从业者和志愿者；
- 对人机交互、空间音频和替代性信息表达感兴趣的开发者或研究者。

项目的主要教学路径面向初学者，同时尽量保留屏幕阅读器、语音提示和键盘操作所需的盲人友好设计。

## 当前功能

### 学习盲文

- 中文拼音：声母、韵母、声调和完整音节练习；
- 英文 26 个字母；
- 中英文常用标点符号；
- 数字符号和数字 0–9；
- 学习、练习、考试三个阶段；
- 考试阶段可以隐藏参考信息，并通过“查看”恢复；
- 学习进度保存在本地浏览器中。

### 小键盘盲文输入

输入器直接输出 Unicode 盲文方，不设置候选字或词语候选。

默认数字小键盘映射如下：

| 键 | 功能 |
|---|---|
| `7` / `4` / `1` | 点 1 / 点 2 / 点 3 |
| `8` / `5` / `2` | 点 4 / 点 5 / 点 6 |
| `0` | 提交或确认整组输入 |
| `*` | 确认当前方、进入下一方 |
| `/` | 返回上一方或移动文档光标 |
| `3` | 退格 |
| `-` | 清空当前输入 |
| `+` | 重听当前内容 |
| `.` | 输入空格 |

同一个点位再次按下会取消该点位。

### 体验盲文听书

独立的体验入口提供：

- 多本书和多个章节；
- 明文与盲文方逐段对照；
- AudioBraille 播放、暂停、继续和停止；
- 体验模式倍速调节；
- 播放时当前盲文方逐方高亮。

体验听书不进入正式实验记录，适合第一次快速了解 AudioBraille。

### AudioBraille 实验

实验入口专注于**听觉辨识**：

1. 声道与点位展示；
2. 统一规则、单点、多点示例；
3. 不计分练习；
4. 固定校准；
5. 字母、拼音音节、符号和数字辨识。

如果进入正式实验，正式听书会作为完成训练、校准和四类辨识后的最后一节，而不是独立的实验标签。

正式实验数据默认先保存在本机，并支持导出 JSON/CSV。服务器上传接口需要单独配置 Supabase，不影响普通学习和体验功能。

### 笔记

- 使用原生文本编辑区域输入盲文；
- 支持明文对照与盲文参考；
- 支持 TTS 朗读和 AudioBraille 朗读；
- 支持保存、导入和导出本地笔记备份。

## 盲文编码说明

项目采用现行盲文的独立分方结构：

```text
声母方 + 韵母方 + 声调方
```

每一方最多包含 6 个点。Unicode 盲文使用 U+2800–U+28FF 区间表示，空方 U+2800 与有点的盲文方严格区分。

编码实现以项目规格文档为唯一数据来源，主要参考：

- GB/T 15720-2008《中国盲文》；
- 《国家通用盲文方案》（2018）；
- 现行盲文相关公开资料。

项目特别遵守以下规则：

- 去声是点 23，不是点 4；
- e 和 o 共用点 26；
- g/k/h 与 i、ü 相关韵母相拼时遵循变读规则；
- 不把声母和韵母合并成汉语双拼盲文的一方。

## 技术栈

- Vite；
- 原生 JavaScript ES Modules；
- Vitest；
- Web Audio API；
- Web Speech API；
- IndexedDB；
- Vercel Functions（正式实验数据接口）；
- Supabase REST API（可选，用于服务器端保存正式实验数据）。

## 本地运行

需要 Node.js 和 npm。

```powershell
# 克隆仓库
git clone https://github.com/Comui520/audio-braille.git
Set-Location audio-braille

# 安装依赖
npm install

# 启动开发服务器
npx vite --host 127.0.0.1
```

打开终端输出的本地地址。进入页面后，按数字键 `0` 解锁 AudioBraille 音频功能。

## 测试和构建

```powershell
# 运行全部单元测试
npm test

# 生产构建
npm run build

# 检查构建结果
npm run preview
```

当前代码库包含 49 个测试文件，共 339 个测试用例。

## 部署

项目适合部署到 Vercel：

1. 在 Vercel 中导入 `Comui520/audio-braille`；
2. 使用默认的 Vite 构建设置，或采用仓库中的 `vercel.json`；
3. 构建命令：`npm run build`；
4. 输出目录：`dist`。

普通网站功能不需要 Supabase。只有在要把正式实验数据上传到服务器时，才需要配置 Supabase。

### Supabase 配置步骤

1. 在 Supabase 创建一个项目；
2. 打开项目的 SQL Editor；
3. 执行仓库中的完整 schema：

   ```text
   supabase/experiment-schema.sql
   ```

4. 确认四张实验表已创建，并且 RLS 已启用；
5. 在 Vercel 项目的 **Settings → Environment Variables** 中添加：

   ```text
   SUPABASE_URL=你的 Supabase Project URL
   SUPABASE_SERVICE_ROLE_KEY=你的 Supabase Service Role Key
   ```

6. 重新部署 Vercel 项目；
7. 先用一条测试用正式实验记录验证上传，再开始邀请参与者。

项目的浏览器端不会直接连接 Supabase。浏览器只请求 Vercel 的 `/api/experiment`，由 Vercel 服务端使用 `service_role` 写入 Supabase。数据库默认不向 `anon` 和 `authenticated` 角色开放实验表访问。

`SUPABASE_SERVICE_ROLE_KEY` 只能放在 Vercel 的服务端环境变量中，绝对不能提交到 GitHub、前端代码或公开文档。数据库表结构和安全边界见：

```text
supabase/experiment-schema.sql
```

## 数据与隐私边界

- 学习进度、笔记和未上传的实验记录默认保存在当前浏览器；
- 体验听书不会创建正式实验记录；
- 正式实验数据在用户主动上传前可导出为 JSON/CSV；
- 项目不会因为普通体验自动把数据上传到服务器；
- 如果部署者启用 Supabase 上传，应在公开实验前补充适当的参与者说明、数据保留政策和删除机制。

## 项目状态

AudioBraille 目前处于“可运行的教学平台 + 探索性实验原型”阶段。核心流程已经完成，但 AudioBraille 听觉编码的学习成本、辨识准确度、不同用户之间的差异和实际辅助价值仍需要更多体验反馈与正式研究验证。

## 后续方向

- 邀请明眼学习者、盲人和低视力用户分别体验并反馈；
- 优化统一训练和校准流程，降低第一次使用的理解成本；
- 继续完善更多中文盲文学习内容和分级材料；
- 在明确研究协议和隐私边界后，启用 Supabase 正式实验数据收集；
- 根据真实试用结果评估 AudioBraille 是否值得进行更大规模的可用性研究。

## 贡献和反馈

欢迎通过 GitHub Issues 提交：

- 盲文编码错误；
- 键盘或屏幕阅读器操作问题；
- 学习流程中的困惑；
- AudioBraille 声音辨识体验反馈；
- 对无障碍设计和教学内容的建议。

提交反馈时，如果涉及实验数据，请不要上传真实姓名、联系方式或其他可识别个人身份的信息。

## 相关文档

- 设计规格：`docs/superpowers/specs/2026-08-27-audiobraille-design.md`；
- 实验设计：`docs/superpowers/specs/2026-08-27-audiobraille-v13-experiment-design.md`；
- 实验数据字典：`docs/superpowers/specs/2026-08-27-audiobraille-v13-experiment-data-dictionary.md`；
- 数据分析说明：`docs/experiment-analysis.md`；
- Supabase 表结构：`supabase/experiment-schema.sql`。

## 许可

当前仓库尚未声明开源许可证。若要允许他人自由复制、修改和再发布，建议后续明确选择并添加合适的 LICENSE 文件。
