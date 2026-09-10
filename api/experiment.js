const ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/
const DATA_LIMIT = 10000

const SESSION_FIELDS = [
  'sessionId', 'participantId', 'studyVersion', 'clientVersion', 'dataClass', 'consentAccepted',
  'cohort', 'profile', 'randomSeed', 'startedAt', 'completedAt', 'qualityFlags'
]

function response(status, body) {
  return {
    status,
    body,
    headers: { 'content-type': 'application/json' },
    async json() { return body }
  }
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function validId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

function integerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max
}

function arrayWithin(value, max = DATA_LIMIT) {
  return Array.isArray(value) && value.length <= max
}

function validateProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false
  const allowed = ['visionStatus', 'brailleExperience', 'audioEncodingExperience']
  if (Object.keys(profile).some(key => !allowed.includes(key))) return false
  const enums = {
    visionStatus: ['sighted', 'low-vision', 'blind', 'undisclosed'],
    brailleExperience: ['none', 'beginner', 'experienced', 'undisclosed'],
    audioEncodingExperience: ['none', 'some', 'audiobraille-trained', 'undisclosed']
  }
  return allowed.every(key => enums[key].includes(profile[key]))
}

function mapProfile(profile = {}) {
  return {
    visionStatus: profile.visionStatus,
    brailleExperience: profile.brailleExperience,
    audioEncodingExperience: profile.audioEncodingExperience
  }
}

function uniqueIds(items, field) {
  const ids = items.map(item => item?.[field])
  return ids.every(id => validId(id)) && new Set(ids).size === ids.length
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'payload'
  if (!validId(payload.batchId) || !nonEmpty(payload.studyVersion)) return 'batch'
  if (!Array.isArray(payload.sessions) || !Array.isArray(payload.trials) || !Array.isArray(payload.readerTrials)) return 'arrays'
  if (!arrayWithin(payload.sessions) || !arrayWithin(payload.trials) || !arrayWithin(payload.readerTrials)) return 'arrays'
  if (payload.sessions.length === 0) return 'sessions'
  if (!uniqueIds(payload.sessions, 'sessionId') || !uniqueIds(payload.trials, 'eventId') || !uniqueIds(payload.readerTrials, 'eventId')) return 'duplicate-id'
  const versions = new Set(payload.sessions.map(session => session.studyVersion))
  if (versions.size !== 1 || [...versions][0] !== payload.studyVersion) return 'version'
  const sessions = payload.sessions
  const sessionIds = new Set()
  for (const session of sessions) {
    if (!session || !validId(session.sessionId) || !validId(session.participantId)) return 'session-id'
    if (!nonEmpty(session.studyVersion) || !nonEmpty(session.clientVersion) || !nonEmpty(session.randomSeed) || !nonEmpty(session.protocolVersion) || !nonEmpty(session.recognitionBankVersion) || !nonEmpty(session.readerBankVersion)) return 'session-version'
    if (session.dataClass !== 'formal' || session.consentAccepted !== true) return 'consent'
    if (!validateProfile(session.profile)) return 'profile'
    if (!nonEmpty(session.startedAt)) return 'startedAt'
    if (!Array.isArray(session.qualityFlags)) return 'qualityFlags'
    if (!['eligible', 'incomplete', 'calibration-failed', 'invalid'].includes(session.analysisEligibility)) return 'analysis-eligibility'
    if (session.sessionId && sessionIds.has(session.sessionId)) return 'duplicate-session'
    sessionIds.add(session.sessionId)
  }
  for (const trial of payload.trials) {
    if (!trial || !validId(trial.eventId) || !sessionIds.has(trial.sessionId) || !validId(trial.stimulusId)) return 'trial-id'
    if (!nonEmpty(trial.bankVersion) || !nonEmpty(trial.mode) || trial.phase !== 'formal') return 'trial-phase'
    if (!integerInRange(trial.trialIndex, 0, DATA_LIMIT)) return 'trial-index'
    if (trial.reactionTimeMs != null && !integerInRange(trial.reactionTimeMs, 0, 86400000)) return 'reaction-time'
    if (!integerInRange(trial.replayCount, 0, 1000)) return 'replay-count'
    if (!Array.isArray(trial.responseCells)) return 'response-cells'
    if (typeof trial.correct !== 'boolean') return 'correct'
  }
  for (const trial of payload.readerTrials) {
    if (!trial || !validId(trial.eventId) || !sessionIds.has(trial.sessionId) || !validId(trial.passageId)) return 'reader-id'
    if (!nonEmpty(trial.passageVersion) || !integerInRange(trial.passageIndex, 0, DATA_LIMIT)) return 'reader-passage'
    if (trial.playedDurationMs != null && !integerInRange(trial.playedDurationMs, 0, 86400000)) return 'reader-duration'
    if (typeof trial.completed !== 'boolean') return 'reader-completed'
    if (!integerInRange(trial.pauseCount, 0, 1000) || !integerInRange(trial.replayCount, 0, 1000)) return 'reader-count'
    if (trial.playbackSpeed != null && (typeof trial.playbackSpeed !== 'number' || trial.playbackSpeed < 0.5 || trial.playbackSpeed > 5)) return 'reader-speed'
    if (trial.selfReportedUnderstood != null && typeof trial.selfReportedUnderstood !== 'boolean') return 'reader-understood'
    if (trial.summaryText != null && (typeof trial.summaryText !== 'string' || trial.summaryText.length > 5000)) return 'reader-summary'
  }
  return null
}

