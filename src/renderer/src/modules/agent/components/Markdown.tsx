import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Highlighter } from 'shiki'
import { effectiveTheme, useApp } from '../../../store'

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

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const dark = useApp((state) => effectiveTheme(state.settings, state.nativeDark) === 'dark')
  const [html, setHtml] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void highlight(code, lang, dark).then((out) => { if (alive) setHtml(out) }).catch(() => undefined)
    return () => { alive = false }
  }, [code, lang, dark])
  if (!html) return <pre className="codeblock"><code>{code}</code></pre>
  // Shiki 输出可信（本地生成，无用户 HTML 注入面）
  return <div className="codeblock shiki-block" dangerouslySetInnerHTML={{ __html: html }} />
}

/** 会话消息 Markdown 渲染（GFM + Shiki 代码块）。 */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children }) {
            const match = /language-([\w-]+)/.exec(className ?? '')
            const code = String(children ?? '').replace(/\n$/, '')
            if (!match) return <code className="inline-code">{code}</code>
            return <CodeBlock lang={match[1]} code={code} />
          },
          a({ href, children }) {
            return <a href={href} target="_blank" rel="noreferrer">{children}</a>
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
