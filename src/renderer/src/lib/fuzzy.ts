/**
 * 轻量模糊匹配（fzf-for-js 在 registry 不可用后的内置替代，设计文档 §4.1 偏差备注）。
 * 子序列打分：连续匹配与前缀/词边界命中加权，分数低者胜（未命中返回 null）。
 */
export function fuzzyScore(query: string, candidate: string): number | null {
  if (query.length === 0) return 0
  const q = query.toLowerCase()
  const c = candidate.toLowerCase()
  let score = 0
  let qi = 0
  let lastHit = -2
  for (let ci = 0; ci < c.length && qi < q.length; ci += 1) {
    if (c[ci] !== q[qi]) continue
    score += ci - 1 === lastHit ? 0 : 6 // 连续命中加分（减分）
    if (ci === 0 || c[ci - 1] === '/' || c[ci - 1] === '.' || c[ci - 1] === '-' || c[ci - 1] === '_') score -= 4 // 词边界
    lastHit = ci
    qi += 1
  }
  if (qi < q.length) return null
  return score + c.length * 0.01 // 短候选优先
}

export interface FuzzyItem<T> {
  item: T
  score: number
}

/** 过滤 + 排序：按 score 升序取前 limit 个。 */
export function fuzzyFilter<T>(query: string, candidates: T[], text: (item: T) => string, limit = 50): T[] {
  if (query.trim().length === 0) return candidates.slice(0, limit)
  const hits: FuzzyItem<T>[] = []
  for (const item of candidates) {
    const score = fuzzyScore(query, text(item))
    if (score !== null) hits.push({ item, score })
  }
  hits.sort((a, b) => a.score - b.score)
  return hits.slice(0, limit).map((hit) => hit.item)
}
