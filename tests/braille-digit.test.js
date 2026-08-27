// tests/braille-digit.test.js
import { describe, it, expect } from 'vitest'
import { DIGIT_SIGN, digitToUnicode, digitsToUnicode, unicodeToDigits } from '../src/braille-engine.js'

// 盲文数字（国际标准）：数字符号(点3456=U+283C) + a-j 对应 1-0
// 点位掩码：点d = 1<<(d-1)；a=点1=0x01, c=点14=0x09, e=点15=0x11, j=点245=0x1A
describe('盲文数字（国际标准：数字符号 + a-j）', () => {
  it('数字符号 = 点3456', () => {
    expect(DIGIT_SIGN).toEqual([3, 4, 5, 6])
  })
  it('digitToUnicode：1 = 数字符号(U+283C) + a(点1,U+2801)，两方', () => {
    expect(digitToUnicode('1')).toBe('\u283c\u2801')
  })
  it('digitsToUnicode：123 → 每位数 = 数字符号+字母方', () => {
    // 1=a=点1(0x01→U+2801)，2=b=点12(0x03→U+2803)，3=c=点14(0x09→U+2809)
    expect(digitsToUnicode('123')).toBe('\u283c\u2801\u283c\u2803\u283c\u2809')
  })
  it('unicodeToDigits：数字文本 → 数字串', () => {
    // 3=c=点14(0x09→U+2809)，4=d=点145(0x19→U+2819)，5=e=点15(0x11→U+2811)
    expect(unicodeToDigits('\u283c\u2809\u283c\u2819\u283c\u2811')).toBe('345')
  })
  it('unicodeToDigits：纯字母文本返回 null（无数字符号前缀）', () => {
    expect(unicodeToDigits('\u2801')).toBeNull()
  })
  it('a-j 对应 1-0（0=j=点245=U+281A）', () => {
    expect(unicodeToDigits('\u283c\u2801')).toBe('1')        // a=1
    expect(unicodeToDigits('\u283c\u2811')).toBe('5')        // e=5
    expect(unicodeToDigits('\u283c\u2811\u283c\u281a')).toBe('50') // j=0
  })
})
