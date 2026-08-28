/**
 * 起始页工作目录选择的纯逻辑（无 React/bridge 依赖，可单测）。
 * 语义与原 CwdPicker 弹层一致：最近目录去重截取、~ 缩写、空白输入回落默认目录。
 */

/** 最近工作目录：按会话清单顺序去重（清单即新近顺序），截前 limit 条。 */
export function recentCwds(sessions: readonly { cwd?: string }[], limit = 8): string[] {
  return [...new Set(sessions.map((s) => s.cwd).filter((c): c is string => Boolean(c)))].slice(0, limit)
}

/** home 前缀缩写为 ~（/Users/x 或 /home/x）。 */
export function homeShorten(cwd: string): string {
  return cwd.replace(/^\/(?:Users|home)\/[^/]+/, '~')
}

/** 提交输入框文本：去空白；空串 → null（创建会话时回落内核默认目录）。 */
export function draftCwdFromInput(text: string): string | null {
  return text.trim() || null
}
