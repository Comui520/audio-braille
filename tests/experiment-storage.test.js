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
    await storage.saveExperimentSession({ sessionId: 'formal-1', dataClass: 'formal', consentAccepted: true, studyVersion: 'v13-1' })
    const batch = await buildUploadBatch(storage)
    expect(batch.studyVersion).toBe('v13-1')
    expect(batch.sessions.map(item => item.sessionId)).toEqual(['formal-1'])
  })

  it('统一 trialId/passageTrialId 为 eventId，并排除 training 子记录', async () => {
    await saveFormalSession(storage, { sessionId: 's1', dataClass: 'formal', consentAccepted: true, studyVersion: 'v13-1' })
    await saveTrial(storage, { trialId: 't1', sessionId: 's1', phase: 'formal', dataClass: 'formal', stimulusId: 'letters:a' })
    await saveTrial(storage, { trialId: 'training-1', sessionId: 's1', phase: 'training', dataClass: 'training', stimulusId: 'letters:b' })
    await saveReaderTrial(storage, { passageTrialId: 'r1', sessionId: 's1', dataClass: 'formal', passageId: 'reader-001' })
    const batch = await buildUploadBatch(storage)
    expect(batch.trials).toHaveLength(1)
    expect(batch.trials[0].eventId).toBe('t1')
    expect(batch.readerTrials).toHaveLength(1)
    expect(batch.readerTrials[0].eventId).toBe('r1')
  })

  it('成功只标记批次快照，批次建立后的事件保留待上传', async () => {
    await saveFormalSession(storage, { sessionId: 's1', dataClass: 'formal', consentAccepted: true, studyVersion: 'v13-1' })
    await saveTrial(storage, { trialId: 't1', sessionId: 's1', phase: 'formal', dataClass: 'formal', stimulusId: 'letters:a' })
    const batch = await buildUploadBatch(storage)
    await saveTrial(storage, { trialId: 't2', sessionId: 's1', phase: 'formal', dataClass: 'formal', stimulusId: 'letters:b' })
    await markUploadResult(storage, batch, { ok: false })
    expect((await buildUploadBatch(storage)).trials.map(item => item.eventId)).toEqual(['t1', 't2'])
    await markUploadResult(storage, batch, { ok: true })
    expect((await buildUploadBatch(storage)).trials.map(item => item.eventId)).toEqual(['t2'])
  })

  it('导出 JSON 和 CSV 不包含材料原文', async () => {
    await storage.saveExperimentSession({ sessionId: 's1', dataClass: 'formal', consentAccepted: true, studyVersion: 'v13-1' })
    await storage.saveExperimentSession({ sessionId: 'casual', dataClass: 'casual', consentAccepted: false, text: '不应导出' })
    await storage.saveExperimentTrial({ eventId: 't1', sessionId: 's1', dataClass: 'formal', phase: 'formal', stimulusId: 'letters:a', responseCells: [[1]] })
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
