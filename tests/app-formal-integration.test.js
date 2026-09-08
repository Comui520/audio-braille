import { describe, it, expect } from 'vitest'
import { buildFormalSessionRecord, buildFormalRecognitionRecord, buildFormalReaderRecord, formalTrialCount } from '../src/app.js'

describe('正式实验应用记录接线', () => {
  it('正式 session 记录包含协议、题库、参与者分层和匿名会话字段', () => {
    const record = buildFormalSessionRecord({
      participantId: 'participant-1',
      sessionId: 'session-1',
      profile: {
        visionStatus: 'sighted',
        brailleExperience: 'none',
        audioEncodingExperience: 'none'
      },
      randomSeed: 'seed-1',
      startedAt: '2026-09-08T00:00:00.000Z'
    })
    expect(record).toMatchObject({
      dataClass: 'formal',
      consentAccepted: true,
      participantId: 'participant-1',
      sessionId: 'session-1',
      studyVersion: expect.any(String),
      protocolVersion: expect.any(String),
      clientVersion: expect.any(String),
      recognitionBankVersion: expect.any(String),
      readerBankVersion: expect.any(String),
      randomSeed: 'seed-1',
      startedAt: '2026-09-08T00:00:00.000Z',
      cohort: expect.any(String)
    })
  })


  it('正式辨识采用协议规定的每模式题量', () => {
    expect(formalTrialCount('letters')).toBe(20)
    expect(formalTrialCount('syllables')).toBe(20)
    expect(formalTrialCount('symbols')).toBe(20)
    expect(formalTrialCount('digits')).toBe(10)
  })
  it('正式辨识和听书事件都绑定 session、版本和 formal 数据类', () => {
    const recognition = buildFormalRecognitionRecord({
      sessionId: 'session-1',
      record: { trialId: 'trial-1', mode: 'letters', stimulusId: 'letters:a', correct: true }
    })
    const reader = buildFormalReaderRecord({
      sessionId: 'session-1',
      record: { passageTrialId: 'reader-1', passageId: 'reader-001', completed: true }
    })
    expect(recognition).toMatchObject({
      eventId: 'trial-1', sessionId: 'session-1', dataClass: 'formal', phase: 'formal',
      studyVersion: expect.any(String), protocolVersion: expect.any(String),
      recognitionBankVersion: expect.any(String)
    })
    expect(reader).toMatchObject({
      eventId: 'reader-1', sessionId: 'session-1', dataClass: 'formal', phase: 'formal',
      studyVersion: expect.any(String), protocolVersion: expect.any(String),
      readerBankVersion: expect.any(String)
    })
  })
})
