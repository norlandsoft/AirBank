import type { EditorView as CmEditorView } from '@codemirror/view'

/** 活动编辑器注册表：保存/外部变更时同步文档内容（避免重建视图）。 */
const views = new Map<string, CmEditorView>()

export function registerEditor(rel: string, view: CmEditorView): void {
  views.set(rel, view)
}

export function unregisterEditor(rel: string, view: CmEditorView): void {
  if (views.get(rel) === view) views.delete(rel)
}

/** 全量替换编辑器文档（单次 dispatch，撤销历史一步）。 */
export function replaceEditorDoc(rel: string, text: string): void {
  const view = views.get(rel)
  if (!view) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
}
