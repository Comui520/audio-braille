// src/storage.js
// 存储抽象层：IndexedDB 存笔记/进度；localStorage 存轻量设置。
// 业务代码只依赖本模块接口；将来套 Tauri 时仅替换本文件内部实现。

export function createStorage() {
  let db = null

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('AudioBraille', 1)
      req.onupgradeneeded = () => {
        const d = req.result
        if (!d.objectStoreNames.contains('notes')) d.createObjectStore('notes', { keyPath: 'id' })
        if (!d.objectStoreNames.contains('progress')) d.createObjectStore('progress', { keyPath: 'key' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  function tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode)
      const s = t.objectStore(store)
      const req = fn(s)
      t.oncomplete = () => resolve(req?.result)
      t.onerror = () => reject(t.error)
    })
  }

  return {
    async init() { db = await open() },
    async saveNote(note) { return tx('notes', 'readwrite', s => s.put(note)) },
    async deleteNote(id) { return tx('notes', 'readwrite', s => s.delete(id)) },
    async loadNotes() { return tx('notes', 'readonly', s => s.getAll()) },
    async clearAll() { await tx('notes', 'readwrite', s => s.clear()); await tx('progress', 'readwrite', s => s.clear()) },

    async saveProgress(progress) { return tx('progress', 'readwrite', s => s.put({ key: 'main', ...progress })) },
    async loadProgress() {
      const rec = await tx('progress', 'readonly', s => s.get('main'))
      return rec ?? {}
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
