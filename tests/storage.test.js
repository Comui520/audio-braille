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

  it('导出为 JSON 并可导入恢复', async () => {
    await storage.saveNote({ id: 'n1', title: 't', plain: '你好', dotsSeq: [] })
    const json = await storage.exportNotes('json')
    const parsed = JSON.parse(json)
    expect(parsed.notes).toHaveLength(1)
    // 清空后导入
    await storage.clearAll()
    expect(await storage.loadNotes()).toHaveLength(0)
    await storage.importNotes(json, 'json')
    expect(await storage.loadNotes()).toHaveLength(1)
  })

  it('进度保存与加载', async () => {
    await storage.saveProgress({ level: 3, records: { a: { errors: 2 } } })
    const p = await storage.loadProgress()
    expect(p.level).toBe(3)
  })
})
