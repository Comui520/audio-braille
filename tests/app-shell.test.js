import { describe, it, expect } from 'vitest'
import { buildTopNav, buildHomeActions, buildTextareaDocumentHtml, editorTextToAtoms, editorAtomsToText, editorCursorToOffset } from '../src/app.js'

describe('v9 应用壳', () => {
  it('顶层导航只有四项', () => {
    expect(buildTopNav().map(item => item.id)).toEqual(['home', 'learning', 'experiment', 'notes'])
  })

  it('笔记文档视图只生成 textarea，不生成自定义文档方块', () => {
    const html = buildTextareaDocumentHtml('⠞⠉')
    expect(html).toContain('id="note-textarea"')
    expect(html).toContain('wrap="soft"')
    expect(html).not.toContain('document-display')
  })

})
