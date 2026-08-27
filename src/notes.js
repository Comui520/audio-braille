// src/notes.js
import { unicodeToDots } from './braille-engine.js'
import { speak } from './speech.js'

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

// —— 笔记 UI（由 app.js 调用）——
// textarea + 快捷键：Ctrl+S 保存、Ctrl+O 历史、Ctrl+N 新建
// 回放：+ 键朗读明文 + playAudioBraille 逐方演奏（每方间隔 0.3s）
export function initNotes({ state, storage, render }) {
  let current = { id: null, title: '', plain: '', dotsSeq: [] }
  return {
    view() {
      const sec = document.createElement('section')
      sec.innerHTML = '<h1>笔记记录器</h1><textarea id="note-textarea" rows="10" aria-label="笔记内容"></textarea><button id="note-save">保存</button><button id="note-play">回放</button>'
      return sec
    },
    async save() {
      const textarea = document.querySelector('#note-textarea')
      current.plain = textarea.value
      current.dotsSeq = extractDotsFromText(textarea.value)
      if (!current.id) current.id = crypto.randomUUID()
      if (!current.title) current.title = new Date().toLocaleString()
      await storage.saveNote(current)
      speak('笔记已保存')
    },
    async list() { return storage.loadNotes() },
    async open(id) {
      const notes = await storage.loadNotes()
      current = notes.find(n => n.id === id) ?? current
      const ta = document.querySelector('#note-textarea')
      ta.value = current.plain
    },
    newNote() {
      current = { id: null, title: '', plain: '', dotsSeq: [] }
      const ta = document.querySelector('#note-textarea')
      ta.value = ''
      ta.focus()
    },
    async playback() {
      const dotsSeq = extractDotsFromText(current.plain)
      const { playAudioBraille } = await import('./audio-braille.js')
      speak(current.plain.replace(/[\u2800-\u28ff]/g, ' ').trim() || '无明文')
      for (const dots of buildPlaybackSequence(dotsSeq)) {
        await playAudioBraille(dots, { duration: 0.2 })
        await new Promise(r => setTimeout(r, 300))   // 方间 0.3s
      }
    }
  }
}
