import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from '../../../lib/code-highlight'

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
            return <CodeBlock code={code} lang={match[1]} />
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
