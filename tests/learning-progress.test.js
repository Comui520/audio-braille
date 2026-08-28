import { describe, it, expect, beforeEach } from 'vitest'
import { CURRICULUM, createProgressStore } from '../src/curriculum.js'

function fakeStorage() {
  let record = {}
  return {
    async loadProgress() { return record },
    async saveProgress(next) { record = next; return next },
    read() { return record }
  }
}

describe('v9 learning progress service', () => {
  let backing
  let progress

  beforeEach(() => {
    backing = fakeStorage()
    progress = createProgressStore(backing)
  })

  it('课程数据只有四个大区域', () => {
    expect(Object.keys(CURRICULUM)).toEqual(['pinyin', 'latin', 'symbols', 'digits'])
  })

  it('可以读取空小节进度', async () => {
    await expect(progress.getSection('latin', 'l1')).resolves.toEqual({ learned: [], current: null })
  })

  it('标记项目后保存并指向下一个未学项目', async () => {
    await progress.markLearned('latin', 'l1', 'a')
    await expect(progress.getSection('latin', 'l1')).resolves.toEqual({ learned: ['a'], current: 'b' })
    expect(backing.read().version).toBe(2)
  })

  it('手动选择项目不会覆盖已学列表', async () => {
    await progress.markLearned('latin', 'l1', 'a')
    await progress.setCurrent('latin', 'l1', 'f')
    await expect(progress.getSection('latin', 'l1')).resolves.toEqual({ learned: ['a'], current: 'f' })
  })

  it('计算分类进度', async () => {
    await progress.markLearned('latin', 'l1', 'a')
    await progress.markLearned('latin', 'l2', 'i')
    await expect(progress.getCategory('latin')).resolves.toEqual({ learned: 2, total: 26 })
  })
})
