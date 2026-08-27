// tests/curriculum.test.js —— v8 课程体系测试
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CURRICULUM, getProgress, markLearned, getNextItem, getSectionProgress, getCategoryProgress, resetProgress } from '../src/curriculum.js'

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString() },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} }
  }
})()
global.localStorage = localStorageMock

describe('curriculum', () => {
  beforeEach(() => {
    resetProgress()
  })

  it('定义四大类课程', () => {
    expect(Object.keys(CURRICULUM)).toEqual(['pinyin', 'latin', 'symbols', 'digits'])
    expect(CURRICULUM.pinyin.sections.length).toBe(3) // 声母/韵母/音节
    expect(CURRICULUM.latin.sections.length).toBe(3) // a-h/i-p/q-z
    expect(CURRICULUM.symbols.sections.length).toBe(2) // 中文/英文
    expect(CURRICULUM.digits.sections.length).toBe(1) // 0-9
  })

  it('声母表包含18个（j/q/x 与 g/k/h 同点位已排除）', () => {
    const initials = CURRICULUM.pinyin.sections.find(s => s.id === 'initials')
    expect(initials.items.length).toBe(18)
    expect(initials.items).not.toContain('j')
    expect(initials.items).not.toContain('q')
    expect(initials.items).not.toContain('x')
  })

  it('初始进度为空', () => {
    const prog = getSectionProgress('pinyin', 'initials')
    expect(prog.learned).toEqual([])
    expect(prog.current).toBeNull()
  })

  it('标记已学后自动设置下一个', () => {
    markLearned('latin', 'l1', 'a')
    const prog = getSectionProgress('latin', 'l1')
    expect(prog.learned).toEqual(['a'])
    expect(prog.current).toBe('b') // 自动指向下一个未学
  })

  it('连续标记多个', () => {
    markLearned('latin', 'l1', 'a')
    markLearned('latin', 'l1', 'b')
    markLearned('latin', 'l1', 'c')
    const prog = getSectionProgress('latin', 'l1')
    expect(prog.learned).toEqual(['a', 'b', 'c'])
    expect(prog.current).toBe('d')
  })

  it('getNextItem 返回下一个未学', () => {
    markLearned('pinyin', 'finals', 'a')
    const next = getNextItem('pinyin', 'finals')
    expect(next).toBe('o')
  })

  it('全部学完后 current 为 null', () => {
    const items = CURRICULUM.digits.sections[0].items
    items.forEach(item => markLearned('digits', 'd1', item))
    const prog = getSectionProgress('digits', 'd1')
    expect(prog.current).toBeNull()
  })

  it('计算分类总进度', () => {
    markLearned('latin', 'l1', 'a')
    markLearned('latin', 'l1', 'b')
    markLearned('latin', 'l2', 'i')
    const prog = getCategoryProgress('latin')
    expect(prog.learned).toBe(3)
    expect(prog.total).toBe(26)
  })

  it('进度持久化', () => {
    markLearned('pinyin', 'initials', 'b')
    const prog1 = getSectionProgress('pinyin', 'initials')
    expect(prog1.learned).toEqual(['b'])
    
    // 模拟重新加载（getProgress 从 localStorage 读）
    const all = getProgress()
    expect(all['pinyin.initials'].learned).toEqual(['b'])
  })
})
