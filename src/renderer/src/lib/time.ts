import type { Locale } from '../../../shared/types'

/** 相对时间（GitHub Desktop 的 "Last fetched N minutes ago" 风格）。 */
export function timeAgo(ts: number, locale: Locale): string {
  const zh = locale === 'zh-CN'
  const diff = Math.max(0, Date.now() - ts)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return zh ? '刚刚' : 'just now'
  if (minutes < 60) return zh ? `${minutes} 分钟前` : `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return zh ? `${hours} 小时前` : `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return zh ? `${days} 天前` : `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(ts).toLocaleDateString(zh ? 'zh-CN' : 'en-US')
}

/** 历史列表的短日期时间。 */
export function shortDateTime(ts: number, locale: Locale): string {
  return new Date(ts).toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
