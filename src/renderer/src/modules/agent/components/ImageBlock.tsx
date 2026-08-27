import { useEffect, useState } from 'react'
import { useAgent } from '../store'

/** 附件 dataURL 缓存（attachmentId → data:…）。 */
const imageCache = new Map<string, string>()

interface AttachmentRef {
  attachmentId: string
  mediaType?: string
}

/** 会话内图片块：经 session.attachment 拉取 base64 渲染（懒加载 + 缓存）。 */
export function ImageBlock({ attachment }: { attachment: AttachmentRef }) {
  const activeSessionId = useAgent((state) => state.activeSessionId)
  const [url, setUrl] = useState<string | null>(imageCache.get(attachment.attachmentId) ?? null)

  useEffect(() => {
    if (url || !activeSessionId) return
    let alive = true
    void useAgent.getState().client
      .sessionAttachment(activeSessionId, attachment.attachmentId)
      .then((result) => {
        const dataUrl = `data:${attachment.mediaType ?? 'image/png'};base64,${result.data}`
        imageCache.set(attachment.attachmentId, dataUrl)
        if (alive) setUrl(dataUrl)
      })
      .catch(() => undefined)
    return () => { alive = false }
  }, [activeSessionId, attachment.attachmentId, attachment.mediaType, url])

  if (!url) return <div className="text-dim text-xs">[图片加载中…]</div>
  return <img className="msg-image" src={url} alt="attachment" />
}
