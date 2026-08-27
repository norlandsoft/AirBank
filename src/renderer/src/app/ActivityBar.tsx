import { useApp, type View } from '../store'
import { useT } from '../hooks'
import {
  IconAbout, IconChat, IconCode, IconCores, IconGitBranch, IconLogs, IconPipeline,
  IconPlugins, IconProfiles, IconServer, IconSettings, IconLogo,
} from '../icons'

type IconFn = (p: { size?: number }) => React.ReactNode

const MODULES: Array<{ id: View; icon: IconFn; label: 'navChat' | 'navIde' | 'navGit' | 'navServers' | 'navCicd' }> = [
  { id: 'chat', icon: (p) => <IconChat {...p} />, label: 'navChat' },
  { id: 'ide', icon: (p) => <IconCode {...p} />, label: 'navIde' },
  { id: 'git', icon: (p) => <IconGitBranch {...p} />, label: 'navGit' },
  { id: 'servers', icon: (p) => <IconServer {...p} />, label: 'navServers' },
  { id: 'cicd', icon: (p) => <IconPipeline {...p} />, label: 'navCicd' },
]

const ADMIN: Array<{ id: View; icon: IconFn; label: 'navProfiles' | 'navPlugins' | 'navCores' | 'navLogs' | 'navSettings' | 'navAbout' }> = [
  { id: 'profiles', icon: (p) => <IconProfiles {...p} />, label: 'navProfiles' },
  { id: 'plugins', icon: (p) => <IconPlugins {...p} />, label: 'navPlugins' },
  { id: 'cores', icon: (p) => <IconCores {...p} />, label: 'navCores' },
  { id: 'logs', icon: (p) => <IconLogs {...p} />, label: 'navLogs' },
  { id: 'settings', icon: (p) => <IconSettings {...p} />, label: 'navSettings' },
  { id: 'about', icon: (p) => <IconAbout {...p} />, label: 'navAbout' },
]

/** 活动栏（48px 图标轨）：上部业务模块，下部管理面板。 */
export function ActivityBar() {
  const t = useT()
  const view = useApp((state) => state.view)
  const setView = useApp((state) => state.setView)
  const renderItem = (item: { id: View; icon: IconFn; label: string }): React.ReactNode => (
    <button
      key={item.id}
      className={`activity-item${view === item.id ? ' activity-item-active' : ''}`}
      title={t(item.label as Parameters<typeof t>[0])}
      onClick={() => setView(item.id)}
    >
      {item.icon({ size: 19 })}
    </button>
  )
  return (
    <nav className="activitybar">
      <div className="activity-brand"><IconLogo size={20} /></div>
      {MODULES.map(renderItem)}
      <div className="flex-1" />
      {ADMIN.map(renderItem)}
    </nav>
  )
}
