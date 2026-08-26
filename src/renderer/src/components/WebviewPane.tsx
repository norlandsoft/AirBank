import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { useApp } from '../store'
import { useT } from '../hooks'
import { bridge } from '../bridge'
import { IconSpinner } from '../icons'

/** webview new-window 事件载荷（Electron 未导出该事件类型）。 */
interface NewWindowLike { url: string }

export interface WebviewHandle {
  reload(): void
}

/** 内嵌 DSH WebUI 的 <webview>：加载态、失败重试、外链交给系统浏览器。 */
export const WebviewPane = forwardRef<WebviewHandle, { url: string }>(function WebviewPane({ url }, ref) {
  const t = useT()
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const reportError = useApp((state) => state.reportError)

  useImperativeHandle(ref, () => ({
    reload() {
      setFailed(false)
      setLoading(true)
      try { webviewRef.current?.reload() } catch { webviewRef.current?.setAttribute('src', url) }
    },
  }), [url])

  useEffect(() => {
    const view = webviewRef.current
    if (!view) return
    const onStart = (): void => { setLoading(true); setFailed(false) }
    const onStop = (): void => setLoading(false)
    const onFail = (event: Electron.DidFailLoadEvent): void => {
      if (event.errorCode === -3) return // ERR_ABORTED（正常跳转中止）
      setLoading(false)
      setFailed(true)
    }
    const onNewWindow = (event: NewWindowLike): void => {
      void bridge.shell.openExternal(event.url).catch(reportError)
    }
    view.addEventListener('did-start-loading', onStart)
    view.addEventListener('did-stop-loading', onStop)
    view.addEventListener('did-fail-load', onFail)
    view.addEventListener('new-window', onNewWindow as unknown as EventListener)
    return () => {
      view.removeEventListener('did-start-loading', onStart)
      view.removeEventListener('did-stop-loading', onStop)
      view.removeEventListener('did-fail-load', onFail)
      view.removeEventListener('new-window', onNewWindow as unknown as EventListener)
    }
  }, [reportError])

  return (
    <div className="relative flex-1 min-h-0">
      <webview ref={webviewRef as unknown as React.Ref<HTMLWebViewElement>} className="dsh-web" src={url} allowpopups />
      {loading && !failed && (
        <div className="absolute inset-0 surface flex flex-col items-center justify-center gap-3">
          <IconSpinner size={22} />
          <span className="text-dim text-xs">{t('connecting')}</span>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 surface flex flex-col items-center justify-center gap-3">
          <div className="text-base font-medium">{t('webFailed')}</div>
          <div className="text-dim text-xs">{t('webFailedDesc')}</div>
          <button className="btn btn-primary" onClick={() => { setFailed(false); setLoading(true); webviewRef.current?.reload() }}>
            {t('retry')}
          </button>
        </div>
      )}
    </div>
  )
})