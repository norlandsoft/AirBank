import { useDeferredValue, useEffect, useRef } from 'react'
import { MergeView } from '@codemirror/merge'
import { EditorState } from '@codemirror/state'
import { EditorView as CmEditorView } from '@codemirror/view'
import { useIde } from './store'
import { effectiveTheme, useApp } from '../../store'
import { editorTheme } from './editor-setup'
import { lineNumbers, highlightActiveLine } from '@codemirror/view'

/** Diff 审阅（@codemirror/merge）：左 = 磁盘版本（只读），右 = 当前编辑（可改，回写 store）。 */
export function DiffView({ rel }: { rel: string }) {
  const file = useIde((state) => state.openFiles.find((f) => f.rel === rel))
  const markDirty = useIde((state) => state.markDirty)
  const dark = useApp((state) => effectiveTheme(state.settings, state.nativeDark) === 'dark')
  const hostRef = useRef<HTMLDivElement | null>(null)
  const deferred = useDeferredValue(file?.content ?? '')

  useEffect(() => {
    if (!hostRef.current || !file) return
    const theme = editorTheme(dark)
    const merge = new MergeView({
      a: {
        doc: file.savedContent,
        extensions: [lineNumbers(), theme, EditorState.readOnly.of(true), CmEditorView.editable.of(false)],
      },
      b: {
        doc: deferred,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          theme,
          CmEditorView.updateListener.of((update) => {
            if (update.docChanged) markDirty(rel, update.state.doc.toString())
          }),
        ],
      },
      parent: hostRef.current,
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 4 },
      revertControls: 'b-to-a',
    })
    return () => merge.destroy()
  }, [rel, deferred, file?.savedContent, dark, file, markDirty])

  if (!file) return null
  return (
    <div className="diff-wrap">
      <div className="diff-labels">
        <span className="diff-label">磁盘（已保存）</span>
        <span className="diff-label">当前编辑</span>
      </div>
      <div ref={hostRef} className="diff-host" />
    </div>
  )
}
