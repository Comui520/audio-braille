const SENSITIVE_FIELDS = new Set(['text', 'pinyin', 'title', 'plain', 'passageText', 'materialText', 'brailleCells'])

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

export async function saveFormalSession(storage, session = {}) {
  if (!isFormalSession(session)) throw new Error('formal session requires consent and sessionId')
  return storage.saveExperimentSession({
    ...session,
    uploadStatus: session.uploadStatus || 'pending'
  })
}

export async function saveTrial(storage, trial = {}) {
  if (!trial.eventId || !trial.sessionId) throw new Error('trial requires eventId and sessionId')
  return storage.saveExperimentTrial({ dataClass: 'formal', uploadStatus: 'pending', ...trial })
}

export async function saveReaderTrial(storage, record = {}) {
  if (!record.eventId || !record.sessionId) throw new Error('reader trial requires eventId and sessionId')
  return storage.saveReaderTrial({ dataClass: 'formal', uploadStatus: 'pending', ...record })
}

export async function buildUploadBatch(storage) {
  const [allSessions, allTrials, allReaderTrials] = await Promise.all([
    storage.loadExperimentSessions(),
    storage.loadExperimentTrials(),
    storage.loadReaderTrials()
  ])
  const sessions = allSessions.filter(session => isFormalSession(session) && session.uploadStatus !== 'uploaded')
  const sessionIds = new Set(sessions.map(session => session.sessionId))
  const trials = allTrials.filter(trial => sessionIds.has(trial.sessionId) && trial.uploadStatus !== 'uploaded')
  const readerTrials = allReaderTrials.filter(trial => sessionIds.has(trial.sessionId) && trial.uploadStatus !== 'uploaded')
  const batch = {
    batchId: makeId('batch'),
    createdAt: new Date().toISOString(),
    sessions,
    trials,
    readerTrials
  }
  await storage.saveExperimentUpload({
    batchId: batch.batchId,
    sessionIds: [...sessionIds],
    status: 'pending',
    createdAt: batch.createdAt
  })
  return batch
}

export async function markUploadResult(storage, sessionIds = [], result = {}) {
  const ids = new Set(sessionIds)
  const [sessions, trials, readerTrials] = await Promise.all([
    storage.loadExperimentSessions(),
    storage.loadExperimentTrials(),
    storage.loadReaderTrials()
  ])
  const uploaded = result.ok === true
  const timestamp = new Date().toISOString()
  await Promise.all(sessions.filter(session => ids.has(session.sessionId)).map(session => storage.saveExperimentSession({
    ...session,
    uploadStatus: uploaded ? 'uploaded' : 'pending',
    uploadedAt: uploaded ? timestamp : session.uploadedAt,
    lastUploadError: uploaded ? null : (result.error || 'upload-failed')
  })))
  await Promise.all(trials.filter(trial => ids.has(trial.sessionId)).map(trial => storage.saveExperimentTrial({
    ...trial,
    uploadStatus: uploaded ? 'uploaded' : 'pending',
    uploadedAt: uploaded ? timestamp : trial.uploadedAt
  })))
  await Promise.all(readerTrials.filter(trial => ids.has(trial.sessionId)).map(trial => storage.saveReaderTrial({
    ...trial,
    uploadStatus: uploaded ? 'uploaded' : 'pending',
    uploadedAt: uploaded ? timestamp : trial.uploadedAt
  })))
  return { ok: uploaded, sessionIds: [...ids] }
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
    storage.loadExperimentSessions(),
    storage.loadExperimentTrials(),
    storage.loadReaderTrials()
  ])
  const formalSessions = sessions.filter(isFormalSession)
  const sessionIds = new Set(formalSessions.map(session => session.sessionId))
  const safeSessions = formalSessions.map(sanitizeRecord)
  const safeTrials = trials.filter(trial => sessionIds.has(trial.sessionId)).map(sanitizeRecord)
  const safeReaderTrials = readerTrials.filter(trial => sessionIds.has(trial.sessionId)).map(sanitizeRecord)
  if (format === 'csv') {
    return toCsv([
      ...safeSessions.map(record => ({ recordType: 'session', ...record })),
      ...safeTrials.map(record => ({ recordType: 'trial', ...record })),
      ...safeReaderTrials.map(record => ({ recordType: 'readerTrial', ...record }))
    ])
  }
  return JSON.stringify({ app: 'AudioBraille', version: 1, sessions: safeSessions, trials: safeTrials, readerTrials: safeReaderTrials }, null, 2)
}
