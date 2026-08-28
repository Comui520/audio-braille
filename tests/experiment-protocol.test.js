import { describe, it, expect } from 'vitest'
import {
  STUDY_VERSION,
  DATA_CLASSES,
  FORMAL_PHASES,
  deriveCohort,
  validateParticipantProfile,
  validateFormalRecord
} from '../src/experiment-protocol.js'

describe('实验协议', () => {
  it('定义 casual、training、formal 三种数据类别', () => {
    expect(DATA_CLASSES).toEqual(['casual', 'training', 'formal'])
    expect(FORMAL_PHASES).toEqual(['consent', 'profile', 'training', 'recognition', 'reader', 'complete'])
    expect(STUDY_VERSION).toMatch(/^v13-/)
  })

  it('根据背景字段归类参与者', () => {
    expect(deriveCohort({ visionStatus: 'blind', brailleExperience: 'experienced' }))
      .toBe('blind-braille-experienced')
    expect(deriveCohort({ visionStatus: 'low-vision', brailleExperience: 'experienced' }))
      .toBe('blind-braille-experienced')
    expect(deriveCohort({ visionStatus: 'sighted', brailleExperience: 'beginner' }))
      .toBe('braille-trained')
    expect(deriveCohort({ visionStatus: 'sighted', brailleExperience: 'none' }))
      .toBe('sighted-braille-naive')
  })

  it('校验参与者背景字段枚举', () => {
    expect(validateParticipantProfile({
      visionStatus: 'blind',
      brailleExperience: 'experienced',
      audioEncodingExperience: 'none'
    }).valid).toBe(true)
    expect(validateParticipantProfile({ visionStatus: 'unknown' }).valid).toBe(false)
  })

  it('拒绝缺少正式同意或会话字段的记录', () => {
    expect(validateFormalRecord({ dataClass: 'formal' }).valid).toBe(false)
    expect(validateFormalRecord({ dataClass: 'formal', consentAccepted: true }).valid).toBe(false)
    expect(validateFormalRecord({
      dataClass: 'formal', consentAccepted: true, studyVersion: 'v13-1', participantId: 'p1', sessionId: 's1'
    }).valid).toBe(true)
    expect(validateFormalRecord({
      dataClass: 'formal', consentAccepted: true, studyVersion: {}, participantId: true, sessionId: 's1'
    }).valid).toBe(false)
  })
})
