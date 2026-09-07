import { describe, it, expect } from 'vitest'
import {
  buildTopNav,
  buildHomeActions,
  buildTextareaDocumentHtml,
  buildTonePickerHtml,
  buildLearningPlayback,
  buildResearchEntryHtml
} from '../src/app.js'

describe('v12 应用壳', () => {
  it('顶层导航只有四项', () => {
    expect(buildTopNav().map(item => item.id)).toEqual(['home', 'learning', 'experiment', 'notes'])
  })

  it('首页入口只保留学习、实验和笔记', () => {
    expect(buildHomeActions().map(item => item.action)).toEqual(['learning', 'experiment', 'notes'])
  })

  it('笔记文档视图只生成 textarea，不生成自定义文档方块', () => {
    const html = buildTextareaDocumentHtml('⠞⠉')
    expect(html).toContain('id="note-textarea"')
    expect(html).toContain('wrap="soft"')
    expect(html).not.toContain('document-display')
  })

  it('正式实验入口要求同意并收集最少背景字段', () => {
    const html = buildResearchEntryHtml()
    expect(html).toContain('正式实验')
    expect(html).toContain('同意')
    expect(html).toContain('盲文经验')
    expect(html).toContain('AudioBraille 经验')
  })

  it('音节单项包含五种声调选择', () => {
    const html = buildTonePickerHtml('1')
    expect(html).toContain('data-action="teaching-tone"')
    expect(html).toContain('阴平')
    expect(html).toContain('阳平')
    expect(html).toContain('上声')
    expect(html).toContain('去声')
    expect(html).toContain('无调')
  })

  it('学习 AudioBraille 播放计划不包含 TTS', () => {
    expect(buildLearningPlayback({ cells: [[1, 2]], label: 'b' })).toEqual({
      cells: [[1, 2]],
      speech: null
    })
  })
})
