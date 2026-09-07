const SENSITIVE_FIELDS = new Set(['text', 'pinyin', 'title', 'plain', 'passageText', 'materialText', 'brailleCells'])
const PROFILE_FIELDS = ['visionStatus', 'brailleExperience', 'audioEncodingExperience']

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sanitizeRecord(record = {}) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !SENSITIVE_FIELDS.has(key)))
}

function isFormalSession(session) {
  return session?.dataClass === 'formal' && session?.consentAccepted === true && typeof session.sessionId === 'string'
}

function asEventId(record = {}, fallbackPrefix) {
  return record.eventId || record.trialId || record.passageTrialId || makeId(fallbackPrefix)
}

export async function saveFormalSession(storage, session = {}) {
  if (!isFormalSession(session)) throw new Error('formal session requires consent and sessionId')
  return storage.saveExperimentSession({ ...session, uploadStatus: session.uploadStatus || 'pending' })
}

export async function saveTrial(storage, trial = {}) {
  const eventId = asEventId(trial, 'trial')
  if (!eventId || !trial.sessionId) throw new Error('trial requires eventId and sessionId')
  const dataClass = trial.phase === 'formal' ? 'formal' : 'training'
  return storage.saveExperimentTrial({ ...trial, eventId, dataClass, uploadStatus: 'pending' })
}

export async function saveReaderTrial(storage, record = {}) {
  const eventId = asEventId(record, 'reader')
  if (!eventId || !record.sessionId) throw new Error('reader trial requires eventId and sessionId')
  return storage.saveReaderTrial({ ...record, eventId, dataClass: record.dataClass === 'formal' ? 'formal' : 'training', uploadStatus: 'pending' })
}

export async function buildUploadBatch(storage) {
  const [allSessions, allTrials, allReaderTrials] = await Promise.all([
    storage.loadExperimentSessions(), storage.loadExperimentTrials(), storage.loadReaderTrials()
  ])
  const sessionsById = new Map(allSessions.filter(isFormalSession).map(session => [session.sessionId, session]))
  const pendingTrials = allTrials.filter(trial => trial.dataClass === 'formal' && trial.phase === 'formal' && trial.uploadStatus !== 'uploaded')
  const pendingReaderTrials = allReaderTrials.filter(trial => trial.dataClass === 'formal' && trial.uploadStatus !== 'uploaded')
  const pendingChildSessionIds = new Set([
    ...pendingTrials.map(trial => trial.sessionId),
    ...pendingReaderTrials.map(trial => trial.sessionId)
  ])
  const sessions = [...sessionsById.values()].filter(session => session.uploadStatus !== 'uploaded' || pendingChildSessionIds.has(session.sessionId))
  const sessionIds = new Set(sessions.map(session => session.sessionId))
  const trials = pendingTrials.filter(trial => sessionIds.has(trial.sessionId))
  const readerTrials = pendingReaderTrials.filter(trial => sessionIds.has(trial.sessionId))
  const studyVersions = new Set(sessions.map(session => session.studyVersion).filter(Boolean))
  if (studyVersions.size > 1) throw new Error('multiple study versions cannot share a batch')
  const batch = {
    batchId: makeId('batch'),
    studyVersion: [...studyVersions][0] || null,
    sessionIds: [...sessionIds],
    trialEventIds: trials.map(trial => trial.eventId),
    readerTrialEventIds: readerTrials.map(trial => trial.eventId),
    createdAt: new Date().toISOString(),
    sessions,
    trials,
    readerTrials
  }
  await storage.saveExperimentUpload({
    batchId: batch.batchId,
    sessionIds: [...sessionIds],
    trialEventIds: trials.map(trial => trial.eventId),
    readerTrialEventIds: readerTrials.map(trial => trial.eventId),
    status: 'pending',
    createdAt: batch.createdAt
  })
  return batch
}

export async function markUploadResult(storage, batchOrSessionIds = [], result = {}) {
  const batch = Array.isArray(batchOrSessionIds)
    ? { sessionIds: batchOrSessionIds, trialEventIds: [], readerTrialEventIds: [], batchId: makeId('legacy-batch') }
    : batchOrSessionIds
  const sessionIds = new Set(batch.sessionIds || [])
  if (Array.isArray(batchOrSessionIds)) {
    const [trials, readerTrials] = await Promise.all([storage.loadExperimentTrials(), storage.loadReaderTrials()])
    batch.trialEventIds = trials.filter(item => sessionIds.has(item.sessionId)).map(item => item.eventId)
    batch.readerTrialEventIds = readerTrials.filter(item => sessionIds.has(item.sessionId)).map(item => item.eventId)
  }
  const timestamp = new Date().toISOString()
  await storage.markExperimentUpload({
    batchId: batch.batchId,
    sessionIds: [...sessionIds],
    trialEventIds: batch.trialEventIds || [],
    readerTrialEventIds: batch.readerTrialEventIds || [],
    ok: result.ok === true,
    error: result.error || null,
    updatedAt: timestamp
  })
  return { ok: result.ok === true, sessionIds: [...sessionIds], batchId: batch.batchId }
}

function csvValue(value) {
  const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function toCsv(records) {
  const keys = [...new Set(records.flatMap(record => Object.keys(record)))]
  return [keys.join(','), ...records.map(record => keys.map(key => csvValue(record[key])).join(','))].join('\n') + '\n'
}

export async function exportExperimentData(storage, format = 'json') {
  const [sessions, trials, readerTrials] = await Promise.all([
    storage.loadExperimentSessions(), storage.loadExperimentTrials(), storage.loadReaderTrials()
  ])
  const formalSessions = sessions.filter(isFormalSession)
  const sessionIds = new Set(formalSessions.map(session => session.sessionId))
  const safeSessions = formalSessions.map(session => sanitizeRecord({
    ...session,
    profile: Object.fromEntries(PROFILE_FIELDS.filter(field => field in (session.profile || {})).map(field => [field, session.profile[field]]))
  }))
  const safeTrials = trials.filter(trial => sessionIds.has(trial.sessionId) && trial.dataClass === 'formal' && trial.phase === 'formal').map(sanitizeRecord)
  const safeReaderTrials = readerTrials.filter(trial => sessionIds.has(trial.sessionId) && trial.dataClass === 'formal').map(sanitizeRecord)
  if (format === 'csv') return toCsv([
    ...safeSessions.map(record => ({ recordType: 'session', ...record })),
    ...safeTrials.map(record => ({ recordType: 'trial', ...record })),
    ...safeReaderTrials.map(record => ({ recordType: 'readerTrial', ...record }))
  ])
  return JSON.stringify({ app: 'AudioBraille', version: 1, sessions: safeSessions, trials: safeTrials, readerTrials: safeReaderTrials }, null, 2)
}
