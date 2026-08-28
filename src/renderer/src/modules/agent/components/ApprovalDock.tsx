import { useState } from 'react'
import { useAgent } from '../store'
import { visibleQueueItems } from '../fold'
import { useT } from '../../../hooks'
import type { PendingQuestion } from '../model'

/** 审批卡：允许一次 / 拒绝（"总是允许"策略走 /permission 斜杠命令，不做进此卡）。 */
function ApprovalCard({ approvalId, toolName, reason }: { approvalId: string; toolName: string; reason?: string }) {
  const t = useT()
  const answerApproval = useAgent((state) => state.answerApproval)
  const [busy, setBusy] = useState(false)
  const answer = (outcome: 'allowed-once' | 'rejected'): void => {
    setBusy(true)
    void answerApproval(approvalId, outcome).finally(() => setBusy(false))
  }
  return (
    <div className="dock-card approval-card">
      <div className="dock-card-body">
        <span className="approval-tool">⚠ {toolName}</span>
        {reason && <span className="text-dim text-xs">{reason}</span>}
      </div>
      <div className="dock-card-actions">
        <button className="btn btn-primary" disabled={busy} onClick={() => answer('allowed-once')}>{t('agentAllow')}</button>
        <button className="btn btn-danger" disabled={busy} onClick={() => answer('rejected')}>{t('agentReject')}</button>
      </div>
    </div>
  )
}

/** 提问卡：选项点选（multiSelect 多选）+ 可选自定义文本，整批提交。 */
function QuestionCard({ pending }: { pending: PendingQuestion }) {
  const t = useT()
  const answerQuestion = useAgent((state) => state.answerQuestion)
  const [selections, setSelections] = useState<Record<string, { selected: string[]; custom: string }>>({})
  const [busy, setBusy] = useState(false)

  const toggle = (id: string, label: string, multi: boolean): void => {
    setSelections((prev) => {
      const current = prev[id] ?? { selected: [], custom: '' }
      const selected = current.selected.includes(label)
        ? current.selected.filter((item) => item !== label)
        : multi ? [...current.selected, label] : [label]
      return { ...prev, [id]: { ...current, selected } }
    })
  }

  const ready = pending.questions.every((q) => {
    const sel = selections[q.id]
    return sel !== undefined && (sel.selected.length > 0 || sel.custom.trim().length > 0)
  })

  const submit = (): void => {
    setBusy(true)
    const answers = pending.questions.map((q) => {
      const sel = selections[q.id] ?? { selected: [], custom: '' }
      return { id: q.id, selected: sel.selected, ...(sel.custom.trim() ? { custom: sel.custom.trim() } : {}) }
    })
    void answerQuestion(answers).finally(() => setBusy(false))
  }

  return (
    <div className="dock-card question-card">
      {pending.questions.map((q) => {
        const sel = selections[q.id] ?? { selected: [], custom: '' }
        return (
          <div key={q.id} className="question-item">
            {q.header && <div className="question-header">{q.header}</div>}
            <div className="question-text">{q.question}</div>
            {q.detail && <div className="text-dim text-xs">{q.detail}</div>}
            <div className="question-options">
              {q.options?.map((option) => (
                <button
                  key={option.label}
                  className={`btn${sel.selected.includes(option.label) ? ' btn-primary' : ''}`}
                  title={option.description}
                  onClick={() => toggle(q.id, option.label, q.multiSelect === true)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <input
              className="input"
              placeholder={t('agentQuestionCustom')}
              value={sel.custom}
              onChange={(event) => setSelections((prev) => ({ ...prev, [q.id]: { ...sel, custom: event.target.value } }))}
            />
          </div>
        )
      })}
      <div className="dock-card-actions">
        <button className="btn btn-primary" disabled={!ready || busy} onClick={submit}>{t('agentQuestionSubmit')}</button>
      </div>
    </div>
  )
}

/** 时间线与 Composer 之间的停靠区：待审批 + 待提问 + 排队提示。 */
export function ApprovalDock() {
  const t = useT()
  const slice = useAgent((state) => (state.activeSessionId ? state.slices[state.activeSessionId] : undefined))
  if (!slice) return null
  const approvals = [...slice.pendingApprovals.values()]
  // 只计真排队消息（queued）：steering/context 注入不算（对齐官方 QueueDock）
  const queued = visibleQueueItems(slice.queue)
  return (
    <div className="dock">
      {approvals.map((approval) => (
        <ApprovalCard key={approval.approvalId} approvalId={approval.approvalId} toolName={approval.toolName} reason={approval.reason} />
      ))}
      {slice.pendingQuestion && <QuestionCard pending={slice.pendingQuestion} />}
      {queued.length > 0 && (
        <div className="text-dim text-xs dock-queue">{t('agentQueueCount', { n: String(queued.length) })}</div>
      )}
    </div>
  )
}
