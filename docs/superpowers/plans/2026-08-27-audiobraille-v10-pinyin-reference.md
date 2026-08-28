# 拼音对照的完整/不完整显示实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 保留完整盲文拼音转写，并让不完整但可识别的输入显示声母、韵母或“阴平/阳平/上声/去声”等结构描述。

**架构：** `src/braille-engine.js` 继续作为唯一编码与转写来源；新增的 `formatPinyinReference()` 只服务于对照显示，不保存音节分组，也不影响 `src/input.js` 的光标、插入和删除。笔记中文对照改用新格式化器，完整音节仍复用现有 `dotsSeqToPinyin()` 的逻辑。

**技术栈：** JavaScript ES modules、Vitest、Vite；PowerShell 命令；现有 `INITIALS`、`FINALS`、`TONES`、`applyVariation()`、`applyToneMark()` 和零声母规则。

---

## 文件清单

- 修改：`src/braille-engine.js`——新增正式声调名称和面向 UI 的不完整拼音对照格式化器。
- 修改：`src/notes.js`——中文笔记对照调用新格式化器；英文逐方对照、播放和存储不变。
- 修改：`tests/braille-pinyin.test.js`——覆盖完整拼音、不完整组件和未知方。
- 修改：`tests/notes-v9.test.js`——验证笔记对照入口使用新格式化结果。

---

### 任务 1：新增拼音对照格式化器

**文件：**
- 修改：`src/braille-engine.js`，放在 `dotsSeqToPinyin()` 附近。
- 测试：`tests/braille-pinyin.test.js`。

- [ ] **步骤 1：编写失败的测试**

在 `tests/braille-pinyin.test.js` 中引入 `formatPinyinReference`，增加以下测试：

```js
it('完整 ma1 继续显示带调拼音', () => {
  expect(formatPinyinReference([[1, 3, 4], [3, 5], [1]])).toBe('mā')
})

it('不完整的 m 加阴平显示结构描述', () => {
  expect(formatPinyinReference([[1, 3, 4], [1]])).toBe('m（阴平）')
})

it('单独声母显示声母本身', () => {
  expect(formatPinyinReference([[1, 3, 4]])).toBe('m')
})

it('单独声调显示正式名称', () => {
  expect(formatPinyinReference([[1]])).toBe('（阴平）')
  expect(formatPinyinReference([[2]])).toBe('（阳平）')
  expect(formatPinyinReference([[3]])).toBe('（上声）')
  expect(formatPinyinReference([[2, 3]])).toBe('（去声）')
})

it('未知方仍显示占位符', () => {
  expect(formatPinyinReference([[5]])).toBe('·')
})
```

在 `tests/notes-v9.test.js` 中引入 `buildPinyinReference`，增加：

```js
it('笔记中文对照对不完整拼音显示已识别结构', () => {
  expect(buildPinyinReference([[1, 3, 4], [1]])).toBe('m（阴平）')
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```text
npx vitest run tests/braille-pinyin.test.js tests/notes-v9.test.js
```

预期：FAIL，报错 `formatPinyinReference is not a function` 或导入符号不存在。

- [ ] **步骤 3：编写最少实现代码**

在 `src/braille-engine.js` 中增加：

```js
export const TONE_NAMES = {
  '1': '阴平',
  '2': '阳平',
  '3': '上声',
  '4': '去声'
}
```

在现有 `dotsSeqToPinyin()` 后新增 `formatPinyinReference(dotsSequence)`。实现必须遵守以下扫描顺序：

1. 当前方是声母、下一方是韵母：按现有规则输出完整的无调或带调拼音，并消费 2 或 3 方。
2. 当前方是韵母、下一方是声调：按现有零声母规则输出拼音，并消费 2 方。
3. 当前方是韵母但没有声调：按现有零声母规则输出无调拼音，并消费 1 方。
4. 当前方是声母、下一方是声调：输出 `${initial}（${TONE_NAMES[tone]}）`，消费 2 方；例如 `m + 阴平` 输出 `m（阴平）`。
5. 当前方是单独声母：输出声母值，消费 1 方。
6. 当前方是单独声调：输出 `（${TONE_NAMES[tone]}）`，消费 1 方。
7. 当前方无法解析：输出 `·`，消费 1 方。

完整声母+韵母的代码路径要复用 `applyVariation()`、`applyToneMark()` 和现有零声母常量；不要新增声母、韵母或声调点位，不要验证普通话声母韵母组合是否合法。

`src/notes.js` 中把导入改为：

```js
import { dotsToUnicode, unicodeToDots, dotsToLatin, dotsSeqToPinyin, formatPinyinReference } from './braille-engine.js'
```

并将：

```js
export function buildPinyinReference(dotsSeq) {
  if (!dotsSeq.length) return ''
  return dotsSeqToPinyin(dotsSeq)
}
```

改为：

```js
export function buildPinyinReference(dotsSeq) {
  if (!dotsSeq.length) return ''
  return formatPinyinReference(dotsSeq)
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：

```text
npx vitest run tests/braille-pinyin.test.js tests/notes-v9.test.js
```

预期：相关测试全部 PASS；原有 `dotsSeqToPinyin()` 测试仍然全部 PASS。

- [ ] **步骤 5：运行构建验证**

运行：

```text
npm run build
```

预期：Vite 构建成功，无模块导入错误。

- [ ] **步骤 6：Commit**

```powershell
git add src/braille-engine.js src/notes.js tests/braille-pinyin.test.js tests/notes-v9.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "feat: 完善不完整拼音对照显示"
```

---

## 计划自检

- 规格中的完整拼音保留要求：任务 1 步骤 3 第 1–3 条及现有测试覆盖。
- 规格中的 `m（阴平）`、单独声母、正式四声名称、未知方：任务 1 步骤 1 和步骤 3 第 4–7 条覆盖。
- 不做语义分组、合法组合表、光标修改：文件清单架构说明和步骤 3 明确禁止。
- 不改变输入、存储、播放：文件清单限定只有引擎、笔记对照和测试变更。
- 未发现 TODO、待定或未定义函数名；实现入口、导入名和测试命令已固定。
