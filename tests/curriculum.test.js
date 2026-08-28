import { describe, it, expect } from 'vitest'
import { CURRICULUM, createProgressStore } from '../src/curriculum.js'

function fakeStorage() {
  let record = { version: 2, sections: {} }
  return {
    async loadProgress() { return record },
    async saveProgress(next) { record = next; return next }
  }
}

describe('v9 curriculum and progress', () => {
  it('定义四大课程区域', () => {
    expect(Object.keys(CURRICULUM)).toEqual(['pinyin', 'latin', 'symbols', 'digits'])
    expect(CURRICULUM.pinyin.sections.map(section => section.id)).toEqual(['initials', 'finals', 'syllables'])
    expect(CURRICULUM.pinyin.sections[0].items).toContain('zh')
    expect(CURRICULUM.pinyin.sections[1].items.length).toBeGreaterThan(20)
  })

  it('进度服务默认返回空小节', async () => {
    const store = createProgressStore(fakeStorage())
    await expect(store.getSection('latin', 'l1')).resolves.toEqual({ learned: [], current: null })
  })

  it('标记后自动指向下一个未学项', async () => {
    const store = createProgressStore(fakeStorage())
    await store.markLearned('latin', 'l1', 'a')
    await expect(store.getSection('latin', 'l1')).resolves.toEqual({ learned: ['a'], current: 'b' })
  })

  it('手动跳转不覆盖已学项', async () => {
    const store = createProgressStore(fakeStorage())
    await store.markLearned('latin', 'l1', 'a')
    await store.setCurrent('latin', 'l1', 'f')
    await expect(store.getSection('latin', 'l1')).resolves.toEqual({ learned: ['a'], current: 'f' })
  })

  it('计算分类总进度', async () => {
    const store = createProgressStore(fakeStorage())
    await store.markLearned('latin', 'l1', 'a')
    await store.markLearned('latin', 'l2', 'i')
    await expect(store.getCategory('latin')).resolves.toEqual({ learned: 2, total: 26 })
  })

  it('reset 清空所有小节', async () => {
    const store = createProgressStore(fakeStorage())
    await store.markLearned('digits', 'd1', '1')
    await store.reset()
    await expect(store.getSection('digits', 'd1')).resolves.toEqual({ learned: [], current: null })
  })
})
