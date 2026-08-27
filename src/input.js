// src/input.js —— v3：全模块统一输入处理器
// 核心设计（用户确认）：
// 1) 按点位键（7/4/1/8/5/2）只切换点位 + 右侧实时显示"当前组合 → 字母"（不播报，除非按 0）
// 2) 按 0 = 提交/确认：教学判定 / 实验猜答案 / 输入器上屏（含播报）
// 3) 非法点位组合：输入器不显示、按 0 时提示"无效"
// 4) 教学/实验的按 0 走各自模块的判定；输入器/笔记走盲文直出
import { dotsToUnicode, dotsToComponent, applyVariation, syllableToDots, dotsToLatin } from './braille-engine.js'
import { playAudioBraille } from './audio-braille.js'
import { speak } from './speech.js'
import { t, getLang } from './i18n.js'
import { cellsToUnicode } from './cells.js'

// 官方布局（可自定义：存储于 localStorage，见 app.js 设置加载）
export const KEY_DOT_MAP = { '7': 0, '4': 1, '1': 2, '8': 3, '5': 4, '2': 5 }
export const keyToDot = (key) => (key in KEY_DOT_MAP ? KEY_DOT_MAP[key] : null)

// 输入模式：latin（英文：单方直出） | pinyin（中文：声母+韵母+声调 三方状态机）
export function resolveInputMode(settings) {
  return getLang() === 'en' ? 'latin' : (settings?.pinyinMode === false ? 'latin' : 'pinyin')
}

// 拼音状态机（中文模式保留；见 v1 文档）
export function nextStageAfterConfirm(stage, withTone) {
  if (stage === 'initial') return 'final'
  if (stage === 'final') return withTone ? 'tone' : 'commit'
  if (stage === 'tone') return 'commit'
  return 'commit'
}

// 逐方确认状态机（v5：*下一方 //上一方；拼音 声母→韵母→声调）
export const CELL_ORDER = ['initial', 'final', 'tone', 'commit']
export function nextCell(stage) {
  const i = CELL_ORDER.indexOf(stage)
  if (i === -1 || i >= CELL_ORDER.length - 1) return 'commit'
  return CELL_ORDER[i + 1]
}
export function prevCell(stage) {
  const i = CELL_ORDER.indexOf(stage)
  if (i <= 0) return 'initial'
  return CELL_ORDER[i - 1]
}
export function cellLabel(stage) {
  return { initial: '声母', final: '韵母', tone: '声调', commit: '提交' }[stage] || stage
}

// 组装当前音节的盲文方序列并解析为拼音（中文模式用）
export function buildSyllable(buffers, withTone) {
  const init = buffers.initial ? dotsToComponent(buffers.initial) : null
  const fin = buffers.final ? dotsToComponent(buffers.final) : null
  if (!init || init.type !== 'initial') return null
  if (!fin || fin.type !== 'final') return null
  const tone = withTone && buffers.tone ? dotsToComponent(buffers.tone) : null
  const { initial, final } = applyVariation(init.value, fin.value)
  return { initial, final, tone: tone?.type === 'tone' ? tone.value : null, dots: syllableToDots(init.value, fin.value, tone?.value) }
}

// 点位（数字数组）→ 可读字符（优先拉丁字母，其次拼音成分）
export function dotsToReadable(dots) {
  const latin = dotsToLatin(dots)
  if (latin) return latin
  const comp = dotsToComponent(dots)
  if (comp) {
    // 声母/韵母/声调：加类型标记便于区分
    const marks = { initial: '声', final: '韵', tone: '调' }
    return `${comp.value}(${marks[comp.type] || ''})`
  }
  return null
}

