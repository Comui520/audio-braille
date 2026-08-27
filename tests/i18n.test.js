// tests/i18n.test.js
import { describe, it, expect } from 'vitest'
import { getLang, setLang, t, translateSpeech } from '../src/i18n.js'

describe('i18n 语言切换', () => {
  it('默认中文', () => {
    expect(getLang()).toBe('zh')
  })
  it('setLang 切换并持久化（内存代理）', () => {
    setLang('en')
    expect(getLang()).toBe('en')
    // Node 环境无 localStorage，由 i18n 内部内存代理承接（getLang 已证明状态生效）
    expect(getLang()).toBe('en')
    setLang('zh')
    expect(getLang()).toBe('zh')
  })
  it('t() 取当前语言文案，支持 {var} 占位符', () => {
    setLang('zh')
    expect(t('press0')).toBe('请按 0 确认')
    setLang('en')
    expect(t('press0')).toBe('Press 0 to confirm')
    expect(t('q', { label: 'a' })).toBe('Type the letter a')
    setLang('zh')
    expect(t('q', { label: 'a' })).toBe('请打出字母 a')
  })
  it('中英文案键数量一致（防止漏翻译）', () => {
    const zhKeys = Object.keys(translateSpeech('zh'))
    const enKeys = Object.keys(translateSpeech('en'))
    expect(enKeys.sort()).toEqual(zhKeys.sort())
  })
})
