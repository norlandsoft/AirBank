import { useEffect, useState } from 'react'
import { useApp, type View } from '../store'
import { useT } from '../hooks'
import { bridge } from '../bridge'
import type { ProfileInfo } from '../../../shared/types'
import {
  IconChat, IconProfiles, IconPlugins, IconCores, IconLogs, IconSettings, IconAbout,
  IconPlay, IconStop, IconRestart, IconLogo, IconPlus, IconSpinner,
} from '../icons'
import { dotClass } from './TitleBar'

const NAV: Array<{ id: View; icon: (p: { size?: number }) => React.ReactNode; label: 'navChat' | 'navProfiles' | 'navPlugins' | 'navCores' | 'navLogs' | 'navSettings' | 'navAbout' }> = [
  { id: 'chat', icon: (p) => <IconChat {...p} />, label: 'navChat' },
  { id: 'profiles', icon: (p) => <IconProfiles {...p} />, label: 'navProfiles' },
  { id: 'plugins', icon: (p) => <IconPlugins {...p} />, label: 'navPlugins' },
  { id: 'cores', icon: (p) => <IconCores {...p} />, label: 'navCores' },
  { id: 'logs', icon: (p) => <IconLogs {...p} />, label: 'navLogs' },
  { id: 'settings', icon: (p) => <IconSettings {...p} />, label: 'navSettings' },
  { id: 'about', icon: (p) => <IconAbout {...p} />, label: 'navAbout' },
]

/** Codex 风格侧边栏：品牌区 + 导航 + 档案列表 + 服务控制底栏。 */
export function Sidebar() {
  const t = useT()
  const { view, setView, sidebarCollapsed, server, kernel, info } = useApp()
  const [profiles, setProfiles] = useState<ProfileInfo[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const refreshProfiles = (): void => { void bridge.profiles.list().then(setProfiles).catch(() => undefined) }
  useEffect(refreshProfiles, [server?.profile])

  if (sidebarCollapsed) return null
  const running = server?.state === 'running'
  const busy = server?.state === 'starting' || server?.state === 'stopping'

  const createProfile = async (): Promise<void> => {
    if (!name.trim()) return
    try {
      setProfiles(await bridge.profiles.create(name))
      setName('')
      setCreating(false)
    } catch (error) { useApp.getState().reportError(error) }
  }

  return (
    <aside className="sidebar flex flex-col w-[248px] flex-shrink-0 border-r bordered">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <IconLogo size={20} />
        <div className="leading-tight">
          <div className="font-semibold text-[13px]">DeepSeek Harness</div>
          <div className="text-dim text-[10.5px]">Desktop {info?.appVersion ?? ''}</div>
        </div>
      </div>

      <nav className="px-2 py-1 space-y-0.5">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12.5px] hoverable ${view === item.id ? 'active-nav font-medium' : ''}`}
          >
            {item.icon({ size: 15 })}
            {t(item.label)}
          </button>
        ))}
      </nav>

      <div className="mt-2 px-3 flex items-center justify-between">
        <span className="text-dim text-[11px] font-medium uppercase tracking-wide">{t('navProfiles')}</span>
        <button className="btn-ghost btn !p-1" onClick={() => setCreating((v) => !v)} title={t('newProfile')}><IconPlus size={13} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {creating && (
          <div className="flex gap-1 px-1 py-1">
            <input
              className="input !py-1 text-xs" placeholder={t('profileName')} value={name} autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void createProfile() }}
            />
            <button className="btn btn-primary !px-2 text-xs" onClick={() => void createProfile()}>{t('create')}</button>
          </div>
        )}
        {profiles.map((profile) => (
          <button
            key={profile.name}
            onClick={async () => {
              if (profile.active) return
              try {
                await bridge.profiles.activate(profile.name)
                refreshProfiles()
                useApp.getState().showToast(t('profileSwitchHint'))
              } catch (error) { useApp.getState().reportError(error) }
            }}
            className={`w-full flex items-center gap-2 px-2.5 py-[6px] rounded-lg text-[12.5px] hoverable ${profile.active ? 'active-nav' : ''}`}
          >
            <span className={profile.active ? 'dot dot-ok' : 'dot dot-off'} />
            <span className="truncate">{profile.name}</span>
            {profile.active && <span className="ml-auto text-[10px] text-dim">{t('active')}</span>}
          </button>
        ))}
        {profiles.length === 0 && <div className="text-dim text-xs px-2.5 py-2">web</div>}
      </div>

      <div className="border-t bordered px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className={dotClass(server?.state)} />
          <span className="text-dim truncate">{server?.url ?? (kernel?.version ? `dsh ${kernel.version}` : 'dsh')}</span>
        </div>
        <div className="flex gap-1.5">
          {running || busy ? (
            <>
              <button className="btn flex-1 justify-center" disabled={busy} onClick={() => void useApp.getState().stopServer()}>
                {busy ? <IconSpinner size={13} /> : <IconStop size={12} />} {t('stop')}
              </button>
              <button className="btn flex-1 justify-center" disabled={busy} onClick={() => void useApp.getState().restartServer()}>
                <IconRestart size={13} /> {t('restart')}
              </button>
            </>
          ) : (
            <button className="btn btn-primary flex-1 justify-center" onClick={() => void useApp.getState().startServer()}>
              <IconPlay size={12} /> {t('startServer')}
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
