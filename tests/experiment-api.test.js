import { describe, it, expect } from 'vitest'
import { handleExperimentRequest } from '../api/experiment.js'

function requestOf(body, method = 'POST') {
  return { method, async json() { return body } }
}

function validBatch(overrides = {}) {
  return {
    batchId: 'batch-1',
    studyVersion: 'v13-1',
    sessions: [{
      sessionId: 'session-1', participantId: 'participant-1', studyVersion: 'v13-1', clientVersion: 'web-1',
      dataClass: 'formal', consentAccepted: true, cohort: 'sighted-braille-naive',
      profile: { visionStatus: 'sighted', brailleExperience: 'none', audioEncodingExperience: 'none' },
      randomSeed: 'seed-1', protocolVersion: 'protocol-v13-1', recognitionBankVersion: 'recognition-v13-1', readerBankVersion: 'reader-v13-1', analysisEligibility: 'eligible',
      startedAt: '2026-09-07T00:00:00.000Z', qualityFlags: []
    }],
    trials: [{
      eventId: 'trial-1', sessionId: 'session-1', stimulusId: 'letters:a', mode: 'letters', bankVersion: 'recognition-v13-1', phase: 'formal',
      trialIndex: 0, reactionTimeMs: 1200, replayCount: 0, responseCells: [[1]], expectedCellsHash: 'fnv1a-12345678', correct: true
    }],
    readerTrials: [{
      eventId: 'reader-1', sessionId: 'session-1', passageId: 'reader-001', passageVersion: 'reader-v13-1',
      passageIndex: 0, playedDurationMs: 1000, completed: true, pauseCount: 0, replayCount: 0,
      playbackSpeed: 1, selfReportedUnderstood: true, summaryText: '摘要', summarySubmitted: true
    }],
    ...overrides
  }
}

function fakeDeps({ configured = true, fail = false } = {}) {
  const requests = []
  return {
    configured,
    supabaseUrl: 'https://example.supabase.co',
    serviceRoleKey: 'server-secret',
    requests,
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body), headers: options.headers })
      if (fail) return { ok: false, status: 500, async json() { return { error: 'db down' } } }
      return { ok: true, status: 201, async json() { return {} } }
    }
  }
}

describe('实验 Vercel 接口', () => {
  it('拒绝没有同意标记的 formal payload', async () => {
    const base = validBatch()
    const response = await handleExperimentRequest(requestOf({ ...base, sessions: [{ ...base.sessions[0], consentAccepted: false }] }), fakeDeps())
    expect(response.status).toBe(400)
  })

  it('拒绝版本不一致、training formal 混入和 profile 未声明字段', async () => {
    const base = validBatch()
    expect((await handleExperimentRequest(requestOf({ ...base, studyVersion: 'v13-2' }), fakeDeps())).status).toBe(400)
    expect((await handleExperimentRequest(requestOf({ ...base, trials: [{ ...base.trials[0], phase: 'training' }] }), fakeDeps())).status).toBe(400)
    expect((await handleExperimentRequest(requestOf({ ...base, sessions: [{ ...base.sessions[0], profile: { ...base.sessions[0].profile, email: 'x@example.com' } }] }), fakeDeps())).status).toBe(400)
  })

  it('只向 Supabase 发送白名单字段并支持重复 eventId', async () => {
    const deps = fakeDeps()
    const first = await handleExperimentRequest(requestOf(validBatch()), deps)
    const second = await handleExperimentRequest(requestOf(validBatch()), deps)
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(deps.requests).toHaveLength(6)
    expect(deps.requests.every(request => !JSON.stringify(request.body).includes('service_role'))).toBe(true)
    expect(deps.requests.every(request => request.headers.Authorization === 'Bearer server-secret')).toBe(true)
  })

  it('缺少服务端配置时返回可重试错误', async () => {
    const response = await handleExperimentRequest(requestOf(validBatch()), fakeDeps({ configured: false }))
    expect(response.status).toBe(503)
  })

  it('只接受 POST，数据库失败返回 502', async () => {
    expect((await handleExperimentRequest(requestOf(validBatch(), 'GET'), fakeDeps())).status).toBe(405)
    expect((await handleExperimentRequest(requestOf(validBatch()), fakeDeps({ fail: true }))).status).toBe(502)
  })
})