function mapSession(session) {
  return {
    session_id: session.sessionId,
    participant_id: session.participantId,
    study_version: session.studyVersion,
    client_version: session.clientVersion,
    data_class: session.dataClass,
    consent_accepted: session.consentAccepted,
    cohort: session.cohort || null,
    profile: mapProfile(session.profile),
    protocol_version: session.protocolVersion,
    recognition_bank_version: session.recognitionBankVersion,
    reader_bank_version: session.readerBankVersion,
    analysis_eligibility: session.analysisEligibility,
    random_seed: session.randomSeed,
    started_at: session.startedAt,
    completed_at: session.completedAt || null,
    quality_flags: session.qualityFlags || []
  }
}

function mapTrial(trial) {
  return {
    event_id: trial.eventId,
    session_id: trial.sessionId,
    stimulus_id: trial.stimulusId,
    mode: trial.mode,
    bank_version: trial.bankVersion,
    phase: trial.phase,
    trial_index: trial.trialIndex,
    reaction_time_ms: trial.reactionTimeMs ?? null,
    replay_count: trial.replayCount,
    response_cells: trial.responseCells,
    expected_cells_hash: trial.expectedCellsHash || null,
    correct: trial.correct
  }
}

function mapReaderTrial(trial) {
  return {
    event_id: trial.eventId,
    session_id: trial.sessionId,
    passage_id: trial.passageId,
    passage_version: trial.passageVersion,
    passage_index: trial.passageIndex,
    played_duration_ms: trial.playedDurationMs ?? null,
    completed: trial.completed,
    pause_count: trial.pauseCount,
    replay_count: trial.replayCount,
    playback_speed: trial.playbackSpeed ?? null,
    self_reported_understood: trial.selfReportedUnderstood ?? null,
    summary_text: trial.summaryText || null,
    summary_submitted: trial.summarySubmitted === true
  }
}

function getDependencies(deps = {}) {
  const supabaseUrl = deps.supabaseUrl || globalThis.process?.env?.SUPABASE_URL || ''
  const serviceRoleKey =
    deps.serviceRoleKey ||
    globalThis.process?.env?.SUPABASE_SECRET_KEY ||
    globalThis.process?.env?.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  return {
    configured: deps.configured ?? Boolean(supabaseUrl && serviceRoleKey),
    supabaseUrl,
    serviceRoleKey,
    fetch: deps.fetch || globalThis.fetch
  }
}

async function postTable(deps, table, conflictKey, rows) {
  if (!rows.length) return
  const url = `${deps.supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}?on_conflict=${conflictKey}`
  const headers = {
    apikey: deps.serviceRoleKey,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal'
  }
  // New sb_secret_* keys are API keys, not JWTs. Sending one as a bearer
  // token makes Supabase try to parse an invalid JWT. Keep the legacy bearer
  // header for the old service_role JWT compatibility path.
  if (!/^sb_secret_/.test(deps.serviceRoleKey)) {
    headers.Authorization = `Bearer ${deps.serviceRoleKey}`
  }
  const result = await deps.fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows)
  })
  if (!result?.ok) throw new Error(`Supabase ${table} failed: ${result?.status || 0}`)
}

export async function handleExperimentRequest(request, injectedDeps = {}) {
  if (request?.method !== 'POST') return response(405, { ok: false, error: 'method-not-allowed' })
  const deps = getDependencies(injectedDeps)
  if (!deps.configured || typeof deps.fetch !== 'function') return response(503, { ok: false, error: 'server-not-configured', retryable: true })
  let payload
  try {
    payload = await request.json()
  } catch {
    return response(400, { ok: false, error: 'invalid-json' })
  }
  const validationError = validatePayload(payload)
  if (validationError) return response(400, { ok: false, error: validationError })
  try {
    await postTable(deps, 'experiment_sessions', 'session_id', payload.sessions.map(mapSession))
    await postTable(deps, 'experiment_trials', 'event_id', payload.trials.map(mapTrial))
    await postTable(deps, 'reader_trials', 'event_id', payload.readerTrials.map(mapReaderTrial))
    return response(200, { ok: true, batchId: payload.batchId })
  } catch (error) {
    return response(502, { ok: false, error: 'database-unavailable', retryable: true, detail: error.message })
  }
}

export default async function vercelHandler(request, responseObject) {
  const result = await handleExperimentRequest(request)
  if (responseObject?.status && responseObject?.json) {
    return responseObject.status(result.status).json(result.body)
  }
  return result
}
