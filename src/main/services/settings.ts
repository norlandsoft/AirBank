import fs from 'node:fs'
import path from 'node:path'
import type { AppPaths } from '../core/paths'
import type { AppSettings, Locale, ThemeMode } from '../../shared/types'

const LOCALES: Locale[] = ['zh-CN', 'en-US']
const THEMES: ThemeMode[] = ['light', 'dark', 'system']

export function defaultSettings(paths: AppPaths): AppSettings {
  return {
    locale: 'zh-CN',
    theme: 'system',
    port: 3080,
    dshHome: '',
    kernelDir: null,
    nodePath: null,
    useMirror: false,
    autoStart: false,
    closeToTray: true,
    activeProfile: 'web',
    ideRoot: '',
    formatOnSave: true,
  }
}

/** 清洗外部输入：未知字段丢弃、非法值回落默认，保证旧版本设置文件前向兼容。 */
export function sanitizeSettings(input: unknown, paths: AppPaths): AppSettings {
  const base = defaultSettings(paths)
  if (typeof input !== 'object' || input === null) return base
  const raw = input as Record<string, unknown>
  const out = { ...base }
  if (typeof raw.locale === 'string' && LOCALES.includes(raw.locale as Locale)) out.locale = raw.locale as Locale
  if (typeof raw.theme === 'string' && THEMES.includes(raw.theme as ThemeMode)) out.theme = raw.theme as ThemeMode
  if (typeof raw.port === 'number' && Number.isInteger(raw.port) && raw.port >= 1024 && raw.port <= 65535) out.port = raw.port
  if (typeof raw.dshHome === 'string') out.dshHome = raw.dshHome
  if (typeof raw.kernelDir === 'string' || raw.kernelDir === null) out.kernelDir = raw.kernelDir as string | null
  if (typeof raw.nodePath === 'string' || raw.nodePath === null) out.nodePath = raw.nodePath as string | null
  if (typeof raw.useMirror === 'boolean') out.useMirror = raw.useMirror
  if (typeof raw.autoStart === 'boolean') out.autoStart = raw.autoStart
  if (typeof raw.closeToTray === 'boolean') out.closeToTray = raw.closeToTray
  if (typeof raw.activeProfile === 'string' && raw.activeProfile.length > 0) out.activeProfile = raw.activeProfile
  if (typeof raw.ideRoot === 'string') out.ideRoot = raw.ideRoot
  if (typeof raw.formatOnSave === 'boolean') out.formatOnSave = raw.formatOnSave
  return out
}

/** JSON 文件设置存储：读时合并默认值，写时临时文件 + 原子改名。 */
export class SettingsService {
  private data: AppSettings
  private listeners = new Set<(settings: AppSettings) => void>()

  constructor(private readonly paths: AppPaths) {
    this.data = defaultSettings(paths)
  }

  load(): AppSettings {
    try {
      const text = fs.readFileSync(this.paths.settingsFile, 'utf8')
      this.data = sanitizeSettings(JSON.parse(text), this.paths)
    } catch {
      this.data = defaultSettings(this.paths)
    }
    return this.data
  }

  get(): AppSettings {
    return { ...this.data }
  }

  patch(partial: Partial<AppSettings>): AppSettings {
    this.data = sanitizeSettings({ ...this.data, ...partial }, this.paths)
    this.save()
    for (const listener of this.listeners) listener(this.get())
    return this.get()
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.paths.settingsFile), { recursive: true })
    const tmp = this.paths.settingsFile + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2))
    fs.renameSync(tmp, this.paths.settingsFile)
  }

  /** 生效的 DSH_HOME：空串回落到桌面端默认数据目录（与系统 ~/.dsh 隔离）。 */
  effectiveDshHome(): string {
    return this.data.dshHome === '' ? this.paths.dshHomeDefault : this.data.dshHome
  }

  onChange(listener: (settings: AppSettings) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
