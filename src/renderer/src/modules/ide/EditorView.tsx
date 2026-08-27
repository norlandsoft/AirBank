import { useEffect, useRef } from 'react'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView as CmEditorView, keymap } from '@codemirror/view'
import { useIde } from './store'
import { useT } from '../../hooks'
import { effectiveTheme, useApp } from '../../store'
import { baseExtensions, detectLanguage, editorTheme, languageCompartment } from './editor-setup'
import { registerEditor, unregisterEditor } from './editor-registry'
import { lspSupport, organizeImports } from './lsp'
import { DiffView } from './DiffView'
import { IconX } from '../../icons'

/** CM6 封装：按活动文件重建（简单可靠），语言异步加载后隔间重配置。 */
function Editor({ rel, content, readonly }: { rel: string; content: string; readonly: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<CmEditorView | null>(null)
  const markDirty = useIde((state) => state.markDirty)
  const root = useIde((state) => state.root)
  const dark = useApp((state) => effectiveTheme(state.settings, state.nativeDark) === 'dark')

  useEffect(() => {
    if (!hostRef.current) return
    const lsp = readonly ? null : lspSupport(root, rel)
    const view = new CmEditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: content,
        extensions: [
          ...baseExtensions(),
          editorTheme(dark),
          EditorState.readOnly.of(readonly),
          CmEditorView.editable.of(!readonly),
          ...(lsp ? [lsp] : []),
          Prec.high(keymap.of([
            { key: 'Mod-s', run: () => { void useIde.getState().saveActive(); return true } },
            {
              key: 'Mod-Shift-o',
              run: (v) => {
                if (!root) return false
                void organizeImports(root, rel, v)
                return true
              },
            },
          ])),
          CmEditorView.updateListener.of((update) => {
            if (update.docChanged) markDirty(rel, update.state.doc.toString())
          }),
        ],
      }),
    })
    viewRef.current = view
    registerEditor(rel, view)
    // 语言异步加载（language-data legacy modes 按需拉取）
    const desc = detectLanguage(rel)
    if (desc) {
      void desc.load().then((support) => {
        if (viewRef.current === view) {
          view.dispatch({ effects: languageCompartment.reconfigure(support ?? []) })
        }
      }).catch(() => undefined)
    }
    view.focus()
    return () => {
      viewRef.current = null
      unregisterEditor(rel, view)
      view.destroy()
    }
    // rel/dark/readonly/root 变化即重建（打开新文件时 content 是该文件的磁盘内容）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rel, dark, readonly, root])

  return <div ref={hostRef} className="editor-host" />
}

/** 标签页 + 编辑器区（可切 Diff 审阅）。 */
export function EditorView() {
  const t = useT()
  const openFiles = useIde((state) => state.openFiles)
  const activePath = useIde((state) => state.activePath)
  const setActive = useIde((state) => state.setActive)
  const closeFile = useIde((state) => state.closeFile)
  const conflicts = useIde((state) => state.conflicts)
  const diffOpen = useIde((state) => state.diffOpen)
  const setDiffOpen = useIde((state) => state.setDiffOpen)
  const file = openFiles.find((f) => f.rel === activePath)
  const dirty = file !== undefined && file.content !== file.savedContent

  return (
    <div className="editor-area">
      <div className="editor-tabs">
        {openFiles.map((f) => (
          <div key={f.rel} className={`editor-tab${f.rel === activePath ? ' editor-tab-active' : ''}`}>
            <button className="editor-tab-name" title={f.rel} onClick={() => setActive(f.rel)}>
              {f.content !== f.savedContent && <span className="editor-dirty">●</span>}
              {conflicts[f.rel] && <span className="editor-conflict" title={t('ideExternalChange')}>⚠</span>}
              {f.rel.split('/').pop()}
            </button>
            <button className="editor-tab-close" onClick={() => closeFile(f.rel)}><IconX size={11} /></button>
          </div>
        ))}
        <div className="flex-1" />
        {file && dirty && (
          <button className="btn btn-ghost editor-diff-toggle" onClick={() => setDiffOpen(!diffOpen)}>
            {diffOpen ? t('ideBackToEdit') : t('ideReviewChanges')}
          </button>
        )}
      </div>
      {file && conflicts[file.rel] && <div className="conn-banner">{t('ideExternalChange')}</div>}
      {!file && <div className="editor-empty text-dim">从左侧文件树打开文件，⌘K 可模糊搜索</div>}
      {file?.tooLarge && <div className="editor-empty text-dim">文件过大（&gt;2MB），暂不支持编辑</div>}
      {file?.binary && <div className="editor-empty text-dim">二进制文件，不可编辑</div>}
      {file && !file.tooLarge && !file.binary && diffOpen && dirty && <DiffView rel={file.rel} />}
      {file && !file.tooLarge && !file.binary && !(diffOpen && dirty) && (
        <Editor key={file.rel} rel={file.rel} content={file.savedContent} readonly={file.readonly} />
      )}
    </div>
  )
}
