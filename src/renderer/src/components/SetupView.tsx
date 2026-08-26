import { useEffect, useRef } from 'react'
import { useApp } from '../store'
import { useT } from '../hooks'
import type { InstallStep } from '../../../shared/types'
import { IconCheck, IconSpinner, IconDownload, IconLogo } from '../icons'
import type { I18nKey } from '../i18n'

const STEP_LABEL: Record<string, I18nKey> = { runtime: 'stepRuntime', pnpm: 'stepPnpm', kernel: 'stepKernel' }

function StepRow({ step }: { step: InstallStep }) {
  const t = useT()
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-5 flex justify-center">
        {step.status === 'done' && <IconCheck size={15} className="text-[var(--ok)]" />}
        {step.status === 'active' && <IconSpinner size={15} />}
        {step.status === 'error' && <span className="text-[var(--err)]">✕</span>}
        {step.status === 'pending' && <span className="dot dot-off" />}
      </span>
      <span className="w-32 text-[13px]">{t(STEP_LABEL[step.id] ?? 'stepRuntime')}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${step.progress}%`, background: step.status === 'error' ? 'var(--err)' : 'var(--accent)' }}
        />
      </div>
      <span className="text-dim text-[11px] w-28 text-right truncate">{step.detail}</span>
    </div>
  )
}

/** 首次启动安装引导：状态机步骤 + 进度 + 日志尾部，完成后自动启动服务。 */
export function SetupView() {
  const t = useT()
  const { installPlan, installRunning, runSetup, logs, runtime, kernel } = useApp()
  const started = useRef(false)

  const needsInstall = (runtime !== null && (!runtime.available || !runtime.supported))
    || (kernel !== null && !kernel.installed)
  const auto = needsInstall && !installPlan && !installRunning

  useEffect(() => {
    if (auto && !started.current) {
      started.current = true
      void runSetup()
    }
  }, [auto, runSetup])

  const tail = logs.slice(-8)
  return (
    <div className="flex-1 surface flex items-center justify-center overflow-y-auto">
      <div className="w-[520px] max-w-[92%] py-10">
        <div className="flex items-center gap-3 mb-2">
          <IconLogo size={34} />
          <div>
            <h1 className="text-lg font-semibold">{t('setupTitle')}</h1>
            <p className="text-dim text-xs mt-0.5">{t('setupDesc')}</p>
          </div>
        </div>

        <div className="card mt-5">
          {installPlan?.steps.map((step) => <StepRow key={step.id} step={step} />)}
          {!installPlan && (
            <div className="flex items-center gap-2 text-dim text-xs py-1">
              <IconDownload size={14} />
              {t('stepRuntime')} · {t('stepPnpm')} · {t('stepKernel')}
            </div>
          )}
          {installPlan?.error && <div className="text-[var(--err)] text-xs mt-2 select-text">{installPlan.error}</div>}
          {installPlan?.done && <div className="text-[var(--ok)] text-xs mt-2">{t('setupDone')}</div>}
          <div className="mt-3 flex gap-2">
            {!installRunning && !installPlan?.done && (
              <button className="btn btn-primary" onClick={() => void runSetup()}>
                {installPlan?.error ? t('setupRetry') : t('setupStart')}
              </button>
            )}
            {installRunning && (
              <button className="btn" disabled><IconSpinner size={13} /> {t('loading')}</button>
            )}
          </div>
        </div>

        {tail.length > 0 && (
          <div className="card mt-3 max-h-40 overflow-y-auto log-console text-dim">
            {tail.map((entry, index) => (
              <div key={index}>[{entry.source}] {entry.line}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
