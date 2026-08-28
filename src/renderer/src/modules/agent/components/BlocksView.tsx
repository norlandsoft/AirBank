import type { AssistantBlock } from '../model'
import { Markdown } from './Markdown'

/** 助手块渲染：text→Markdown；思考不保留（只在流式活动行原位显示，定稿即弃）；tool-call 由工具卡呈现。 */
export function BlocksView({ blocks }: { blocks: AssistantBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'text':
            return block.text.trim().length > 0 ? <Markdown key={index} text={block.text} /> : null
          case 'image':
            return <div key={index} className="text-dim text-xs">[图片]</div>
          case 'reasoning':
          case 'tool-call':
          case 'other':
          default:
            return null
        }
      })}
    </>
  )
}

/** 进行中 partial 文本：仅流式文本（思考/工具由活动槽统一呈现）。 */
export function PartialBlocks({ blocks }: { blocks: AssistantBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === 'text' && block.text.trim().length > 0) return <Markdown key={index} text={block.text} />
        return null
      })}
    </>
  )
}
