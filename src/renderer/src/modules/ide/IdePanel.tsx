import { useEffect } from 'react'
import { useIde } from './store'
import { useT } from '../../hooks'
import { FileTree } from './FileTree'
import { EditorView } from './EditorView'
import { IconFolder } from '../../icons'

/** IDE 面板：未设 root → 引导选择；否则 文件树 + 编辑器。 */
export function IdePanel() {
  const t = useT()
  const root = useIde((state) => state.root)
  const error = useIde((state) => state.error)
  const init = useIde((state) => state.init)
  const pickRoot = useIde((state) => state.pickRoot)

  useEffect(() => { void init() }, [init])

  if (!root) {
    return (
      <div className="flex-1 surface flex flex-col items-center justify-center gap-3">
        <IconFolder size={28} />
        <div className="text-base">{t('idePickRootTitle')}</div>
        <div className="text-dim text-xs">{t('idePickRootDesc')}</div>
        <button className="btn btn-primary" onClick={() => void pickRoot()}>{t('idePickRoot')}</button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex min-h-0">
      <FileTree />
      <div className="flex-1 flex flex-col min-w-0">
        {error && <div className="conn-banner conn-banner-error">{error}</div>}
        <EditorView />
      </div>
    </div>
  )
}
