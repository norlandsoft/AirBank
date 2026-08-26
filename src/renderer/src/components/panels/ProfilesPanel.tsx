import { useEffect, useState } from 'react'
import { useApp } from '../../store'
import { useT } from '../../hooks'
import { bridge } from '../../bridge'
import type { ProfileInfo } from '../../../../shared/types'
import { PanelHeader } from './PanelHeader'
import { IconTrash, IconCheck, IconPlus } from '../../icons'

/** 档案管理：列表 / 新建 / 切换 / 删除。 */
export function ProfilesPanel() {
  const t = useT()
  const [profiles, setProfiles] = useState<ProfileInfo[]>([])
  const [name, setName] = useState('')
  const reportError = useApp((state) => state.reportError)
  const showToast = useApp((state) => state.showToast)

  const refresh = (): void => { void bridge.profiles.list().then(setProfiles).catch(reportError) }
  useEffect(refresh, [reportError])

  const create = async (): Promise<void> => {
    if (!name.trim()) return
    try {
      setProfiles(await bridge.profiles.create(name))
      setName('')
    } catch (error) { reportError(error) }
  }

  return (
    <div className="flex-1 surface flex flex-col min-h-0">
      <PanelHeader
        title={t('profilesTitle')} desc={t('profilesDesc')}
        actions={(
          <div className="flex gap-1.5">
            <input className="input !w-44" placeholder={t('profileName')} value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void create() }} />
            <button className="btn btn-primary" onClick={() => void create()}><IconPlus size={13} /> {t('newProfile')}</button>
          </div>
        )}
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-2">
        {profiles.map((profile) => (
          <div key={profile.name} className="card flex items-center gap-3 !py-3">
            <span className={profile.active ? 'dot dot-ok' : 'dot dot-off'} />
            <span className="font-medium text-[13px]">{profile.name}</span>
            {profile.active && <span className="pill text-[10.5px]">{t('active')}</span>}
            <span className="text-dim text-[11px] truncate select-text">{profile.dir}</span>
            <div className="flex-1" />
            {!profile.active && (
              <>
                <button className="btn" onClick={async () => {
                  try {
                    setProfiles(await bridge.profiles.activate(profile.name))
                    showToast(t('profileSwitchHint'))
                  } catch (error) { reportError(error) }
                }}><IconCheck size={13} /> {t('activate')}</button>
                <button className="btn btn-danger" onClick={async () => {
                  if (!window.confirm(`${profile.name}: ${t('confirmDelete')}`)) return
                  try { setProfiles(await bridge.profiles.remove(profile.name)) } catch (error) { reportError(error) }
                }}><IconTrash size={13} /> {t('delete')}</button>
              </>
            )}
          </div>
        ))}
        {profiles.length === 0 && <div className="text-dim text-xs">{t('loading')}</div>}
      </div>
    </div>
  )
}
