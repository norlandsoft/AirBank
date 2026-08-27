import { useEffect, useState } from 'react'
import { useAgent } from '../../../modules/agent/store'
import type { DshClient } from '../../../dsh-client/client'
import { useT } from '../../../hooks'

type Presets = Awaited<ReturnType<DshClient['agentPresetList']>>['presets']

/** 智能体设置：预设列表 + 应用到当前会话 / 复制副本 / 删除用户副本。 */
export function AgentSettings() {
  const t = useT()
  const client = useAgent((state) => state.client)
  const connection = useAgent((state) => state.connection)
  const activeSessionId = useAgent((state) => state.activeSessionId)
  const sessions = useAgent((state) => state.sessions)
  const [presets, setPresets] = useState<Presets>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = (): void => {
    void client.agentPresetList().then((result) => setPresets(result.presets)).catch((e) => setError(String(e)))
  }
  useEffect(() => {
    if (connection === 'ready') refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection])

  if (connection !== 'ready') {
    return <div className="text-dim text-xs py-2">{t('setNeedKernel')}</div>
  }

  const activeSummary = sessions.find((s) => s.sessionId === activeSessionId)
  const canApply = Boolean(activeSummary?.blank)

  const act = async (id: string, fn: () => Promise<unknown>): Promise<void> => {
    setBusy(id)
    try {
      await fn()
      refresh()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title">{t('setAgent')}</div>
      {error && <div className="conn-banner conn-banner-error">{error}</div>}
      {!canApply && activeSessionId && <div className="text-dim text-xs py-1">{t('setAgentApplyHint')}</div>}
      {presets.map((preset) => (
        <div key={preset.id} className="preset-card">
          <div className="preset-head">
            <span className="preset-name">{preset.name}</span>
            <span className="text-dim text-xs">{preset.id}</span>
            {preset.isDefault && <span className="pill provider-active">{t('setAgentDefault')}</span>}
          </div>
          {preset.description && <div className="preset-desc">{preset.description}</div>}
          <div className="preset-actions">
            <button
              className="btn" disabled={!canApply || busy === preset.id}
              title={canApply ? '' : t('setAgentApplyHint')}
              onClick={() => void act(preset.id, () => client.agentPresetSelect(activeSessionId as string, preset.id))}
            >
              {t('setAgentApply')}
            </button>
            <button className="btn" disabled={busy === preset.id} onClick={() => void act(preset.id, () => client.agentPresetCopy(preset.id))}>
              {t('setAgentCopy')}
            </button>
            {preset.trust !== 'system' && (
              <button className="btn btn-danger" disabled={busy === preset.id} onClick={() => void act(preset.id, () => client.agentPresetRemove(preset.id))}>
                {t('delete')}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
