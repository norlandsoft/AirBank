import { useAgent } from './store'
import { useT } from '../../hooks'
import { SessionList } from './components/SessionList'
import { CwdPicker, PresetPicker } from './components/startPickers'
import { useResizableWidth } from '../../lib/resizable'
import { Timeline } from './components/Timeline'
import { ApprovalDock } from './components/ApprovalDock'
import { Composer } from './components/Composer'

/** 自建会话面板：会话列表 + 时间线 + 停靠区 + 输入区（DSH API 直连，无内嵌网页）。 */
export function AgentPanel() {
  const t = useT()
  const connection = useAgent((state) => state.connection)
  const error = useAgent((state) => state.error)
  const activeSessionId = useAgent((state) => state.activeSessionId)
  const sessionsSplit = useResizableWidth('chat-sessions', 232)
  return (
    <div className="flex-1 flex min-h-0">
      <div style={{ width: sessionsSplit.width, flexShrink: 0, display: 'flex', minWidth: 0 }}><SessionList /></div>
      {sessionsSplit.handle}
      <div className="flex-1 flex flex-col min-w-0">
        {connection === 'reconnecting' && (
          <div className="conn-banner">{t('agentReconnecting')}</div>
        )}
        {error && <div className="conn-banner conn-banner-error">{error}</div>}
        {activeSessionId ? (
          <>
            <Timeline />
            <ApprovalDock />
            <Composer />
          </>
        ) : (
          <div className="start-hero">
            <div className="start-pickers-row">
              <CwdPicker />
              <PresetPicker />
            </div>
            <Composer />
          </div>
        )}
      </div>
    </div>
  )
}
