// src/input.js —— v9：可控逐方输入控制器
import {
  dotsToComponent,
  dotsToLatin,
  applyVariation,
  syllableToDots
} from './braille-engine.js'

// 官方小键盘布局：索引仍保持旧 API，点位由 index + 1 得出
export const KEY_DOT_MAP = { '7': 0, '4': 1, '1': 2, '8': 3, '5': 4, '2': 5 }
const KEY_POINT_MAP = Object.fromEntries(Object.entries(KEY_DOT_MAP).map(([key, index]) => [key, index + 1]))

export const keyToDot = key => (key in KEY_DOT_MAP ? KEY_DOT_MAP[key] : null)
export const keyToPoint = key => (key in KEY_POINT_MAP ? KEY_POINT_MAP[key] : null)

export function resolveInputMode({ language = 'zh', pinyinMode = true } = {}) {
  return language === 'en' ? 'latin' : (pinyinMode === false ? 'latin' : 'pinyin')
}

export const CELL_ORDER = ['initial', 'final', 'tone']
export function nextCell(stage) {
  const index = CELL_ORDER.indexOf(stage)
  if (index === -1 || index >= CELL_ORDER.length - 1) return 'commit'
  return CELL_ORDER[index + 1]
}
export function prevCell(stage) {
  if (stage === 'commit') return 'tone'
  const index = CELL_ORDER.indexOf(stage)
  if (index <= 0) return 'initial'
  return CELL_ORDER[index - 1]
}
export function cellLabel(stage) {
  return { initial: '声母', final: '韵母', tone: '声调' }[stage] || '提交'
}
export function nextStageAfterConfirm(stage, withTone) {
  if (stage === 'initial') return 'final'
  if (stage === 'final') return withTone ? 'tone' : 'commit'
  return 'commit'
}

export function dotsToReadable(dots) {
  const latin = dotsToLatin(dots)
  if (latin) return latin
  const component = dotsToComponent(dots)
  if (component) return component.value
  return null
}

export function buildSyllable(buffers, withTone = true) {
  const initialComponent = buffers?.initial ? dotsToComponent(buffers.initial) : null
  const finalComponent = buffers?.final ? dotsToComponent(buffers.final) : null
  if (initialComponent?.type !== 'initial' || finalComponent?.type !== 'final') return null
  const variation = applyVariation(initialComponent.value, finalComponent.value)
  const toneComponent = withTone && buffers?.tone ? dotsToComponent(buffers.tone) : null
  const tone = toneComponent?.type === 'tone' ? toneComponent.value : null
  return {
    initial: variation.initial,
    final: variation.final,
    tone,
    dots: syllableToDots(initialComponent.value, finalComponent.value, tone)
  }
}

function copySnapshot(confirmedCells, currentDots) {
  return {
    confirmedCells: confirmedCells.map(cell => [...cell]),
    currentDots: [...currentDots]
  }
}

export function createInputController({ onCommit = null, onSpeech = null } = {}) {
  let confirmedCells = []
  let currentDots = []

  function snapshot() {
    return copySnapshot(confirmedCells, currentDots)
  }

  function clear() {
    confirmedCells = []
    currentDots = []
  }

  function confirmCell() {
    if (currentDots.length === 0) return false
    confirmedCells.push([...currentDots])
    currentDots = []
    return true
  }

  function commit() {
    const cells = snapshot().confirmedCells
    if (currentDots.length > 0) cells.push([...currentDots])
    clear()
    onCommit?.(cells)
    return true
  }

  function handleKey(key, modifiers = {}) {
    if (modifiers.ctrlKey || modifiers.altKey || modifiers.metaKey) return false
    const point = keyToPoint(key)
    if (point !== null) {
      if (!currentDots.includes(point)) currentDots.push(point)
      currentDots.sort((a, b) => a - b)
      return true
    }
    if (key === '*') {
      if (confirmCell()) return true
      onSpeech?.('当前方还没有点位')
      return true
    }
    if (key === '/') {
      if (confirmedCells.length === 0) {
        onSpeech?.('当前已经是第一方')
        return true
      }
      currentDots = confirmedCells.pop()
      return true
    }
    if (key === '0') return commit()
    if (key === '3') {
      if (currentDots.length > 0) currentDots = []
      else if (confirmedCells.length > 0) currentDots = confirmedCells.pop()
      return true
    }
    if (key === '-') {
      clear()
      return true
    }
    return false
  }

  return { handleKey, snapshot, clear, commit, backspace: () => handleKey('3') }
}
