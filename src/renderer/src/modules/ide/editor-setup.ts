import { Compartment, EditorState, type Extension } from '@codemirror/state'
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, rectangularSelection, crosshairCursor,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput, LanguageDescription, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { vscodeKeymap } from '@replit/codemirror-vscode-keymap'
import { languages } from '@codemirror/language-data'

/** 语言重配置隔间（异步加载语法后 dispatch 切换）。 */
export const languageCompartment = new Compartment()

/** 按文件扩展名匹配语言（language-data 覆盖长尾，懒加载 legacy modes）。 */
export function detectLanguage(filename: string): LanguageDescription | null {
  return LanguageDescription.matchFilename(languages, filename)
}

/** CM6 基础装配：VS Code 键位 + 多光标 + 搜索 + 括号 + 历史。 */
export function baseExtensions(): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    drawSelection(),
    rectangularSelection(),
    crosshairCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    highlightSelectionMatches(),
    keymap.of([
      ...closeBracketsKeymap,
      ...vscodeKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      indentWithTab,
    ]),
    languageCompartment.of([]),
  ]
}

/** 应用暗色/亮色编辑器主题（对齐语义令牌）。 */
export function editorTheme(dark: boolean): Extension {
  return EditorView.theme({
    '&': {
      backgroundColor: 'var(--bg-base)',
      color: 'var(--text)',
      height: '100%',
      fontSize: '15px',
    },
    '.cm-content': {
      fontFamily: "'IBM Plex Mono', 'PingFang SC', 'SF Mono', ui-monospace, Menlo, Consolas, monospace",
      caretColor: 'var(--accent)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--bg-base)',
      color: 'var(--text-dim)',
      border: 'none',
      borderRight: '1px solid var(--border)',
    },
    '.cm-activeLine': { backgroundColor: 'var(--bg-hover)' },
    '.cm-activeLineGutter': { backgroundColor: 'var(--bg-hover)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'var(--bg-active) !important',
    },
    '.cm-cursor': { borderLeftColor: 'var(--accent)' },
    '.cm-searchMatch': { backgroundColor: 'rgba(217, 119, 6, 0.35)' },
    '.cm-searchMatch-selected': { backgroundColor: 'rgba(217, 119, 6, 0.6)' },
    '.cm-panels': {
      backgroundColor: 'var(--bg-panel)',
      color: 'var(--text)',
      borderColor: 'var(--border)',
    },
    '.cm-panels input': { color: 'var(--text)' },
  }, { dark })
}