// DOM 接入：绑定全局 keydown（由 app.js 调用）
export function initInput({ state, render, settings }) {
  // v7：cells 缓冲统一命名（教学与实验共用逐方输入机制）
  const buffers = { initial: null, final: null, tone: null, cells: [] }
  const withTone = () => settings.toneMode !== false
  const inputMode = () => resolveInputMode(settings)

  // 提交回调（app.js 注入）
  let onTeachingSubmit = null
  let onExperimentSubmit = null

  // 输入实时反馈（右侧显示，不播报）
  const feedbackEl = Object.assign(document.createElement('div'), { id: 'input-feedback' })
  feedbackEl.setAttribute('aria-live', 'polite')

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return   // 让位组合键

    const dotIndex = keyToDot(e.key)
    if (dotIndex !== null) {
      e.preventDefault()
      state.setDots(dotIndex)
      if (settings.clickSound) playClick()
      // 右侧实时显示当前组合 → 字符（合法显示，非法空）
      // v7：已确认的方一并显示，让用户看得见光标位置
      const dots = state.brailleDots.map((v, i) => (v ? i + 1 : 0)).filter(Boolean)
      const readable = dotsToReadable(dots)
      const donePrefix = buffers.cells.length > 0
        ? buffers.cells.map(c => cellsToUnicode([c])).join('') + ' + '
        : ''
      feedbackEl.textContent = readable
        ? `${donePrefix}${dots.join('')} → ${readable}`
        : (donePrefix ? `${donePrefix}…` : '')
      render()
      return
    }

    switch (e.key) {
      case '0': {   // 提交/确认
        e.preventDefault()
        const dots = state.brailleDots.map((v, i) => (v ? i + 1 : 0)).filter(Boolean)
        // 教学模式：提交判定（v7：支持多方——已用 * 确认的方 + 当前方一起提交）
        if (state.currentPage === 'teaching' && onTeachingSubmit) {
          const allCells = [...buffers.cells]
          if (dots.length > 0) allCells.push(dots)
          buffers.cells = []
          state.clearDots()
          feedbackEl.textContent = ''
          onTeachingSubmit(allCells)
          render()
          return
        }
        // 实验模式：统一入口 handleKey0（有点位=提交猜测；无点位=播放音频；有已确认多方则合并提交）
        if (state.currentPage === 'experiment' && onExperimentSubmit) {
          // 若已用 * 确认过一方或多方，把当前方并进去一起提交
          if (buffers.cells.length > 0) {
            const allCells = [...buffers.cells]
            if (dots.length > 0) allCells.push(dots)
            buffers.cells = []
            state.clearDots()
            feedbackEl.textContent = ''
            onExperimentSubmit(allCells)
            render()
            return
          }
          onExperimentSubmit(dots)
          render()
          return
        }
        // 盲文输入器/笔记：盲文直出——任何非空点位组合都是合法盲文方
        // （拉丁字母/声母/韵母/声调/标点均可上屏，播报可读字符）
        if (dots.length === 0) {
          speak(t('noDots'))
          render()
          break
        }
        onInsert(dotsToUnicode(dots))
        // 播报：优先拉丁字母，其次拼音成分名，最后报点位
        const latin = dotsToLatin(dots)
        if (latin) {
          speak(latin)
        } else {
          const comp = dotsToComponent(dots)
          if (comp) speak(comp.value)
          else speak(`点${dots.join('、点')}`)
        }
        playAudioBraille(dots)
        state.clearDots()
        feedbackEl.textContent = ''
        render()
        break
      }
      case '3': {   // 退格
        e.preventDefault()
        if (state.currentPage === 'teaching' || state.currentPage === 'experiment') {
          // v7：教学/实验统一——当前方有点则清当前方；当前方为空则回退上一已确认方
          const dots = state.brailleDots.map((v, i) => (v ? i + 1 : 0)).filter(Boolean)
          if (dots.length > 0) {
            state.clearDots()
            feedbackEl.textContent = buffers.cells.length > 0
              ? `${buffers.cells.map(c => cellsToUnicode([c])).join('')} + …`
              : ''
          } else if (buffers.cells.length > 0) {
            const back = buffers.cells.pop()
            state.brailleDots = [1, 2, 3, 4, 5, 6].map(d => back.includes(d))
            feedbackEl.textContent = t('cellBack', { n: String(buffers.cells.length) })
          }
          render()
          break
        }
        onBackspace?.()
        render()
        break
      }
      case '-': {   // 清空
        e.preventDefault()
        buffers.initial = buffers.final = buffers.tone = null
        buffers.cells = []
        state.brailleDots = [false, false, false, false, false, false]
        state.inputStage = 'initial'
        feedbackEl.textContent = ''
        speak(t('clearDone'))
        render()
        break
      }
      case '+': {   // 朗读当前点位 + 和弦预览
        e.preventDefault()
        const dots = state.brailleDots.map((v, i) => (v ? i + 1 : 0)).filter(Boolean)
        const readable = dotsToReadable(dots)
        if (readable) speak(readable)
        else speak(dots.length ? `点${dots.join('、点')}` : t('noDots'))
        playAudioBraille(dots)
        break
      }
      case '.': {   // 空格
        e.preventDefault()
        onInsert(' ')
        break
      }
      case '*': {   // 下一方：确认当前方，进入下一方（v7：教学与实验统一）
        e.preventDefault()
        if (state.currentPage === 'experiment' || state.currentPage === 'teaching') {
          const dots = state.brailleDots.map((v, i) => (v ? i + 1 : 0)).filter(Boolean)
          if (dots.length > 0) {
            buffers.cells.push(dots)
            state.clearDots()
            feedbackEl.textContent = t('cellConfirmed', {
              n: String(buffers.cells.length),
              braille: buffers.cells.map(c => cellsToUnicode([c])).join('')
            })
            speak(t('cellNext', { n: String(buffers.cells.length + 1) }))
            render()
          } else {
            speak(t('noDots'))
          }
          return
        }
        break
      }
      case '/': {   // 上一方：回退到上一已确认方（v7：教学与实验统一）
        e.preventDefault()
        if (state.currentPage === 'experiment' || state.currentPage === 'teaching') {
          if (buffers.cells.length > 0) {
            const back = buffers.cells.pop()
            state.brailleDots = [1, 2, 3, 4, 5, 6].map(d => back.includes(d))
            feedbackEl.textContent = t('cellBack', { n: String(buffers.cells.length) })
            speak(t('cellBack', { n: String(buffers.cells.length) }))
            render()
          } else {
            speak(t('noDots'))
          }
          return
        }
        break
      }
    }
  })

  async function commit() {
    const syl = buildSyllable(buffers, withTone())
    if (!syl) { speak(t('unparsable')); return }
    const unicode = syl.dots.map(dotsToUnicode).join('')
    onInsert(unicode)
    speak(`${syl.initial}${syl.final}${syl.tone ?? ''}`)
    for (const dots of syl.dots) {
      await playAudioBraille(dots, { duration: 0.25 })
      await new Promise(r => setTimeout(r, 100))
    }
    buffers.initial = buffers.final = buffers.tone = null
    state.brailleDots = [false, false, false, false, false, false]
    state.inputStage = 'initial'
  }

  let onInsert = () => {}
  let onBackspace = () => {}
  return {
    setInsertHandler(fn) { onInsert = fn },
    setBackspaceHandler(fn) { onBackspace = fn },
    setTeachingSubmit(fn) { onTeachingSubmit = fn },
    setExperimentSubmit(fn) { onExperimentSubmit = fn },
    feedbackEl,
    clearBuffers() { buffers.initial = buffers.final = buffers.tone = null; buffers.cells = [] },
    resetInput() { this.clearBuffers(); state.brailleDots = [false, false, false, false, false, false]; state.inputStage = 'initial'; feedbackEl.textContent = '' }
  }
}

function playClick() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = new AC()
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 1800
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.05, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03)
    osc.connect(g).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.03)
  } catch { /* 忽略 */ }
}
