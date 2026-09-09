import { describe, it, expect } from 'vitest'
import { READER_BANK_VERSION, READER_PASSAGES, sampleReaderPassages, EXPERIENCE_BOOKS, EXPERIENCE_CHAPTERS, getExperienceChapters } from '../src/data/reader-passages.js'
import { buildPassageSequence, createReaderTrialRecord } from '../src/reader.js'

describe('听书材料库', () => {
  it('至少有30段稳定编号材料，长度分层', () => {
    expect(READER_PASSAGES.length).toBeGreaterThanOrEqual(30)
    expect(new Set(READER_PASSAGES.map(item => item.passageId)).size).toBe(READER_PASSAGES.length)
    expect(new Set(READER_PASSAGES.map(item => item.lengthStratum)).size).toBe(3)
    expect(READER_PASSAGES.every(item => item.passageVersion === READER_BANK_VERSION)).toBe(true)
    expect(READER_PASSAGES.every(item => Array.isArray(item.brailleCells) && item.brailleCells.length > 0)).toBe(true)
  })

  it('每段材料都能生成非空且不修改共享数据的 AudioBraille 方序列', () => {
    for (const passage of READER_PASSAGES) expect(buildPassageSequence(passage).length).toBeGreaterThan(0)
    const sequence = buildPassageSequence(READER_PASSAGES[0])
    sequence[0].push(99)
    expect(buildPassageSequence(READER_PASSAGES[0])[0]).not.toContain(99)
  })

  it('固定种子抽取3段并覆盖至少两个长度层级', () => {
    const selected = sampleReaderPassages(READER_PASSAGES, 3, 'reader-seed')
    expect(selected).toHaveLength(3)
    expect(new Set(selected.map(item => item.lengthStratum)).size).toBeGreaterThan(1)
    expect(selected.map(item => item.passageId)).toEqual(
      sampleReaderPassages(READER_PASSAGES, 3, 'reader-seed').map(item => item.passageId)
    )
  })

  it('体验章节的邻里互助材料使用阳平 lian2，而不是错误的去声 lian4', () => {
    const passage = READER_PASSAGES.find(item => item.passageId === 'reader-006')
    expect(passage?.pinyin).toContain('lian2')
    expect(passage?.pinyin).not.toContain('lian4')
  })
  it('体验听书提供多本书和较长章节，章节明文与盲文方序列一一对应', () => {
    expect(EXPERIENCE_BOOKS.length).toBeGreaterThanOrEqual(3)
    expect(EXPERIENCE_CHAPTERS.length).toBeGreaterThanOrEqual(6)
    expect(new Set(EXPERIENCE_CHAPTERS.map(item => item.chapterId)).size).toBe(EXPERIENCE_CHAPTERS.length)
    expect(EXPERIENCE_CHAPTERS.every(item => item.text.length >= 60 && item.brailleCells.length > 100)).toBe(true)
    expect(getExperienceChapters(EXPERIENCE_BOOKS[0].bookId).length).toBeGreaterThan(0)
  })

  it('听书结果记录是否听懂和概括文本', () => {
    expect(createReaderTrialRecord({ passageId: 'reader-001', selfReportedUnderstood: true, summaryText: '摘要' }))
      .toMatchObject({ passageId: 'reader-001', selfReportedUnderstood: true, summaryText: '摘要', summarySubmitted: true })
    expect(createReaderTrialRecord({ passageId: 'reader-001', completed: false }))
      .toMatchObject({ completed: false, summarySubmitted: false })
  })
})
