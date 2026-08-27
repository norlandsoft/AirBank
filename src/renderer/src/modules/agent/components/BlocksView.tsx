import type { AssistantBlock } from '../model'
import { Markdown } from './Markdown'

/** 助手块渲染：text→Markdown；reasoning→折叠暗色；tool-call 不渲染（由 ToolCard 呈现，避免重复）。 */
export function BlocksView({ blocks }: { blocks: AssistantBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'text':
            return block.text.trim().length > 0 ? <Markdown key={index} text={block.text} /> : null
          case 'reasoning':
            return block.text.trim().length > 0 ? (
              <details key={index} className="reasoning-block">
                <summary>思考过程</summary>
                <div className="reasoning-body">{block.text}</div>
              </details>
            ) : null
          case 'image':
            return <div key={index} className="text-dim text-xs">[图片]</div>
          case 'tool-call':
          case 'other':
          default:
            return null
        }
      })}
    </>
  )
}
