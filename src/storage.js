// src/storage.js
// 存储抽象层：IndexedDB 存笔记/进度；localStorage 存轻量设置。
// 业务代码只依赖本模块接口；将来套 Tauri 时仅替换本文件内部实现。

export function createStorage() {
  let db = null

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('AudioBraille', 2)
      req.onupgradeneeded = () => {
        const d = req.result
        if (!d.objectStoreNames.contains('notes')) d.createObjectStore('notes', { keyPath: 'id' })
        if (!d.objectStoreNames.contains('progress')) d.createObjectStore('progress', { keyPath: 'key' })
        if (!d.objectStoreNames.contains('experimentSessions')) d.createObjectStore('experimentSessions', { keyPath: 'sessionId' })
        if (!d.objectStoreNames.contains('experimentTrials')) d.createObjectStore('experimentTrials', { keyPath: 'eventId' })
        if (!d.objectStoreNames.contains('readerTrials')) d.createObjectStore('readerTrials', { keyPath: 'eventId' })
        if (!d.objectStoreNames.contains('experimentUploads')) d.createObjectStore('experimentUploads', { keyPath: 'batchId' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  function tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      let transaction
      let request
      try {
        transaction = db.transaction(store, mode)
        request = fn(transaction.objectStore(store))
      } catch (error) {
        reject(error)
        return
      }
      transaction.oncomplete = () => resolve(request?.result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error || new Error('transaction-aborted'))
    })
  }

  function multiTx(stores, mode, fn) {
    return new Promise((resolve, reject) => {
      let transaction
      try {
        transaction = db.transaction(stores, mode)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error || new Error('transaction-aborted'))
        const objects = Object.fromEntries(stores.map(store => [store, transaction.objectStore(store)]))
        fn(objects)
      } catch (error) {
        reject(error)
        return
      }
    })
  }


  return {
    async init() { db = await open() },
    async saveNote(note) { return tx('notes', 'readwrite', s => s.put(note)) },
    async deleteNote(id) { return tx('notes', 'readwrite', s => s.delete(id)) },
    async loadNotes() { return tx('notes', 'readonly', s => s.getAll()) },
    async clearAll() {
      await tx('notes', 'readwrite', s => s.clear())
      await tx('progress', 'readwrite', s => s.clear())
      await tx('experimentSessions', 'readwrite', s => s.clear())
      await tx('experimentTrials', 'readwrite', s => s.clear())
      await tx('readerTrials', 'readwrite', s => s.clear())
      await tx('experimentUploads', 'readwrite', s => s.clear())
    },
    async saveProgress(progress) { return tx('progress', 'readwrite', s => s.put({ key: 'main', ...progress })) },
    async loadProgress() {
      const rec = await tx('progress', 'readonly', s => s.get('main'))
      return rec ?? {}
    },

    async saveExperimentSession(session) { return tx('experimentSessions', 'readwrite', s => s.put(session)) },
    async loadExperimentSessions() { return tx('experimentSessions', 'readonly', s => s.getAll()) },
    async saveExperimentTrial(trial) { return tx('experimentTrials', 'readwrite', s => s.put(trial)) },
    async loadExperimentTrials() { return tx('experimentTrials', 'readonly', s => s.getAll()) },
    async saveReaderTrial(trial) { return tx('readerTrials', 'readwrite', s => s.put(trial)) },
    async loadReaderTrials() { return tx('readerTrials', 'readonly', s => s.getAll()) },
    async saveExperimentUpload(upload) { return tx('experimentUploads', 'readwrite', s => s.put(upload)) },
    async loadExperimentUploads() { return tx('experimentUploads', 'readonly', s => s.getAll()) },
    async markExperimentUpload({ batchId, sessionIds = [], trialEventIds = [], readerTrialEventIds = [], ok = false, error = null, updatedAt = new Date().toISOString() }) {
      const status = ok ? 'uploaded' : 'pending'
      await multiTx(['experimentSessions', 'experimentTrials', 'readerTrials', 'experimentUploads'], 'readwrite', stores => {
        const update = (store, key, fields) => {
          const request = stores[store].get(key)
          request.onsuccess = () => {
            if (request.result) stores[store].put({ ...request.result, ...fields })
          }
        }
        sessionIds.forEach(id => update('experimentSessions', id, {
          uploadStatus: status,
          uploadedAt: ok ? updatedAt : undefined,
          lastUploadError: ok ? null : (error || 'upload-failed')
        }))
        trialEventIds.forEach(id => update('experimentTrials', id, {
          uploadStatus: status,
          uploadedAt: ok ? updatedAt : undefined
        }))
        readerTrialEventIds.forEach(id => update('readerTrials', id, {
          uploadStatus: status,
          uploadedAt: ok ? updatedAt : undefined
        }))
        stores.experimentUploads.put({
          batchId,
          sessionIds: [...sessionIds],
          trialEventIds: [...trialEventIds],
          readerTrialEventIds: [...readerTrialEventIds],
          status,
          updatedAt,
          error: ok ? null : (error || 'upload-failed')
        })
      })
    },

    // 导出：JSON（含元数据与版本号）；.brf 为盲文 ASCII 文本（点位用数字串，空格=空方）
    async exportNotes(format = 'json') {
      const notes = await this.loadNotes()
      if (format === 'brf') {
        return notes.map(n => n.dotsSeq.map(d => d.join('') || ' ').join(' ') + '\n' + n.plain + '\n').join('\n')
      }
      return JSON.stringify({ app: 'AudioBraille', version: 2, notes }, null, 2)
    },

    async importNotes(content, format = 'json') {
      if (format === 'brf') {
        // .brf 简单解析：按行读入（盲文行 + 明文行交替）
        const lines = content.split('\n').filter(l => l.trim() !== '')
        for (let i = 0; i + 1 < lines.length; i += 2) {
          const dotsSeq = lines[i].split(' ').map(c => (c.trim() === '' ? [] : [...c].map(Number)))
          await this.saveNote({ id: crypto.randomUUID(), title: `导入 ${new Date().toLocaleString()}`, plain: lines[i + 1], dotsSeq })
        }
        return
      }
      const data = JSON.parse(content)
      for (const n of data.notes) await this.saveNote(n)
    }
  }
}

// 轻量设置（localStorage）——不依赖 IndexedDB，直接导出静态方法
const SETTINGS_KEY = 'AudioBraille.settings'
export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) } catch { return null }
}
export function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) }
