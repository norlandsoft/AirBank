import { useApp } from '../store'
import { useT } from '../hooks'
import { dotClass } from '../components/TitleBar'
import { useAgent } from '../modules/agent/store'
import { useIde } from '../modules/ide/store'
import { useGit } from '../modules/git/store'
import { useCicd } from '../modules/cicd/store'
import { useTerminal } from '../stores/terminal'
import { IconGitBranch, IconPipeline } from '../icons'

function ghDot(conclusion: string | null | undefined, status: string | undefined): string {
  const value = conclusion ?? status ?? ''
  if (value === 'success') return 'dot dot-ok'
  if (value === 'in_progress' || value === 'queued') return 'dot dot-warn'
  if (value === '') return 'dot dot-off'
  return 'dot dot-err'
}

/** 底部状态栏：服务状态 · 档案 · 内核版本 | 会话模型 · Git 分支 · CI · IDE 当前文件。 */
export function StatusBar() {
  const t = useT()
  const server = useApp((state) => state.server)
  const kernel = useApp((state) => state.kernel)
  const models = useAgent((state) => state.models)
  const activePath = useIde((state) => state.activePath)
  const root = useIde((state) => state.root)
  const branch = useGit((state) => state.status?.branch ?? null)
  const latestGh = useCicd((state) => state.ghRuns[0] ?? null)
  const setView = useApp((state) => state.setView)
  return (
    <footer className="statusbar">
      <span className="statusbar-item">
        <span className={dotClass(server?.state)} />
        {server?.url ?? t('serverStopped')}
      </span>
      {server?.profile && <span className="statusbar-item">⛁ {server.profile}</span>}
      {kernel?.version && <span className="statusbar-item">dsh {kernel.version}</span>}
      <div className="flex-1" />
      {latestGh && (
        <button className="statusbar-item statusbar-btn" title={latestGh.name} onClick={() => setView('cicd')}>
          <span className={ghDot(latestGh.conclusion, latestGh.status)} />
          <IconPipeline size={11} />
        </button>
      )}
      {branch && (
        <span className="statusbar-item"><IconGitBranch size={11} /> {branch}</span>
      )}
      {models?.current && (
        <span className="statusbar-item">◈ {models.current.provider}/{models.current.model}</span>
      )}
      {activePath && root && <span className="statusbar-item statusbar-path">{activePath}</span>}
      <button
        className="statusbar-item statusbar-btn"
        title="底部面板 ⌘J"
        onClick={() => useTerminal.getState().toggleBottom()}
      >
        ⬒
      </button>
    </footer>
  )
}
