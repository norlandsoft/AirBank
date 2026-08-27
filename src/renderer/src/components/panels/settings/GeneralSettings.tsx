import { useState } from 'react'
import { useApp } from '../../../store'
import { useT } from '../../../hooks'
import type { Locale, ThemeMode } from '../../../../../shared/types'

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b bordered last:border-b-0">
      <div className="w-44 flex-shrink-0">
        <div className="text-[13px]">{label}</div>
        {desc && <div className="text-dim text-[11px] mt-0.5">{desc}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

/** 通用设置：语言 / 主题 / 端口 / 目录 / 镜像 / 系统集成 / 编辑器。 */
export function GeneralSettings() {
  const t = useT()
  const { settings, patchSettings, showToast, reportError } = useApp()
  const [port, setPort] = useState<string | null>(null)
  const [dshHome, setDshHome] = useState<string | null>(null)
  const [kernelDir, setKernelDir] = useState<string | null>(null)
  const [nodePath, setNodePath] = useState<string | null>(null)
  if (!settings) return null

  const save = async (partial: Parameters<typeof patchSettings>[0]): Promise<void> => {
    try {
      await patchSettings(partial)
      showToast(t('saved'))
    } catch (error) { reportError(error) }
  }

  const selectClass = 'input !w-44'
  return (
    <div>
      <Row label={t('language')}>
        <select className={selectClass} value={settings.locale} onChange={(event) => void save({ locale: event.target.value as Locale })}>
          <option value="zh-CN">中文</option>
          <option value="en-US">English</option>
        </select>
      </Row>
      <Row label={t('theme')}>
        <select className={selectClass} value={settings.theme} onChange={(event) => void save({ theme: event.target.value as ThemeMode })}>
          <option value="dark">{t('themeDark')}</option>
          <option value="light">{t('themeLight')}</option>
          <option value="system">{t('themeSystem')}</option>
        </select>
      </Row>
      <Row label={t('port')} desc={t('portDesc')}>
        <input
          className="input !w-32" type="number" min={1024} max={65535}
          value={port ?? String(settings.port)}
          onChange={(event) => setPort(event.target.value)}
          onBlur={() => {
            const next = Number(port)
            setPort(null)
            if (Number.isInteger(next) && next >= 1024 && next <= 65535 && next !== settings.port) void save({ port: next })
          }}
        />
      </Row>
      <Row label={t('dshHome')} desc={t('dshHomeDesc')}>
        <input
          className="input" placeholder="留空 = 应用数据目录/dsh-home"
          value={dshHome ?? settings.dshHome}
          onChange={(event) => setDshHome(event.target.value)}
          onBlur={() => { const v = dshHome; setDshHome(null); if (v !== null && v !== settings.dshHome) void save({ dshHome: v.trim() }) }}
        />
      </Row>
      <Row label={t('kernelDir')}>
        <input
          className="input" placeholder="/path/to/kernel"
          value={kernelDir ?? settings.kernelDir ?? ''}
          onChange={(event) => setKernelDir(event.target.value)}
          onBlur={() => { const v = kernelDir; setKernelDir(null); if (v !== null) void save({ kernelDir: v.trim() === '' ? null : v.trim() }) }}
        />
      </Row>
      <Row label={t('nodePath')}>
        <input
          className="input" placeholder="/path/to/node"
          value={nodePath ?? settings.nodePath ?? ''}
          onChange={(event) => setNodePath(event.target.value)}
          onBlur={() => { const v = nodePath; setNodePath(null); if (v !== null) void save({ nodePath: v.trim() === '' ? null : v.trim() }) }}
        />
      </Row>
      <Row label={t('useMirror')}>
        <input type="checkbox" checked={settings.useMirror} onChange={(event) => void save({ useMirror: event.target.checked })} />
      </Row>
      <Row label={t('formatOnSave')}>
        <input type="checkbox" checked={settings.formatOnSave} onChange={(event) => void save({ formatOnSave: event.target.checked })} />
      </Row>
      <Row label={t('autoStart')}>
        <input type="checkbox" checked={settings.autoStart} onChange={(event) => void save({ autoStart: event.target.checked })} />
      </Row>
      <Row label={t('closeToTray')}>
        <input type="checkbox" checked={settings.closeToTray} onChange={(event) => void save({ closeToTray: event.target.checked })} />
      </Row>
    </div>
  )
}
