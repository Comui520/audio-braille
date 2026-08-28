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

export function createInputController({ onCommit = null, onSpeech = null, onBackspace = null, onChange = null, mode = 'buffer', initialCells = [], initialCursor = 0, initialDocumentCells = [], initialDocumentCursor = 0 } = {}) {
  const documentMode = mode === 'document'
  const cloneAtom = atom => Array.isArray(atom)
    ? atom.map(value => Array.isArray(value) ? [...value] : value)
    : (atom && typeof atom === 'object' ? { ...atom } : atom)
  const cloneCells = cells => (Array.isArray(cells) ? cells : []).map(cloneAtom)

  let compositionCells = documentMode ? [] : cloneCells(initialCells)
  let compositionCursor = documentMode ? 0 : Math.max(0, Math.min(Number(initialCursor) || 0, compositionCells.length))
  let documentCells = documentMode ? cloneCells(initialDocumentCells) : []
  let documentCursor = documentMode ? Math.max(0, Math.min(Number(initialDocumentCursor) || 0, documentCells.length)) : 0
  let currentDots = []

  function snapshot() {
    if (documentMode) {
      return {
        confirmedCells: cloneCells(compositionCells),
        currentDots: [...currentDots],
        cursorIndex: compositionCursor,
        compositionCells: cloneCells(compositionCells),
        compositionCursor,
        documentCells: cloneCells(documentCells),
        documentCursor
      }
    }
    return {
      confirmedCells: cloneCells(compositionCells),
      currentDots: [...currentDots],
      cursorIndex: compositionCursor
    }
  }

  function notifyChange() {
    if (documentMode) onChange?.(snapshot())
  }

  function resetComposition() {
    compositionCells = []
    compositionCursor = 0
    currentDots = []
  }

  function clear() {
    if (documentMode) {
      documentCells = []
      documentCursor = 0
      resetComposition()
      notifyChange()
      return
    }
    compositionCells = []
    currentDots = []
    compositionCursor = 0
  }

  function cancelComposition() {
    if (!documentMode) return false
    resetComposition()
    notifyChange()
    return true
  }

  function moveCompositionRight() {
    compositionCursor = Math.min(compositionCursor + 1, compositionCells.length)
    notifyChange()
  }

  function moveCompositionLeft() {
    compositionCursor = Math.max(compositionCursor - 1, 0)
    notifyChange()
  }

  function moveDocumentRight() {
    documentCursor = Math.min(documentCursor + 1, documentCells.length)
    notifyChange()
  }

  function moveDocumentLeft() {
    documentCursor = Math.max(documentCursor - 1, 0)
    notifyChange()
  }

  function confirmCompositionCell() {
    const cell = [...currentDots]
    if (compositionCursor < compositionCells.length) compositionCells[compositionCursor] = cell
    else compositionCells.push(cell)
    compositionCursor += 1
    currentDots = []
    notifyChange()
    return true
  }

  function confirmCell() {
    if (currentDots.length > 0) return confirmCompositionCell()
    if (documentMode && compositionCells.length === 0) {
      moveDocumentRight()
      return true
    }
    if (compositionCells.length > 0) {
      moveCompositionRight()
      return true
    }
    moveCompositionRight()
    return true
  }

  function commit() {
    if (documentMode) {
      if (currentDots.length > 0) confirmCompositionCell()
      if (compositionCells.length === 0) return true
      documentCells.splice(documentCursor, 0, cloneCells(compositionCells))
      documentCursor += 1
      resetComposition()
      notifyChange()
      return true
    }
    const cells = cloneCells(compositionCells)
    if (currentDots.length > 0) {
      if (compositionCursor < cells.length) cells[compositionCursor] = [...currentDots]
      else cells.push([...currentDots])
    }
    clear()
    onCommit?.(cells)
    return true
  }

  function deleteBackward() {
    if (currentDots.length > 0) {
      currentDots = []
      notifyChange()
      return true
    }
    if (documentMode) {
      if (compositionCells.length > 0 && compositionCursor > 0) {
        compositionCells.splice(compositionCursor - 1, 1)
        compositionCursor -= 1
        notifyChange()
        return true
      }
      if (documentCursor > 0) {
        documentCells.splice(documentCursor - 1, 1)
        documentCursor -= 1
        notifyChange()
      }
      return true
    }
    if (compositionCursor > 0 && compositionCells.length > 0) {
      compositionCells.splice(compositionCursor - 1, 1)
      compositionCursor -= 1
    } else if (compositionCells.length > 0) {
      compositionCells.pop()
      compositionCursor = compositionCells.length
    } else {
      onBackspace?.()
    }
    return true
  }

  function insertSpace() {
    if (!documentMode) return false
    if (compositionCells.length > 0 || currentDots.length > 0) commit()
    documentCells.splice(documentCursor, 0, null)
    documentCursor += 1
    notifyChange()
    return true
  }

  function handleKey(key, modifiers = {}) {
    if (modifiers.ctrlKey || modifiers.altKey || modifiers.metaKey) return false
    const point = keyToPoint(key)
    if (point !== null) {
      if (!currentDots.includes(point)) currentDots.push(point)
      currentDots.sort((a, b) => a - b)
      notifyChange()
      return true
    }
    if (key === '*') {
      if (currentDots.length > 0 || compositionCells.length > 0) return confirmCell()
      if (documentMode) { moveDocumentRight(); return true }
      return confirmCell()
    }
    if (key === '/') {
      if (currentDots.length > 0) {
        currentDots = []
        notifyChange()
      } else if (documentMode && compositionCells.length === 0) moveDocumentLeft()
      else moveCompositionLeft()
      return true
    }
    if (key === '0') return commit()
    if (key === '3') return deleteBackward()
    if (key === '.') return insertSpace()
    if (key === '-') {
      clear()
      return true
    }
    return false
  }

  function setDocument(cells = [], cursor = cells.length) {
    if (!documentMode) return false
    documentCells = cloneCells(cells)
    documentCursor = Math.max(0, Math.min(Number(cursor) || 0, documentCells.length))
    resetComposition()
    notifyChange()
    return true
  }

  return { handleKey, snapshot, clear, cancelComposition, setDocument, commit, backspace: () => handleKey('3') }
}
