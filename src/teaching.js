// src/teaching.js

// —— 间隔重复错题本（纯逻辑，可测）——
// 规则：错误≥2 加入；每 5 题插 1 错题；连续正确 3 次移出。
export function createReviewer() {
  const map = new Map()   // key → { errors, streak }

  function entry(key) {
    if (!map.has(key)) map.set(key, { errors: 0, streak: 0 })
    return map.get(key)
  }

  return {
    record(key, correct) {
      const e = entry(key)
      if (correct) { e.streak += 1; if (e.streak >= 3 && e.errors >= 2) map.delete(key) }
      else { e.errors += 1; e.streak = 0 }
    },
    isInReview(key) {
      const e = map.get(key)
      return !!e && e.errors >= 2 && e.streak < 3
    },
    reviewQueue() { return [...map.keys()].filter(k => this.isInReview(k)) },
    toJSON() { return Object.fromEntries(map) },
    fromJSON(data) { for (const [k, v] of Object.entries(data)) map.set(k, v) }
  }
}

// —— 考试出题（纯逻辑）——
// 每 5 题（index%5===4）强制插入错题本中的题目
export function pickExamQuestion({ index, reviewQueue }) {
  if (index % 5 === 4 && reviewQueue.length > 0) {
    return reviewQueue[index % reviewQueue.length]
  }
  return null   // 返回 null 表示从常规题库随机出题（UI 层处理）
}

// —— 评分（点位数组无序比较）——
export function gradeAnswer(expected, given) {
  if (expected.length !== given.length) return false
  const s = (a) => [...a].sort((x, y) => x - y).join(',')
  return s(expected) === s(given)
}

// —— 教学 UI（探索/考试，键盘驱动）——
// 由 app.js 调用；依赖 state/render/speak/playAudioBraille
// 探索模式：中央显示字符，用户按点位键探索，按 0 核对
// 考试模式：TTS 出题，用户输入提交，记录正确率（经 storage 存进度）
export function initTeaching({ state, render, storage }) {
  const reviewer = createReviewer()
  return {
    reviewer,
    view() {
      // 返回教学视图容器（探索/考试入口按钮 + 出题区）；后续步骤填充 DOM
      const sec = document.createElement('section')
      sec.innerHTML = '<h1>教学</h1><button data-mode="explore">探索模式</button><button data-mode="exam">考试模式</button><div id="lesson"></div>'
      return sec
    }
  }
}
