import type { ReactNode } from 'react'

/** 面板通用头部：标题 + 描述 + 右侧操作区。 */
export function PanelHeader({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b bordered">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {desc && <p className="text-dim text-xs mt-1 max-w-[560px] leading-relaxed">{desc}</p>}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  )
}
