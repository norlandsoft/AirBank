import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAgent } from '../store'
import { useT } from '../../../hooks'
import type { TimelineItem } from '../model'
import { BlocksView, PartialBlocks } from './BlocksView'
import { FileToolCard, ActivityLine } from './ToolCard'
import { ImageBlock } from './ImageBlock'
import { IconLogo } from '../../../icons'

/** 用户消息内容渲染（text 段 + image 附件块）。 */
function UserContent({ content }: { content: unknown[] }) {
  return (
    <>
      {content.map((block, index) => {
        if (typeof block !== 'object' || block === null) return null
        const b = block as { type?: string; text?: string; attachment?: { attachmentId: string; mediaType?: string } }
        if (b.type === 'text' && b.text) return <div key={index} className="msg-user-text">{b.text}</div>
        if (b.type === 'image' && b.attachment) return <ImageBlock key={index} attachment={b.attachment} />
        return null
      })}
    </>
  )
}

function Item({ item, running }: { item: TimelineItem; running: boolean }) {
  switch (item.kind) {
    case 'user':
      return (
        <div className="msg-row msg-row-user">
          <div className="msg-bubble msg-user"><UserContent content={item.content} /></div>
        </div>
      )
    case 'assistant': {
      // 无可见内容的行整体跳过（纯思考定稿消息不产生空行）
      const visible = item.blocks.some((b) => b.kind === 'text' && b.text.trim().length > 0)
      if (!visible && !item.interrupted) return null
      return (
        <div className="msg-row">
          <div className="msg-assistant">
            <BlocksView blocks={item.blocks} />
            {item.interrupted && <div className="text-dim text-xs">（已中断）</div>}
          </div>
        </div>
      )
    }
    case 'tool':
      return (
        <div className="msg-row">
          <FileToolCard item={item} running={running} />
        </div>
      )
    case 'notice':
      return <div className="msg-notice">{item.text}</div>
    default:
      return null
  }
}

/** 虚拟列表渲染单元（tool-status 并入活动槽，不进虚拟列表）。 */
type Row = { kind: 'item'; item: TimelineItem }

/** 会话时间线：react-virtual 虚拟化 + 近底跟随。 */
export function Timeline() {
  const t = useT()
  const activeSessionId = useAgent((state) => state.activeSessionId)
  const slice = useAgent((state) => (state.activeSessionId ? state.slices[state.activeSessionId] : undefined))
  const loadOlder = useAgent((state) => state.loadOlder)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const stickToBottom = useRef(true)

  const rows: Row[] = []
  if (slice) {
    for (const item of slice.items) {
      if (item.kind === 'tool-status') continue // 并入活动槽
      rows.push({ kind: 'item', item })
    }
  }

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 72,
    overscan: 8,
    getItemKey: (index) => rows[index].item.id,
  })

  const toolStatus = slice?.items.find((i) => i.kind === 'tool-status') as Extract<TimelineItem, { kind: 'tool-status' }> | undefined
  const reasoningText = slice?.partial
    ? slice.partial.blocks.filter((b) => b.kind === 'reasoning').map((b) => (b as { text: string }).text).join(' ').trim()
    : ''

  const version = slice?.version ?? 0
  useEffect(() => {
    const el = containerRef.current
    if (el && stickToBottom.current && rows.length > 0) {
      virtualizer.scrollToIndex(rows.length - 1, { align: 'end' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, activeSessionId, rows.length])

  const onScroll = (): void => {
    const el = containerRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  if (!slice) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-dim">
        <IconLogo size={44} />
        <div className="text-base">{t('agentEmptyTitle')}</div>
        <div className="text-xs">{t('agentEmptyDesc')}</div>
      </div>
    )
  }

  return (
    <div ref={containerRef} onScroll={onScroll} className="timeline">
      {slice.hasMoreHistory && (
        <button className="btn btn-ghost timeline-older" onClick={() => void loadOlder()}>
          {t('agentLoadOlder')}
        </button>
      )}
      {slice.items.length === 0 && !slice.partial ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-dim py-16">
          <IconLogo size={44} />
          <div className="text-base">{t('agentEmptyTitle')}</div>
          <div className="text-xs">{t('agentEmptyDesc')}</div>
        </div>
      ) : (
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const row = rows[vRow.index]
            return (
              <div
                key={vRow.key}
                data-index={vRow.index}
                ref={virtualizer.measureElement}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}
              >
                <Item item={row.item} running={slice.running} />
              </div>
            )
          })}
        </div>
      )}
      {/* 活动槽：思考与工具同一行，新轨迹原位替换 */}
      {(toolStatus || reasoningText) && (
        <div className="msg-row">
          <ActivityLine item={toolStatus} reasoning={toolStatus ? undefined : reasoningText} />
        </div>
      )}
      {/* 流式文本 partial */}
      {slice.partial && slice.partial.blocks.some((b) => b.kind === 'text' && b.text.trim().length > 0) && (
        <div className="msg-row">
          <div className="msg-assistant msg-partial">
            <PartialBlocks blocks={slice.partial.blocks} />
            <span className="partial-cursor" />
          </div>
        </div>
      )}
    </div>
  )
}
