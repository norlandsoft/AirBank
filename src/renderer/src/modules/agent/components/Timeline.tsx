import { useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAgent } from '../store'
import { useT } from '../../../hooks'
import type { TimelineItem } from '../model'
import { BlocksView } from './BlocksView'
import { FileToolCard, ToolStatusLine } from './ToolCard'
import { ImageBlock } from './ImageBlock'

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
    case 'assistant':
      return (
        <div className="msg-row">
          <div className="msg-assistant">
            <BlocksView blocks={item.blocks} />
            {item.interrupted && <div className="text-dim text-xs">（已中断）</div>}
          </div>
        </div>
      )
    case 'tool':
      return (
        <div className="msg-row">
          <FileToolCard item={item} running={running} />
        </div>
      )
    case 'tool-status':
      return (
        <div className="msg-row">
          <ToolStatusLine item={item} />
        </div>
      )
    case 'notice':
      return <div className="msg-notice">{item.text}</div>
    default:
      return null
  }
}

/** 渲染单元：时间线条目或进行中 partial（统一进虚拟列表）。 */
type Row =
  | { kind: 'item'; item: TimelineItem }
  | { kind: 'partial' }

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
    for (const item of slice.items) rows.push({ kind: 'item', item })
    if (slice.partial && slice.partial.blocks.length > 0) rows.push({ kind: 'partial' })
  }

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 72,
    overscan: 8,
    getItemKey: (index) => {
      const row = rows[index]
      return row.kind === 'item' ? row.item.id : 'partial'
    },
  })

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
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-dim">
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
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-dim py-16">
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
                {row.kind === 'item'
                  ? <Item item={row.item} running={slice.running} />
                  : (
                    <div className="msg-row">
                      <div className="msg-assistant msg-partial">
                        <BlocksView blocks={slice.partial?.blocks ?? []} />
                        <span className="partial-cursor" />
                      </div>
                    </div>
                  )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
