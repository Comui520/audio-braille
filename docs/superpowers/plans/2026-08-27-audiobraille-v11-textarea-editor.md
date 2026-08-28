# textarea 单一盲文文档视图实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让笔记和听书使用 textarea 作为唯一已确认盲文文档视图，并用 textarea 原生光标替代重复的自定义文档方块。

**架构：** 输入控制器继续维护“当前多方组合”和“已确认文档单元”两层状态。上方只渲染当前多方；下方将已确认文档转换为连续 Unicode 盲文文本写入 textarea，通过文档单元到文本偏移量的映射设置 `selectionStart/selectionEnd`。普通键盘和 Enter 直接编辑笔记 textarea 时，重新建立无语义的盲文单元列表并把光标置于末尾。

**技术栈：** JavaScript ES modules、Vitest、Vite、浏览器 textarea selection API；PowerShell 命令。

---

## 文件清单

- 修改：`src/input.js`——明确两层状态的快照字段，文档模式的 `0`、`/`、`*`、`3`、`.` 保持组合/文档边界语义。
- 修改：`src/app.js`——移除笔记/听书的 `documentDisplayHtml()`，同步 textarea 文本和原生光标，处理直接编辑与 Enter 换行。
- 修改：`src/input-display.js`——保留当前多方输入模型；删除不再使用的自定义文档显示模型或停止暴露它。
- 修改：`src/styles.css`——移除文档方块相关样式，保留当前多方点阵样式，调整 textarea 自动换行和滚动。
- 修改：`tests/input-controller.test.js`——覆盖多方确认、文档单元光标移动、删除和插入。
- 修改：`tests/input-display.test.js`——确认只渲染当前多方相关模型，不再要求文档方块。
- 新增：`tests/editor-textarea.test.js`——覆盖 Unicode 盲文/空格/换行与文档文本偏移映射纯函数。
- 修改：`tests/app-shell.test.js`——验证笔记文档视图只生成 textarea，不生成 `.document-display`。

---

### 任务 1：实现 textarea 单一文档视图

**文件：**
- 修改：`src/input.js`。
- 修改：`src/app.js`。
- 修改：`src/input-display.js`。
- 修改：`src/styles.css`。
- 测试：`tests/input-controller.test.js`、`tests/input-display.test.js`、`tests/editor-textarea.test.js`、`tests/app-shell.test.js`。

- [ ] **步骤 1：编写失败的测试**

在 `tests/editor-textarea.test.js` 新增纯函数测试，要求从 `src/app.js` 导出以下两个无 DOM 函数：

```js
it('盲文文档单元转换为连续 textarea 文本', () => {
  expect(editorAtomsToText([[[2, 3, 4, 5]], null, { kind: 'text', value: '\\n' }, [[1, 4]]]))
    .toBe('⠞ \\n⠉')
})

it('文档光标按单元边界转换为 textarea 字符偏移', () => {
  const atoms = [[[2, 3, 4, 5]], null, { kind: 'text', value: '\\n' }, [[1, 4]]]
  expect(editorCursorToOffset(atoms, 0)).toBe(0)
  expect(editorCursorToOffset(atoms, 1)).toBe(1)
  expect(editorCursorToOffset(atoms, 2)).toBe(2)
  expect(editorCursorToOffset(atoms, 3)).toBe(3)
  expect(editorCursorToOffset(atoms, 4)).toBe(4)
})

it('直接编辑的换行会保留为普通文本单元', () => {
  expect(editorTextToAtoms('⠞\\n⠉')).toEqual([
    [[2, 3, 4, 5]],
    { kind: 'text', value: '\\n' },
    [[1, 4]]
  ])
})
```

在 `tests/input-controller.test.js` 保留并调整文档模式测试，使契约明确为：

