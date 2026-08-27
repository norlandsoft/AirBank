import path from 'node:path'
import { createRequire } from 'node:module'
import type { Logger } from './logger'
import type { WorkspaceService } from './workspace'

export interface FormatResult {
  content: string
  /** 实际发生了格式化（找到格式化器且内容有变化）。 */
  formatted: boolean
  /** 未格式化的原因（无格式化器/不支持的语言），供 UI 静默或提示。 */
  reason?: string
}

/** prettier.format 的最小签名（v3，异步）。 */
interface PrettierLike {
  format(source: string, options: { filepath?: string } & Record<string, unknown>): Promise<string>
  resolveConfig(filePath: string): Promise<Record<string, unknown> | null>
}

/** 应用内置 prettier（dependencies 打包兜底）。 */
async function bundledPrettier(): Promise<PrettierLike> {
  return (await import('prettier')) as unknown as PrettierLike
}

/**
 * 代码格式化服务：项目自身 prettier（node_modules + 配置）优先，应用内置兜底。
 * prettier 以 filepath 选项运行——parser 推断与 .prettierrc 解析全自动。
 * biome 暂不纳入（按平台二进制，打包复杂度高；见设计文档 §4.1 偏差）。
 */
export class FormatService {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly logger: Logger,
  ) {}

  /** 项目 node_modules 里的 prettier（没有则 null）。 */
  private projectPrettier(): PrettierLike | null {
    const root = this.workspace.getRoot()
    if (!root) return null
    try {
      const require = createRequire(path.join(root, 'aircode-require-probe.js'))
      return require('prettier') as PrettierLike
    } catch {
      return null
    }
  }

  async format(rel: string, content: string): Promise<FormatResult> {
    const root = this.workspace.getRoot()
    if (!root) return { content, formatted: false, reason: 'no-workspace' }
    const prettier = this.projectPrettier() ?? await bundledPrettier()
    const abs = path.join(root, rel)
    try {
      const config = await prettier.resolveConfig(abs)
      const out = await prettier.format(content, { filepath: abs, ...(config ?? {}) })
      if (out === content) return { content, formatted: false }
      this.logger.info('format', `formatted ${rel}`)
      return { content: out, formatted: true }
    } catch (error) {
      // 不支持的语言（无 parser 推断）或语法错误：保持原样，不阻塞保存
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn('format', `skip ${rel}: ${message}`)
      return { content, formatted: false, reason: message }
    }
  }
}
