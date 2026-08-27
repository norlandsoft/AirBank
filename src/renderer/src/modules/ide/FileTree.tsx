import { useIde } from './store'
import { IconFile, IconFolder, IconRefresh } from '../../icons'
import type { FsEntry } from '../../../../shared/types'

function DirNode({ entry, depth }: { entry: FsEntry; depth: number }) {
  const expanded = useIde((state) => state.expanded[entry.rel] === true)
  const children = useIde((state) => state.dirs[entry.rel])
  const toggleDir = useIde((state) => state.toggleDir)
  return (
    <>
      <button
        className="tree-row hoverable"
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => void toggleDir(entry.rel)}
      >
        <span className="tree-chevron">{expanded ? '▾' : '▸'}</span>
        <IconFolder size={13} />
        <span className="tree-name">{entry.name}</span>
      </button>
      {expanded && children?.map((child) =>
        child.kind === 'dir'
          ? <DirNode key={child.rel} entry={child} depth={depth + 1} />
          : <FileNode key={child.rel} entry={child} depth={depth + 1} />)}
    </>
  )
}

function FileNode({ entry, depth }: { entry: FsEntry; depth: number }) {
  const activePath = useIde((state) => state.activePath)
  const openFile = useIde((state) => state.openFile)
  return (
    <button
      className={`tree-row hoverable${activePath === entry.rel ? ' active-nav' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 + 14 }}
      onClick={() => void openFile(entry.rel)}
    >
      <IconFile size={13} />
      <span className="tree-name">{entry.name}</span>
    </button>
  )
}

/** 文件树（懒加载展开；根目录头部带换目录/刷新）。 */
export function FileTree() {
  const root = useIde((state) => state.root)
  const entries = useIde((state) => state.dirs[''])
  const refreshDir = useIde((state) => state.refreshDir)
  const pickRoot = useIde((state) => state.pickRoot)
  const rootName = root ? (root.split('/').filter(Boolean).pop() ?? root) : ''
  return (
    <aside className="filetree">
      <div className="filetree-head">
        <span className="tree-root-name" title={root ?? ''}>{rootName}</span>
        <button className="btn-ghost btn !p-1" title="刷新" onClick={() => void refreshDir('')}><IconRefresh size={12} /></button>
        <button className="btn-ghost btn !p-1" title="更换目录" onClick={() => void pickRoot()}><IconFolder size={12} /></button>
      </div>
      <div className="filetree-body">
        {entries?.map((entry) =>
          entry.kind === 'dir'
            ? <DirNode key={entry.rel} entry={entry} depth={0} />
            : <FileNode key={entry.rel} entry={entry} depth={0} />)}
      </div>
    </aside>
  )
}
