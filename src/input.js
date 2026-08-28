// src/input.js —— v9：可编辑逐方输入控制器
import { dotsToComponent, dotsToLatin, applyVariation, syllableToDots } from './braille-engine.js'

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
export function cellLabel(stage) { return { initial: '声母', final: '韵母', tone: '声调' }[stage] || '提交' }
export function nextStageAfterConfirm(stage, withTone) {
  if (stage === 'initial') return 'final'
  if (stage === 'final') return withTone ? 'tone' : 'commit'
  return 'commit'
}

export function dotsToReadable(dots) {
  return dotsToLatin(dots) || dotsToComponent(dots)?.value || null
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

export function createInputController({ onCommit = null, onSpeech = null, onBackspace = null } = {}) {
  let confirmedCells = []
  let currentDots = []
  let cursorIndex = 0

  function snapshot() {
    return {
      confirmedCells: confirmedCells.map(cell => [...cell]),
      currentDots: [...currentDots],
      cursorIndex
    }
  }

  function clear() {
    confirmedCells = []
    currentDots = []
    cursorIndex = 0
  }

  function moveRight() {
    cursorIndex = Math.min(cursorIndex + 1, confirmedCells.length)
  }

  function moveLeft() {
    cursorIndex = Math.max(cursorIndex - 1, 0)
  }

  function confirmCell() {
    if (currentDots.length === 0) {
      moveRight()
      return true
    }
    const cell = [...currentDots]
    if (cursorIndex < confirmedCells.length) confirmedCells[cursorIndex] = cell
    else confirmedCells.push(cell)
    cursorIndex += 1
    currentDots = []
    return true
  }

  function commit() {
    const cells = confirmedCells.map(cell => [...cell])
    if (currentDots.length > 0) {
      if (cursorIndex < cells.length) cells[cursorIndex] = [...currentDots]
      else cells.push([...currentDots])
    }
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
    if (key === '*') return confirmCell()
    if (key === '/') {
      if (currentDots.length > 0) currentDots = []
      else moveLeft()
      return true
    }
    if (key === '0') return commit()
    if (key === '3') {
      if (currentDots.length > 0) currentDots = []
      else if (cursorIndex > 0 && confirmedCells.length > 0) {
        confirmedCells.splice(cursorIndex - 1, 1)
        cursorIndex -= 1
      } else if (confirmedCells.length > 0) {
        confirmedCells.pop()
        cursorIndex = confirmedCells.length
      } else {
        onBackspace?.()
      }
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
