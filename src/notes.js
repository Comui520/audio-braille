// src/notes.js —— v5：笔记记录器（明文对照 + 双模式朗读）
// 明文对照：输入盲文的同时，在下方显示对应的拉丁字母/拼音（方便不懂盲文的人验证）
// 双模式朗读：①盲文转文字 → TTS 读 ②直接 AudioBraille 逐方播放，速度可调
import { dotsToUnicode, unicodeToDots, dotsToLatin } from './braille-engine.js'
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

// 明文对照：把盲文方序列转成拉丁字母（英文模式）或拼音（中文模式）
// 返回逐方对照数组：{ unicode, char }（char 为 null 表示无法解析）
export function buildPlainReference(dotsSeq) {
  return dotsSeq.map(d => ({
    unicode: dotsToUnicode(d),
    char: getLang() === 'en' ? dotsToLatin(d) : null
  }))
}

// —— 笔记 UI（由 app.js 调用）——
// textarea + 快捷键：Ctrl+S 保存、Ctrl+O 历史、Ctrl+N 新建
// 回放：+ 键朗读明文 + playAudioBraille 逐方演奏（每方间隔 0.3s）
export function initNotes({ state, storage, render }) {
  let current = { id: null, title: '', plain: '', dotsSeq: [] }
  return {
    view() {
      const sec = document.createElement('section')
      sec.innerHTML = `
        <h1>${t('notesTitle')}</h1>
        <textarea id="note-textarea" rows="10" aria-label="笔记内容"></textarea>
        <div id="note-reference" aria-live="polite" class="note-reference"></div>
        <button id="note-save">${t('notesSave')}</button>
        <button id="note-play">${t('notesPlay')}</button>
      `
      return sec
    },
    // 明文对照更新（由 app.js 在每次上屏后调用）
    updateReference() {
      const ta = document.querySelector('#note-textarea')
      const refEl = document.querySelector('#note-reference')
      if (!ta || !refEl) return
      const dotsSeq = extractDotsFromText(ta.value)
      const refs = buildPlainReference(dotsSeq)
      refEl.innerHTML = refs.length
        ? `<strong>${t('plainLabel')}：</strong>` + refs.map(r => r.char ? `<span class="ref-char">${r.char}</span>` : `<span class="ref-char ref-unknown">${r.unicode}</span>`).join(' ')
        : ''
    },
    async save() {
      const textarea = document.querySelector('#note-textarea')
      current.plain = textarea.value
      current.dotsSeq = extractDotsFromText(textarea.value)
      if (!current.id) current.id = crypto.randomUUID()
      if (!current.title) current.title = new Date().toLocaleString()
      await storage.saveNote(current)
      speak(t('notesSaved'))
    },
    async list() { return storage.loadNotes() },
    async open(id) {
      const notes = await storage.loadNotes()
      current = notes.find(n => n.id === id) ?? current
      const ta = document.querySelector('#note-textarea')
      ta.value = current.plain
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
    async playback() {
      const dotsSeq = extractDotsFromText(current.plain)
      const { playAudioBraille } = await import('./audio-braille.js')
      speak(current.plain.replace(/[\u2800-\u28ff]/g, ' ').trim() || t('notesEmpty'))
      for (const dots of buildPlaybackSequence(dotsSeq)) {
        await playAudioBraille(dots, { duration: 0.2 })
        await new Promise(r => setTimeout(r, 300))   // 方间 0.3s
      }
    },
    // 双模式朗读（v5）：mode = 'tts'（盲文转文字 TTS）| 'braille'（AudioBraille 直接读）
    // speed: 0.5~5x（AudioBraille 模式有效）
    async readAloud(mode = 'tts', speed = 1) {
      const dotsSeq = extractDotsFromText(current.plain)
      if (mode === 'tts') {
        const text = plainToSpeech(current.plain)
        speak(text || t('notesEmpty'))
        return
      }
      // AudioBraille 直接读：速度可调（越快每方越短）
      const { playAudioBraille } = await import('./audio-braille.js')
      const sp = Math.min(5, Math.max(0.5, Number(speed) || 1))
      for (const dots of dotsSeq) {
        await playAudioBraille(dots, { duration: Math.max(0.05, 0.4 / sp) })
        await new Promise(r => setTimeout(r, 120 / sp))
      }
    }
  }
}
