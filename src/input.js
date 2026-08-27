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

// 点位（数字数组）→ 可读字符（始终拉丁字母，不依赖语言——输入体验统一）
export function dotsToReadable(dots) {
  return dotsToLatin(dots)
}

// DOM 接入：绑定全局 keydown（由 app.js 调用）
export function initInput({ state, render, settings }) {
  const buffers = { initial: null, final: null, tone: null }
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
      // 右侧实时显示当前组合 → 字母（合法显示，非法空）
      const dots = state.brailleDots.map((v, i) => (v ? i + 1 : 0)).filter(Boolean)
      const readable = dotsToReadable(dots)
      feedbackEl.textContent = readable ? `${dots.join('')} → ${readable}` : ''
      render()
      return
    }

    switch (e.key) {
      case '0': {   // 提交/确认
        e.preventDefault()
        const dots = state.brailleDots.map((v, i) => (v ? i + 1 : 0)).filter(Boolean)
        // 教学模式：提交判定
        if (state.currentPage === 'teaching' && onTeachingSubmit) {
          onTeachingSubmit(dots)
          render()
          return
        }
        // 实验模式：统一入口 handleKey0（有点位=提交猜测；无点位=播放音频）
        if (state.currentPage === 'experiment' && onExperimentSubmit) {
          onExperimentSubmit(dots)
          render()
          return
        }
        // 盲文输入器/笔记：始终拉丁单方直出（输入体验装置，与语言无关）
        const latin = dotsToLatin(dots)
        if (latin) {
          onInsert(dotsToUnicode(dots))
          speak(latin)   // 仅 0 时播报
          playAudioBraille(dots)
          state.clearDots()
          feedbackEl.textContent = ''
        } else {
          speak(t('invalidDots'))
        }
        render()
        break
      }
      case '3': {   // 退格
        e.preventDefault()
        if (state.currentPage === 'teaching' || state.currentPage === 'experiment') {
          state.clearDots()
          feedbackEl.textContent = ''
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
    clearBuffers() { buffers.initial = buffers.final = buffers.tone = null },
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
