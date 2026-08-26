import fs from 'node:fs'
import path from 'node:path'
import type { SettingsService } from './settings'
import { isValidProfileName } from '../core/args'
import type { ProfileInfo } from '../../shared/types'

/** web 模板 bundles，与 dsh-app-boot PROFILE_TEMPLATES.web 一致。 */
export const WEB_PROFILE_BUNDLES = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']

const PROFILE_PATCH_TEMPLATE = `# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; \`!!js\` expressions allowed).
[]
`

const PROFILE_PNPM_WORKSPACE = `packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false
`

/** 按官方 initProfile 形态初始化档案目录（已有文件不覆盖，与 CLI 产物互通）。 */
export function initProfile(dir: string, name: string, bundles: readonly string[] = WEB_PROFILE_BUNDLES): void {
  fs.mkdirSync(dir, { recursive: true })
  const manifestPath = path.join(dir, 'package.json')
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(manifestPath, JSON.stringify({
      name: `dsh-profile-${name}`,
      private: true,
      dependencies: {},
      dsh: { profile: { bundles: [...bundles] } },
    }, null, 2) + '\n')
  }
  const patchPath = path.join(dir, 'cordis.patch.yml')
  if (!fs.existsSync(patchPath)) fs.writeFileSync(patchPath, PROFILE_PATCH_TEMPLATE)
  const workspacePath = path.join(dir, 'pnpm-workspace.yaml')
  if (!fs.existsSync(workspacePath)) fs.writeFileSync(workspacePath, PROFILE_PNPM_WORKSPACE)
}

/** 档案 = $DSH_HOME/profiles/<name> 的 dsh profile；新建为 web 模板，首启即可用。 */
export class ProfileService {
  constructor(private readonly settings: SettingsService) {}

  private profilesRoot(): string {
    return path.join(this.settings.effectiveDshHome(), 'profiles')
  }

  list(): ProfileInfo[] {
    const active = this.settings.get().activeProfile
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(this.profilesRoot(), { withFileTypes: true })
    } catch {
      return []
    }
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
      .map((entry) => ({ name: entry.name, dir: path.join(this.profilesRoot(), entry.name), active: entry.name === active }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  create(name: string): ProfileInfo[] {
    const trimmed = name.trim()
    if (!isValidProfileName(trimmed)) throw new Error(`invalid profile name: ${trimmed}`)
    initProfile(path.join(this.profilesRoot(), trimmed), trimmed)
    return this.list()
  }

  remove(name: string): ProfileInfo[] {
    if (name === this.settings.get().activeProfile) throw new Error('cannot remove the active profile')
    fs.rmSync(path.join(this.profilesRoot(), name), { recursive: true, force: true })
    return this.list()
  }

  activate(name: string): ProfileInfo[] {
    if (!this.list().some((profile) => profile.name === name)) throw new Error(`profile not found: ${name}`)
    this.settings.patch({ activeProfile: name })
    return this.list()
  }
}
