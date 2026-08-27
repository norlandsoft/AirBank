import { useEffect, useRef, useState } from 'react'
import { useCicd } from './store'
import { useIde } from '../ide/store'
import { useT } from '../../hooks'
import { bridge } from '../../bridge'
import type { CiRunView, CiStepState, GhRun } from '../../../../shared/types'

const STEP_ICON: Record<CiStepState, string> = {
  pending: '○', running: '◐', success: '●', failed: '✗', cancelled: '⊘', skipped: '—',
}

function stateDot(state: string): string {
  switch (state) {
    case 'success': return 'dot dot-ok'
    case 'running': case 'in_progress': case 'queued': return 'dot dot-warn'
    case 'failed': case 'failure': case 'cancelled': case 'timed_out': return 'dot dot-err'
    default: return 'dot dot-off'
  }
}

function timeText(ts: number): string {
  const date = new Date(ts)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function RunLog({ runId, stepIndex }: { runId: string; stepIndex: number }) {
  const text = useCicd((state) => state.logs[runId]?.[stepIndex] ?? '')
  const ref = useRef<HTMLPreElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text])
  return <pre ref={ref} className="ci-log">{text || '（暂无日志）'}</pre>
}

function RunDetail({ run }: { run: CiRunView }) {
  const t = useT()
  const cancel = useCicd((state) => state.cancel)
  const [openStep, setOpenStep] = useState<number | null>(null)
  const activeStep = openStep ?? run.steps.findIndex((step) => step.state === 'running')
  return (
    <div className="ci-detail">
      <div className="ci-detail-head">
        <span className={stateDot(run.state)} />
        <span className="ci-detail-name">{run.name}</span>
        <span className="text-dim text-xs">{timeText(run.startedAt)}</span>
        {run.state === 'running' && (
          <button className="btn btn-ghost text-xs" onClick={() => void cancel(run.pipelineId)}>{t('ciCancel')}</button>
        )}
      </div>
      <div className="ci-steps">
        {run.steps.map((step, index) => (
          <div key={index} className="ci-step-block">
            <button
              className={`ci-step-row hoverable${activeStep === index ? ' active-nav' : ''}`}
              onClick={() => setOpenStep(activeStep === index ? null : index)}
            >
              <span className={`ci-step-icon ci-step-${step.state}`}>{STEP_ICON[step.state]}</span>
              <span className="ci-step-name">{step.name}</span>
              {step.durationMs !== undefined && <span className="text-dim text-xs">{(step.durationMs / 1000).toFixed(1)}s</span>}
              {step.exitCode !== undefined && step.exitCode !== 0 && <span className="ci-step-exit">exit {step.exitCode}</span>}
            </button>
            {activeStep === index && <RunLog runId={run.runId} stepIndex={index} />}
          </div>
        ))}
      </div>
    </div>
  )
}

function GhRuns({ runs }: { runs: GhRun[] }) {
  return (
    <div className="ci-gh">
      {runs.map((run) => (
        <button key={run.id} className="ci-gh-row hoverable" onClick={() => void bridge.shell.openExternal(run.url)}>
          <span className={stateDot(run.conclusion ?? run.status)} />
          <span className="ci-gh-name">{run.name}</span>
          <span className="ci-gh-branch">{run.branch}</span>
          <span className="text-dim text-xs">{timeText(run.updatedAt)}</span>
        </button>
      ))}
    </div>
  )
}

/** CI/CD 面板：本地流水线（触发/步骤/日志流）+ GitHub Actions 只读。 */
export function CicdPanel() {
  const t = useT()
  const { pipelines, runs, activeRunId, ghRepo, ghRuns, ghError, error } = useCicd()
  const refresh = useCicd((state) => state.refresh)
  const refreshGithub = useCicd((state) => state.refreshGithub)
  const run = useCicd((state) => state.run)
  const selectRun = useCicd((state) => state.selectRun)
  const root = useIde((state) => state.root)

  useEffect(() => {
    void refresh()
    void refreshGithub()
    const timer = setInterval(() => void refreshGithub(), 60_000)
    return () => clearInterval(timer)
  }, [refresh, refreshGithub, root])

  if (!root) {
    return <div className="flex-1 surface flex items-center justify-center text-dim text-sm">{t('gitNeedRoot')}</div>
  }

  const lastRunByPipeline = new Map<string, CiRunView>()
  for (const item of runs) {
    if (!lastRunByPipeline.has(item.pipelineId)) lastRunByPipeline.set(item.pipelineId, item)
  }
  const activeRun = runs.find((item) => item.runId === activeRunId) ?? runs[0]

  return (
    <div className="flex-1 flex min-h-0">
      <aside className="ci-side">
        <div className="ci-side-head text-xs text-dim">{t('ciPipelines')}</div>
        {pipelines.map((pipeline) => {
          const last = lastRunByPipeline.get(pipeline.id)
          const running = last?.state === 'running'
          return (
            <div key={pipeline.id} className="ci-pipeline-row">
              <span className={last ? stateDot(last.state) : 'dot dot-off'} />
              <div className="ci-pipeline-info">
                <div className="ci-pipeline-name">{pipeline.name}</div>
                <div className="text-dim text-xs">{pipeline.stepCount} {t('ciSteps')}</div>
              </div>
              <button className="btn btn-ghost ci-run-btn" disabled={running} onClick={() => void run(pipeline.id)}>
                {running ? '◐' : '▶'}
              </button>
            </div>
          )
        })}
        {pipelines.length === 0 && (
          <div className="text-dim text-xs px-3 py-3">{t('ciNoPipelines')}<br /><code>.aircode/pipelines/*.yaml</code></div>
        )}

        {runs.length > 0 && <div className="ci-side-head text-xs text-dim">{t('ciRuns')}</div>}
        {runs.slice(0, 12).map((item) => (
          <button
            key={item.runId}
            className={`ci-run-row hoverable${activeRun?.runId === item.runId ? ' active-nav' : ''}`}
            onClick={() => selectRun(item.runId)}
          >
            <span className={stateDot(item.state)} />
            <span className="ci-run-label">{item.name}</span>
            <span className="text-dim text-xs">{timeText(item.startedAt)}</span>
          </button>
        ))}

        {ghRepo && (
          <>
            <div className="ci-side-head text-xs text-dim">GitHub · {ghRepo}</div>
            <GhRuns runs={ghRuns} />
            {ghError && <div className="text-dim text-xs px-3 py-1">{ghError}</div>}
          </>
        )}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        {error && <div className="conn-banner conn-banner-error">{error}</div>}
        {activeRun ? <RunDetail run={activeRun} /> : (
          <div className="editor-empty text-dim">{t('ciSelectHint')}</div>
        )}
      </div>
    </div>
  )
}
