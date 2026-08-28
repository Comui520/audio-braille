// src/ui-contract.js —— v9：视觉令牌与导航状态纯函数
export const UI_TOKENS = {
  page: '#f6f7f9',
  surface: '#ffffff',
  surfaceMuted: '#f0f2f5',
  text: '#20242a',
  textMuted: '#5f6875',
  line: '#d9dee6',
  brand: '#2457c5',
  brandHover: '#19469f',
  success: '#177245',
  danger: '#b42318',
  focus: '#173f8a'
}

export function navClassFor(page, currentPage) {
  return `top-link${page === currentPage ? ' is-active' : ''}`
}
