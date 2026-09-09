import { describe, it, expect } from 'vitest'
import {
  buildTopNav,
  buildHomeActions,
  buildTextareaDocumentHtml,
  buildTonePickerHtml,
  buildLearningPlayback,
  buildResearchEntryHtml,
  buildFormalConsentHtml,
  buildFormalProfileHtml,
  buildFormalCompleteHtml,
  buildReaderSpeedHtml,
  buildFormalUploadStatusHtml,
  buildExamReferenceMaskHtml,
  buildFormalTrainingHtml,
  buildExperienceReaderHtml,
  readerScopeForState,
  shouldHandleGateKey
} from '../src/app.js'

describe('v12 应用壳', () => {
  it('体验听书和正式听书使用独立运行时作用域', () => {
    expect(readerScopeForState({ page: 'reader', experiment: { researchMode: 'casual', formalPhase: null } })).toBe('experience')
    expect(readerScopeForState({ page: 'experiment', experiment: { researchMode: 'formal', formalPhase: 'reader' } })).toBe('formal')
    expect(readerScopeForState({ page: 'experiment', experiment: { researchMode: 'formal', formalPhase: 'training' } })).toBe('none')
  })

  it('启动门不拦截刷新和辅助技术组合键，只处理裸 0', () => {
    expect(shouldHandleGateKey({ key: '0' })).toBe(true)
    expect(shouldHandleGateKey({ key: 'r', ctrlKey: true })).toBe(false)
    expect(shouldHandleGateKey({ key: '0', ctrlKey: true })).toBe(false)
    expect(shouldHandleGateKey({ key: 'a', altKey: true })).toBe(false)
  })
  it('顶层导航包含独立体验听书入口', () => {
    expect(buildTopNav().map(item => item.id)).toEqual(['home', 'learning', 'experiment', 'reader', 'notes'])
  })

  it('首页入口包含独立体验听书', () => {
    expect(buildHomeActions().map(item => item.action)).toEqual(['learning', 'experiment', 'reader', 'notes'])
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
    expect(html).toContain('data-action="research-submit"')
  })


  it('体验听书提供书籍章节选择、明文盲文对照和播放控制', () => {
    const html = buildExperienceReaderHtml({
      books: [{ bookId: 'b1', title: '一本书', chapters: [{ chapterId: 'c1', title: '第一章' }] }],
      chapters: [{ chapterId: 'c1', bookId: 'b1', title: '第一章', text: '明文', brailleCells: [[1], [1, 2]] }],
      selectedBookId: 'b1',
      selectedChapterId: 'c1', activeCellIndex: 1
    })
    expect(html).toContain('体验听书')
    expect(html).toContain('experience-book')
    expect(html).toContain('experience-chapter')
    expect(html).toContain('明文')
    expect(html).toContain('盲文')
    expect(html).toContain('reader-play')
    expect(html).toContain('data-cell-index="0"')
    expect(html).toContain('braille-playback-cell is-playing')
  })
  it('正式听书固定 1 倍速，试玩听书保留倍速控制', () => {
    expect(buildReaderSpeedHtml({ formal: true, speed: 3 })).toContain('正式实验固定 1x')
    expect(buildReaderSpeedHtml({ formal: true, speed: 3 })).not.toContain('type="range"')
    expect(buildReaderSpeedHtml({ formal: false, speed: 2 })).toContain('type="range"')
  })
  it('正式实验提供上传状态和本地导出入口', () => {
    const html = buildFormalUploadStatusHtml('pending')
    expect(html).toContain('导出实验数据')
    expect(html).toContain('等待上传')
  })


  it('正式流程页面按阶段提供同意、背景和完成操作', () => {
    expect(buildFormalConsentHtml()).toContain('data-field="consent"')
    expect(buildFormalConsentHtml()).toContain('data-action="research-submit"')
    expect(buildFormalProfileHtml()).toContain('data-action="research-profile-submit"')
    expect(buildFormalCompleteHtml('pending')).toContain('data-action="experiment-upload"')
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

  it('正式训练页面提供不可跳过的五步操作而非手工通过按钮', () => {
    const base = {
      stage: 'training', trainingStep: 'rules', trainingQuestionIndex: 0,
      trainingQuestionStarted: false, trainingPracticeTrials: [], trainingCalibrationTrials: []
    }
    expect(buildFormalTrainingHtml(base)).toContain('data-action="training-play-rules"')
    expect(buildFormalTrainingHtml({ ...base, trainingStep: 'single-points' })).toContain('data-action="training-play-single"')
    expect(buildFormalTrainingHtml({ ...base, trainingStep: 'multi-examples' })).toContain('data-action="training-play-multi"')
    expect(buildFormalTrainingHtml({ ...base, trainingStep: 'practice', trainingPracticeTrials: [{ id: 'p1' }] })).toContain('data-action="training-listen-question"')
    expect(buildFormalTrainingHtml({ ...base, trainingStep: 'calibration', trainingCalibrationTrials: [{ id: 'c1' }] })).toContain('固定校准题')
    expect(buildFormalTrainingHtml({ ...base, trainingStep: 'single-points' })).toContain('composition-display')
    expect(buildFormalTrainingHtml({ ...base, trainingStep: 'multi-examples' })).toContain('composition-display')
    expect(buildFormalTrainingHtml({ ...base, trainingStep: 'practice', trainingPracticeTrials: [{ id: 'p1' }] })).toContain('composition-display')
    expect(buildFormalTrainingHtml({ ...base, trainingStep: 'calibration', trainingCalibrationTrials: [{ id: 'c1' }] })).toContain('composition-display')
    expect(buildFormalTrainingHtml(base)).not.toContain('research-calibration-pass')
    expect(buildFormalTrainingHtml(base)).not.toContain('校准通过</button>')
  })
  it('考试答案遮罩提供可访问的查看按钮', () => {
    const html = buildExamReferenceMaskHtml()
    expect(html).toContain('lesson-reference-mask')
    expect(html).toContain('data-action="teaching-show-reference"')
    expect(html).toContain('查看')
  })
  it('学习 AudioBraille 播放计划不包含 TTS', () => {
    expect(buildLearningPlayback({ cells: [[1, 2]], label: 'b' })).toEqual({
      cells: [[1, 2]],
      speech: null
    })
  })
})
