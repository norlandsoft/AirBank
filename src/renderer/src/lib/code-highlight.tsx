import { useEffect, useState } from 'react'
import type { Highlighter } from 'shiki'
import { effectiveTheme, useApp } from '../store'

/** Shiki 懒加载单例（动态 import 走 vite 分包，不进首屏）。 */
let highlighterPromise: Promise<Highlighter> | null = null

const LANGS = [
  'typescript', 'tsx', 'javascript', 'jsx', 'json', 'python', 'rust', 'go', 'java',
  'c', 'cpp', 'css', 'html', 'bash', 'shell', 'yaml', 'markdown', 'sql', 'diff', 'toml', 'text',
]

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= import('shiki').then(({ createHighlighter }) =>
    createHighlighter({ themes: ['github-dark-default', 'github-light-default'], langs: LANGS }))
  return highlighterPromise
}

async function highlight(code: string, lang: string, dark: boolean): Promise<string> {
  const highlighter = await getHighlighter()
  const theme = dark ? 'github-dark-default' : 'github-light-default'
  try {
    return highlighter.codeToHtml(code, { lang, theme })
  } catch {
    return highlighter.codeToHtml(code, { lang: 'text', theme })
  }
}

/** 文件名 → Shiki 语言 id（长尾回 text）。 */
export function langForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'tsx',
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx',
    json: 'json', jsonc: 'json', py: 'python', rs: 'rust', go: 'go',
    java: 'java', c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cc: 'cpp',
    css: 'css', html: 'html', htm: 'html', sh: 'bash', bash: 'bash', zsh: 'bash',
    yml: 'yaml', yaml: 'yaml', md: 'markdown', markdown: 'markdown',
    sql: 'sql', diff: 'diff', patch: 'diff', toml: 'toml', ini: 'ini', txt: 'text',
  }
  return map[ext] ?? 'text'
}

/** 语法高亮代码块（Shiki，暗/亮双主题，懒加载）。 */
export function CodeBlock({ code, lang, maxHeight }: { code: string; lang?: string; maxHeight?: number }) {
  const dark = useApp((state) => effectiveTheme(state.settings, state.nativeDark) === 'dark')
  const [html, setHtml] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void highlight(code, lang ?? 'text', dark).then((out) => { if (alive) setHtml(out) }).catch(() => undefined)
    return () => { alive = false }
  }, [code, lang, dark])
  if (!html) return <pre className="codeblock"><code>{code}</code></pre>
  // Shiki 输出可信（本地生成）
  return (
    <div className="codeblock shiki-block" style={maxHeight ? { maxHeight, overflow: 'auto' } : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
