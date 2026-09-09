// src/notes.js —— v5：笔记记录器（明文对照 + 双模式朗读）
// 明文对照：输入盲文的同时，在下方显示对应的拉丁字母/拼音（方便不懂盲文的人验证）
// 双模式朗读：①盲文转文字 → TTS 读 ②直接 AudioBraille 逐方播放，速度可调
import { dotsToUnicode, unicodeToDots, dotsToLatin, formatPinyinReference } from './braille-engine.js'
import { speak } from './speech.js'
import { t, getLang } from './i18n.js'

// 从含 Unicode 盲文的文本中提取点位序列
// 规则：只取 U+2800~U+28FF 字符，空格/标点/汉字忽略
export function extractDotsFromText(text) {
  return [...text]
    .filter(ch => ch.codePointAt(0) >= 0x2800 && ch.codePointAt(0) <= 0x28ff)
    .map(unicodeToDots)
}

// 回放序列：逐方播放，每方间隔 0.3s
export function buildPlaybackSequence(dotsSeq) {
  return dotsSeq.map(d => [...d])
}

// 盲文文本 → TTS 可读文本（拉丁字母逐方转写，空格分隔；无法解析用 ·）
export function plainToSpeech(text) {
  const chars = [...text].filter(ch => ch.codePointAt(0) >= 0x2800 && ch.codePointAt(0) <= 0x28ff)
  return chars.map(ch => {
    const dots = unicodeToDots(ch)
    return dotsToLatin(dots) || '·'
  }).join(' ')
}

// 明文对照：把盲文方序列转成拉丁字母（英文模式）或拼音/数字（中文模式）
// 返回逐方对照数组：{ unicode, char }（char 为 null 表示无法解析）
// 中文模式：拉丁字母（a-z 是国际标准字母）也显示，数字符号+字母转成数字
export function buildPlainReference(dotsSeq) {
  return dotsSeq.map(d => {
    // 数字符号 3456（不在拉丁字母表内）→ 标记为数字引导 #
    const isDigitSign = d.length === 4 && [3, 4, 5, 6].every(p => d.includes(p))
    if (isDigitSign) return { unicode: dotsToUnicode(d), char: '#' }
    const latin = dotsToLatin(d)
    return { unicode: dotsToUnicode(d), char: latin || null }
  })
}

// 中文明文对照：整串盲文 → 带调拼音（v6）
// 例：⠍⠔⠁ → "mā"；无法解析的方用 · 占位
export function buildPinyinReference(dotsSeq) {
  if (!dotsSeq.length) return ''
  return formatPinyinReference(dotsSeq)
}

export function buildNotePayload({ title = '', plain = '', dotsSeq = [], documentCells = null } = {}) {
  const payload = {
    title,
    plain,
    dotsSeq: Array.isArray(dotsSeq) ? dotsSeq.map(dots => [...dots]) : []
  }
  if (Array.isArray(documentCells)) {
    payload.documentCells = documentCells.map(unit => Array.isArray(unit)
      ? unit.map(cell => Array.isArray(cell) ? [...cell] : cell)
      : (unit && typeof unit === 'object' ? { ...unit } : unit))
  }
  return payload
}

// v9 笔记播放标签，明确区分两种完全不同的播放方式
export function getNotePlaybackLabel(mode, lang = 'zh') {
  if (lang === 'en') return mode === 'tts' ? 'Read text (TTS)' : 'Play AudioBraille'
  return mode === 'tts' ? '文字朗读（TTS）' : 'AudioBraille 回放'
}

export function buildNotePlaybackCells(text) {
  return extractDotsFromText(text).map(dots => [...dots])
}

