import { useApp, effectiveTheme } from './store'
import { translate, type I18nKey } from './i18n'
import { useEffect } from 'react'

/** 当前语言翻译函数。 */
export function useT(): (key: I18nKey, vars?: Record<string, string>) => string {
  const locale = useApp((state) => state.settings?.locale ?? 'zh-CN')
  return (key, vars) => translate(locale, key, vars)
}

/** 把生效主题写到 <html data-theme>，并监听系统主题变化。 */
export function useApplyTheme(): void {
  const settings = useApp((state) => state.settings)
  const nativeDark = useApp((state) => state.nativeDark)
  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme(settings, nativeDark)
  }, [settings, nativeDark])
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => useApp.setState({ nativeDark: event.matches })
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
}
