// tests/storage.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { createStorage } from '../src/storage.js'

describe('storage 抽象层（IndexedDB）', () => {
  let storage
  beforeEach(async () => {
    storage = createStorage()
    await storage.init()
  })

  it('保存并加载笔记', async () => {
    await storage.saveNote({ id: 'n1', title: '测试', plain: '你好', dotsSeq: [[1, 2], [2, 3]] })
    const notes = await storage.loadNotes()
    expect(notes).toHaveLength(1)
    expect(notes[0].plain).toBe('你好')
  })

  it('导出为 JSON（含 app/version）并可导入恢复', async () => {
    await storage.saveNote({ id: 'n1', title: 't', plain: '你好', dotsSeq: [] })
    const json = await storage.exportNotes('json')
    const parsed = JSON.parse(json)
    expect(parsed.app).toBe('AudioBraille')
    expect(parsed.version).toBe(2)
    expect(parsed.notes).toHaveLength(1)
    // 清空后导入
    await storage.clearAll()
    expect(await storage.loadNotes()).toHaveLength(0)
    await storage.importNotes(json, 'json')
    expect(await storage.loadNotes()).toHaveLength(1)
  })

  it('JSON 导出保留多方文档单元边界', async () => {
    await storage.saveNote({
      id: 'n1',
      title: '测试',
      plain: '⠍⠔⠁\n⠞',
      dotsSeq: [[1, 3, 4], [3, 5], [1], [2, 3, 4, 5]],
      documentCells: [
        [[1, 3, 4], [3, 5], [1]],
        { kind: 'text', value: '\n' },
        [[2, 3, 4, 5]]
      ]
    })
    const json = await storage.exportNotes('json')
    await storage.clearAll()
    await storage.importNotes(json, 'json')
    const notes = await storage.loadNotes()
    expect(notes[0].documentCells).toEqual([
      [[1, 3, 4], [3, 5], [1]],
      { kind: 'text', value: '\n' },
      [[2, 3, 4, 5]]
    ])
  })
  it('.brf 导出/导入 round-trip', async () => {
    await storage.saveNote({ id: 'n1', title: 't', plain: '妈', dotsSeq: [[1, 3, 4], [3, 5], [1]] })
    const brf = await storage.exportNotes('brf')
    expect(brf).toContain('134 35 1')
    await storage.clearAll()
    await storage.importNotes(brf, 'brf')
    const notes = await storage.loadNotes()
    expect(notes).toHaveLength(1)
    expect(notes[0].dotsSeq).toEqual([[1, 3, 4], [3, 5], [1]])
    expect(notes[0].plain).toBe('妈')
  })

  it('importNotes 对非法 JSON 抛出可捕获错误', async () => {
    await expect(storage.importNotes('not json', 'json')).rejects.toThrow()
  })

  it('进度保存与加载', async () => {
    await storage.saveProgress({ level: 3, records: { a: { errors: 2 } } })
    const p = await storage.loadProgress()
    expect(p.level).toBe(3)
  })
})
