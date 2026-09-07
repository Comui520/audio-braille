import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { createStorage } from '../src/storage.js'
import {
  buildUploadBatch,
  markUploadResult,
  exportExperimentData,
  saveFormalSession,
  saveTrial,
  saveReaderTrial
} from '../src/experiment-data.js'

describe('实验本地数据队列', () => {
  let storage
  beforeEach(async () => {
    storage = createStorage()
    await storage.init()
    await storage.clearAll()
  })

  it('casual 数据不进入 formal 上传批次', async () => {
    await storage.saveExperimentSession({ sessionId: 'casual-1', dataClass: 'casual' })
    await storage.saveExperimentSession({ sessionId: 'formal-1', dataClass: 'formal', consentAccepted: true })
    const batch = await buildUploadBatch(storage)
    expect(batch.sessions.map(item => item.sessionId)).toEqual(['formal-1'])
  })

  it('保存 formal 会话、逐题记录和听书记录', async () => {
    await saveFormalSession(storage, { sessionId: 's1', dataClass: 'formal', consentAccepted: true })
    await saveTrial(storage, { eventId: 't1', sessionId: 's1', stimulusId: 'letters:a' })
    await saveReaderTrial(storage, { eventId: 'r1', sessionId: 's1', passageId: 'reader-001' })
    const batch = await buildUploadBatch(storage)
    expect(batch.batchId).toMatch(/^batch-/)
    expect(batch.trials).toHaveLength(1)
    expect(batch.readerTrials).toHaveLength(1)
  })

  it('上传失败保留队列，成功后标记已上传', async () => {
    await storage.saveExperimentSession({ sessionId: 's1', dataClass: 'formal', consentAccepted: true })
    await markUploadResult(storage, ['s1'], { ok: false })
    expect((await buildUploadBatch(storage)).sessions).toHaveLength(1)
    await markUploadResult(storage, ['s1'], { ok: true })
    expect((await buildUploadBatch(storage)).sessions).toHaveLength(0)
  })

  it('导出 JSON 和 CSV 不包含材料原文', async () => {
    await storage.saveExperimentSession({ sessionId: 's1', dataClass: 'formal', consentAccepted: true })
    await storage.saveExperimentSession({ sessionId: 'casual', dataClass: 'casual', consentAccepted: false, text: '不应导出' })
    await storage.saveExperimentTrial({ eventId: 't1', sessionId: 's1', dataClass: 'formal', stimulusId: 'letters:a', responseCells: [[1]] })
    await storage.saveReaderTrial({ eventId: 'r1', sessionId: 's1', dataClass: 'formal', passageId: 'reader-001', text: '不应导出' })
    const json = await exportExperimentData(storage, 'json')
    expect(JSON.parse(json).sessions).toHaveLength(1)
    expect(json).not.toContain('不应导出')
    const csv = await exportExperimentData(storage, 'csv')
    expect(csv).toContain('recordType')
    expect(csv).toContain('reader-001')
    expect(csv).not.toContain('不应导出')
  })
})