// —— 笔记 UI（由 app.js 调用）——
// textarea + 快捷键：Ctrl+S 保存、Ctrl+O 历史、Ctrl+N 新建
// 回放：+ 键朗读明文 + playAudioBraille 逐方演奏（每方间隔 0.3s）
export function initNotes({ state, storage, render, getDocumentCells = null, setDocument = null, onPlaybackCellStart = null, onPlaybackCellComplete = null } = {}) {
  let current = { id: null, title: '', plain: '', dotsSeq: [] }
  return {
    view() {
      const sec = document.createElement('section')
      sec.innerHTML = `
        <h1>${t('notesTitle')}</h1>
        <textarea id="note-textarea" rows="10" wrap="soft" aria-label="笔记内容"></textarea>
        <div id="note-reference" aria-live="polite" class="note-reference"></div>
        <div class="note-actions">
          <button id="note-save" data-action="notes-save">${t('notesSave')}</button>
          <button id="note-play" data-action="notes-play-audio">AudioBraille 回放</button>
          <button id="note-read-text" data-action="notes-play-text">文字朗读（TTS）</button>
          <button id="note-export" data-action="notes-export">${t('notesExport')}</button>
          <button id="note-import" data-action="notes-import">${t('notesImport')}</button>
          <button id="note-new" data-action="notes-new">${t('notesNew')}</button>
        </div>
        <input type="file" id="note-import-file" accept=".json,.brf" hidden>
      `
      return sec
    },
    // 明文对照更新（由 app.js 在每次上屏后调用）
    // 中文模式：显示带调拼音（如 mā）；英文模式：逐方拉丁字母
    updateReference() {
      const ta = document.querySelector('#note-textarea')
      const refEl = document.querySelector('#note-reference')
      if (!ta || !refEl) return
      const dotsSeq = extractDotsFromText(ta.value)
      if (!dotsSeq.length) { refEl.innerHTML = ''; return }
      if (getLang() === 'en') {
        // 英文：逐方字母卡片
        const refs = buildPlainReference(dotsSeq)
        refEl.innerHTML = `<strong>${t('plainLabel')}：</strong>` +
          refs.map((r, index) => r.char
            ? `<span class="ref-char" data-cell-index="${index}">${r.char}</span>`
            : `<span class="ref-char ref-unknown" data-cell-index="${index}">${r.unicode}</span>`).join(' ')
      } else {
        // 中文：带调拼音串 + 逐方字母对照
        const pinyin = buildPinyinReference(dotsSeq)
        const refs = buildPlainReference(dotsSeq)
        refEl.innerHTML = `<strong>${t('pinyinLabel')}：</strong><span class="ref-pinyin">${pinyin}</span>` +
          `<br><strong>${t('plainLabel')}：</strong>` +
          refs.map((r, index) => r.char
            ? `<span class="ref-char" data-cell-index="${index}">${r.char}</span>`
            : `<span class="ref-char ref-unknown" data-cell-index="${index}">${r.unicode}</span>`).join(' ')
      }
    },
    async save() {
      const textarea = document.querySelector('#note-textarea')
      current = buildNotePayload({
        title: current.title || new Date().toLocaleString(),
        plain: textarea.value,
        dotsSeq: extractDotsFromText(textarea.value),
        documentCells: getDocumentCells?.()
      })
      current.id = current.id || crypto.randomUUID()
      await storage.saveNote(current)
      speak(t('notesSaved'))
    },
    async list() { return storage.loadNotes() },
    async open(id) {
      const notes = await storage.loadNotes()
      current = notes.find(n => n.id === id) ?? current
      const ta = document.querySelector('#note-textarea')
      ta.value = current.plain
      setDocument?.(current.documentCells, current.plain)
      this.updateReference()
    },
    newNote() {
      current = { id: null, title: '', plain: '', dotsSeq: [] }
      const ta = document.querySelector('#note-textarea')
      ta.value = ''
      const refEl = document.querySelector('#note-reference')
      if (refEl) refEl.innerHTML = ''
      ta.focus()
    },
    // 导出：JSON（当前笔记）或 BRF（盲文文本）
    async exportNote(format = 'json') {
      const ta = document.querySelector('#note-textarea')
      const text = ta?.value || ''
      const dotsSeq = extractDotsFromText(text)
      const note = buildNotePayload({
        title: new Date().toLocaleString(),
        plain: text,
        dotsSeq,
        documentCells: getDocumentCells?.()
      })
      const blob = format === 'brf'
        ? new Blob([dotsSeq.map(d => d.join('') || ' ').join(' ') + '\n' + text.replace(/[\u2800-\u28ff]/g, ' ').trim() + '\n'], { type: 'text/plain' })
        : new Blob([JSON.stringify({ app: 'AudioBraille', version: 2, note }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `note.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      speak(t('notesExported'))
    },
    // 导入：从文件读取 JSON/BRF
    async importNote(file) {
      if (!file) return
      const text = await file.text()
      if (file.name.endsWith('.brf')) {
        // BRF：首行盲文点位，次行明文
        const lines = text.split('\n').filter(l => l.trim() !== '')
        const dotsSeq = lines[0]?.split(' ').map(c => (c.trim() === '' ? [] : [...c].map(Number))).filter(c => c.length > 0) || []
        const plain = lines[1] || ''
        const ta = document.querySelector('#note-textarea')
        if (ta) {
          ta.value = dotsSeq.map(d => dotsToUnicode(d)).join('') + (plain ? '\n' + plain : '')
          current = { id: null, title: '', plain: ta.value, dotsSeq }
          setDocument?.(null, current.plain)
          this.updateReference()
        }
      } else {
        // JSON
        const data = JSON.parse(text)
        const note = data.note || data.notes?.[0]
        if (note) {
          const ta = document.querySelector('#note-textarea')
          if (ta) {
            const imported = buildNotePayload({
              title: note.title || '',
              plain: note.plain || '',
              dotsSeq: note.dotsSeq || [],
              documentCells: note.documentCells
            })
            current = { ...imported, id: null }
            ta.value = current.plain
            setDocument?.(current.documentCells, current.plain)
            this.updateReference()
          }
        }
      }
      speak(t('notesImported'))
    },
    async playback() {
      // AudioBraille 逐方播放当前编辑区，不依赖上一次 save 的 current.plain
      const text = document.querySelector('#note-textarea')?.value ?? current.plain
      const dotsSeq = buildNotePlaybackCells(text)
      if (dotsSeq.length === 0) { speak(t('notesEmpty')); return }
      const { playAudioBraille } = await import('./audio-braille.js')
      for (const [index, dots] of buildPlaybackSequence(dotsSeq).entries()) {
        onPlaybackCellStart?.(index, dots)
        await playAudioBraille(dots, { duration: 0.2 })
        onPlaybackCellComplete?.(index, dots)
        await new Promise(r => setTimeout(r, 300))
      }
    },
    // 双模式朗读（v5）：mode = 'tts'（盲文转文字 TTS）| 'braille'（AudioBraille 直接读）
    // speed: 0.5~5x（AudioBraille 模式有效）
    async readAloud(mode = 'tts', speed = 1) {
      const sourceText = document.querySelector('#note-textarea')?.value ?? current.plain
      const dotsSeq = extractDotsFromText(sourceText)
      if (mode === 'tts') {
        const text = plainToSpeech(sourceText)
        speak(text || t('notesEmpty'))
        return
      }
      // AudioBraille 直接读：速度可调（越快每方越短）
      const { playAudioBraille } = await import('./audio-braille.js')
      const sp = Math.min(5, Math.max(0.5, Number(speed) || 1))
      for (const [index, dots] of dotsSeq.entries()) {
        onPlaybackCellStart?.(index, dots)
        await playAudioBraille(dots, { duration: Math.max(0.05, 0.4 / sp) })
        onPlaybackCellComplete?.(index, dots)
        await new Promise(r => setTimeout(r, 120 / sp))
      }
    }
  }
}