```js
it('文档模式按 0 把当前多方作为一个文档单元确认', () => {
  const input = createInputController({ mode: 'document' })
  for (const key of ['1', '4', '8', '5']) input.handleKey(key)
  input.handleKey('*')
  input.handleKey('0')
  expect(input.snapshot()).toMatchObject({
    compositionCells: [],
    currentDots: [],
    documentCells: [[[2, 3, 4, 5]]],
    documentCursor: 1
  })
})

it('文档模式的 / 和 * 在下方文档单元之间移动', () => {
  const input = createInputController({ mode: 'document' })
  for (const key of ['1', '4', '8', '5', '0', '7', '8', '0']) input.handleKey(key)
  input.handleKey('/')
  expect(input.snapshot().documentCursor).toBe(1)
  input.handleKey('3')
  expect(input.snapshot()).toMatchObject({
    documentCells: [[[1, 4]]],
    documentCursor: 0
  })
})

it('文档模式在文档光标处插入新多方而不覆盖右侧单元', () => {
  const input = createInputController({ mode: 'document' })
  for (const key of ['7', '0', '8', '0']) input.handleKey('/')
  for (const key of ['7', '0']) input.handleKey(key)
  expect(input.snapshot()).toMatchObject({
    documentCells: [[[1]], [[1]], [[4]]],
    documentCursor: 2
  })
})
```

在 `tests/app-shell.test.js` 中引入应用层纯 HTML 构造函数并增加：

```js
it('笔记文档视图只生成 textarea，不生成自定义文档方块', () => {
  const html = buildTextareaDocumentHtml('⠞⠉')
  expect(html).toContain('id="note-textarea"')
  expect(html).not.toContain('document-display')
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```text
npx vitest run tests/editor-textarea.test.js tests/input-controller.test.js tests/input-display.test.js tests/app-shell.test.js
```

预期：新导出函数不存在，或现有应用壳仍包含 `.document-display`；失败原因必须来自目标行为缺失，而不是测试语法错误。

- [ ] **步骤 3：编写最少实现代码**

在 `src/input.js` 中保留两层结构并固定快照字段：

```js
{
  compositionCells,
  compositionCursor,
  currentDots,
  documentCells,
  documentCursor
}
```

规则：

- 点位键只更新 `currentDots`。
- `*` 在当前多方非空时确认一方并向右；当前组合为空时移动 `documentCursor` 右移。
- `/` 在当前多方非空时清当前方或向左移动组合光标；当前组合为空时移动 `documentCursor` 左移。
- `0` 将当前组合整体插入 `documentCells[documentCursor]`，清空组合并让 `documentCursor` 右移。
- `3` 优先清当前方；否则删除组合内左侧方；组合为空时删除文档光标左侧一个完整文档单元。
- `.` 在组合为空时向文档中插入 `null` 空格单元。

在 `src/app.js` 导出并实现以下纯函数：

```js
export function buildTextareaDocumentHtml(text = '') {
  return `<textarea id="note-textarea" rows="10" wrap="soft" aria-label="笔记内容">${esc(text)}</textarea>`
}

export function editorTextToAtoms(text = '') {
  return [...String(text)].map(char => {
    const code = char.codePointAt(0)
    if (code >= 0x2800 && code <= 0x28ff) return [unicodeToDots(char)]
    if (char === ' ') return null
    return { kind: 'text', value: char }
  })
}

export function editorAtomsToText(atoms = []) {
  return (Array.isArray(atoms) ? atoms : []).map(atom => {
    if (Array.isArray(atom)) return cellsToUnicode(atom)
    if (atom === null) return ' '
    return atom?.kind === 'text' ? atom.value || '' : ''
  }).join('')
}

