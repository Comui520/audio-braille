// src/input.js
import { dotsToComponent, syllableToDots, dotsToUnicode, applyVariation } from './braille-engine.js'
import { playAudioBraille } from './audio-braille.js'
import { speak } from './speech.js'

// 官方布局（可自定义：存储于 localStorage，见 app.js 设置加载）
export const KEY_DOT_MAP = { '7': 0, '4': 1, '1': 2, '8': 3, '5': 4, '2': 5 }
export const keyToDot = (key) => (key in KEY_DOT_MAP ? KEY_DOT_MAP[key] : null)

// 输入阶段：initial(声母) → final(韵母) → tone(声调，可选) → commit
export function nextStageAfterConfirm(stage, withTone) {
  if (stage === 'initial') return 'final'
  if (stage === 'final') return withTone ? 'tone' : 'commit'
  if (stage === 'tone') return 'commit'
  return 'commit'
}

// 组装当前音节的盲文方序列并解析为拼音（供上屏/播报）
export function buildSyllable(buffers, withTone) {
  // buffers: { initial: dotsArray|null, final: dotsArray|null, tone: dotsArray|null }
  const init = buffers.initial ? dotsToComponent(buffers.initial) : null
  const fin = buffers.final ? dotsToComponent(buffers.final) : null
  if (!init || init.type !== 'initial') return null
  if (!fin || fin.type !== 'final') return null
  const tone = withTone && buffers.tone ? dotsToComponent(buffers.tone) : null
  const { initial, final } = applyVariation(init.value, fin.value)
  return { initial, final, tone: tone?.type === 'tone' ? tone.value : null, dots: syllableToDots(init.value, fin.value, tone?.value) }
}

// DOM 接入：绑定全局 keydown（由 app.js 调用）
// 依赖：AppState（state）、storage 设置、UI 回调
// 重要：所有小键盘键 preventDefault()，避免 textarea 中误输数字
export function initInput({ state, render, settings }) {
  const buffers = { initial: null, final: null, tone: null }
  const withTone = () => settings.toneMode !== false   // 设置：进阶模式默认开启声调

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return   // 让位组合键（Ctrl+S 等）

    const dotIndex = keyToDot(e.key)
    if (dotIndex !== null) {
      e.preventDefault()
      state.setDots(dotIndex)
      if (settings.clickSound) playClick()
      render()
      return
    }

    switch (e.key) {
      case '0': {   // 确认：当前方 → 下一阶段 或 上屏
        e.preventDefault()
        // state.brailleDots 是布尔数组，需转为数字点位数组再解析
        const dots = state.brailleDots.map((v, i) => (v ? i + 1 : 0)).filter(Boolean)
        const comp = dotsToComponent(dots)
        if (state.inputStage === 'initial' && comp?.type === 'initial') {
          buffers.initial = dots
          state.inputStage = nextStageAfterConfirm('initial', withTone())
          state.clearDots()
        } else if (state.inputStage === 'final' && comp?.type === 'final') {
          buffers.final = dots
          state.inputStage = nextStageAfterConfirm('final', withTone())
          state.clearDots()
          if (state.inputStage === 'commit') void commit()   // 无调：两方即上屏
        } else if (state.inputStage === 'tone' && comp?.type === 'tone') {
          buffers.tone = dots
          state.inputStage = 'commit'
          void commit()
        } else {
          speak('请输入有效的盲文点位')
        }
        render()
        break
      }
      case '3': {   // 退格：回退上一阶段或删除
        e.preventDefault()
        if (buffers.tone) { buffers.tone = null; state.inputStage = 'tone' }
        else if (buffers.final) { buffers.final = null; state.inputStage = 'final' }
        else if (buffers.initial) { buffers.initial = null; state.inputStage = 'initial' }
        else onBackspace?.()
        render()
        break
      }
      case '-': {   // 清空
        e.preventDefault()
        buffers.initial = buffers.final = buffers.tone = null
        state.brailleDots = [false, false, false, false, false, false]
        state.inputStage = 'initial'
        speak('已清空')
        render()
        break
      }
      case '+': {   // 朗读当前点位 + 和弦预览
        e.preventDefault()
        const dots = state.brailleDots.map((v, i) => (v ? i + 1 : 0)).filter(Boolean)
        speak(dots.length ? `点${dots.join('、点')}` : '当前无点位')
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
    if (!syl) { speak('无法解析的音节'); return }
    const unicode = syl.dots.map(dotsToUnicode).join('')
    onInsert(unicode)
    speak(`${syl.initial}${syl.final}${syl.tone ?? ''}`)
    // 确认时触发 AudioBraille：逐方演奏整个音节（每方 0.25s，方间 0.1s）
    for (const dots of syl.dots) {
      await playAudioBraille(dots, { duration: 0.25 })
      await new Promise(r => setTimeout(r, 100))
    }
    buffers.initial = buffers.final = buffers.tone = null
    state.brailleDots = [false, false, false, false, false, false]
    state.inputStage = 'initial'
  }

  // 注入的 UI 回调（app.js 提供）
  let onInsert = () => {}
  let onBackspace = () => {}
  return {
    setInsertHandler(fn) { onInsert = fn },
    setBackspaceHandler(fn) { onBackspace = fn },
    clearBuffers() { buffers.initial = buffers.final = buffers.tone = null },
    // 供 app.js 在输入模式/页面切换时清空阶段
    resetInput() { this.clearBuffers(); state.brailleDots = [false, false, false, false, false, false]; state.inputStage = 'initial' }
  }
}

function playClick() {
  // 极短、低音量、无音高的咔嗒声（可被 settings.clickSound 关闭）
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
  } catch { /* 音频不可用则忽略 */ }
}
