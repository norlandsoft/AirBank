/** 统一 diff 文本的分行渲染（增删/块头/元信息着色）。 */
export function DiffText({ diff }: { diff: string }) {
  if (diff.trim().length === 0) {
    return <div className="editor-empty text-dim">无差异</div>
  }
  const lines = diff.split('\n')
  return (
    <div className="diff-text">
      {lines.map((line, index) => {
        let cls = 'diff-line'
        if (line.startsWith('+') && !line.startsWith('+++')) cls += ' diff-line-add'
        else if (line.startsWith('-') && !line.startsWith('---')) cls += ' diff-line-del'
        else if (line.startsWith('@@')) cls += ' diff-line-hunk'
        else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) cls += ' diff-line-meta'
        return <div key={index} className={cls}>{line === '' ? ' ' : line}</div>
      })}
    </div>
  )
}