export function editorCursorToOffset(atoms = [], cursor = 0) {
  const safeAtoms = Array.isArray(atoms) ? atoms : []
  const safeCursor = Math.max(0, Math.min(Number(cursor) || 0, safeAtoms.length))
  return safeAtoms.slice(0, safeCursor)
    .reduce((offset, atom) => offset + editorAtomsToText([atom]).length, 0)
}
```

笔记和听书视图都只输出当前多方输入区和 textarea；当前组合不写入 textarea，文档文本由 `editorAtomsToText()` 生成。

应用接线要求：

1. `syncEditorValue()` 用 `snapshot.documentCells` 和 `snapshot.documentCursor` 更新 `noteText`、`currentReaderText` 与 `editorDocuments`。
2. 笔记/听书渲染只输出当前组合输入区和 textarea，不再调用 `documentDisplayHtml()`。
3. `render()` 完成 `main.innerHTML` 后，对当前笔记/听书 textarea 调用 `restoreEditorSelection()`：写入连续文本，计算 `editorCursorToOffset()`，设置 `selectionStart`/`selectionEnd`，当前页面原本聚焦时恢复焦点。
4. textarea 设置 `wrap="soft"`，CSS 使用 `white-space: pre-wrap` 的 textarea 默认行为、固定 `min-height` 和 `overflow-y: auto`；不要使用自定义方块伪造文档。
5. textarea `input` 事件调用 `loadEditorText(name, textarea.value)`，因此普通键盘输入和 Enter 保留；直接编辑后文档光标定位文本末尾。
6. `reader-text` 也使用相同的 textarea 文档视图，播放读取 textarea 当前值。
7. 全局小键盘处理不拦截 Enter，确保焦点在 textarea 时浏览器原生换行生效。
8. `input-display.js` 只保留当前组合显示模型；文档方块测试和 DOM 渲染移除。

- [ ] **步骤 4：运行测试验证通过**

运行：

```text
npx vitest run tests/editor-textarea.test.js tests/input-controller.test.js tests/input-display.test.js tests/app-shell.test.js
```

预期：全部通过；笔记/听书页面无 `.document-display`，文档单元不会出现在上方当前组合区。

- [ ] **步骤 5：运行完整回归和构建**

运行：

```text
npx vitest run
npm run build
```

预期：所有测试通过，Vite 构建成功。

- [ ] **步骤 6：浏览器验证**

使用 `http://127.0.0.1:4177/` 验证：

1. 笔记页只有一个 `#note-textarea` 文档区域，没有 `.document-display`。
2. 输入 `1485` 后按 `0`，textarea 显示 `⠞`，上方只显示空当前方，textarea 光标在末尾。
3. 输入 `78` 后按 `0`，textarea 显示 `⠞⠉`。
4. 按 `/`，textarea 原生光标位于 `⠞` 与 `⠉` 之间。
5. 按 `3`，textarea 只剩 `⠉`，原生光标位于开头。
6. 在 textarea 直接按 Enter，换行符保留；长文本在 textarea 内自动换行并垂直滚动。
7. 听书页遵循相同文档视图规则。

- [ ] **步骤 7：Commit**

```powershell
git add src/app.js src/input.js src/input-display.js src/styles.css tests/input-controller.test.js tests/input-display.test.js tests/editor-textarea.test.js tests/app-shell.test.js
git -c user.name="pi" -c user.email="pi@local" commit -m "fix: 使用 textarea 原生光标显示盲文文档"
```

---

## 计划自检

- v11 规格第 1–2 节：任务 1 步骤 3 第 2 条和步骤 6 覆盖单一 textarea、无重复文档区。
- v11 规格第 3–4 节：任务 1 步骤 3 明确两层状态和所有按键边界。
- v11 规格第 5 节：任务 1 步骤 3 第 3–7 条覆盖 Enter、换行、自动换行和直接编辑。
- v11 规格第 6–7 节：任务 1 文件边界和步骤 3 覆盖直接编辑同步、播放读取和 textarea selection API。
- v11 规格第 8 节：步骤 1、4、5、6 覆盖全部验收条目。
- 没有引入拼音语义分析、存储格式或无关页面重构。
- 规格中的导出函数、快照字段和测试命令均已固定。
