import { useAgent } from './store'
import { useT } from '../../hooks'
import { SessionList } from './components/SessionList'
import { Timeline } from './components/Timeline'
import { ApprovalDock } from './components/ApprovalDock'
import { Composer } from './components/Composer'

/** 自建会话面板：会话列表 + 时间线 + 停靠区 + 输入区（DSH API 直连，无内嵌网页）。 */
export function AgentPanel() {
  const t = useT()
  const connection = useAgent((state) => state.connection)
  const error = useAgent((state) => state.error)
  return (
    <div className="flex-1 flex min-h-0">
      <SessionList />
      <div className="flex-1 flex flex-col min-w-0">
        {connection === 'reconnecting' && (
          <div className="conn-banner">{t('agentReconnecting')}</div>
        )}
        {error && <div className="conn-banner conn-banner-error">{error}</div>}
        <Timeline />
        <ApprovalDock />
        <Composer />
      </div>
    </div>
  )
}
