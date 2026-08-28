/**
 * 斜杠命令提交决策（纯函数，无 React/bridge 依赖，可单测）。
 * 语义对齐 dsh web 输入机（web-input-machine-and-slash-pipeline）：
 * 以 / 开头的提交先经 commands/execute 裁决，未命中（undefined）才作为普通消息发给模型。
 */

/** 文本是否应按斜杠命令裁决（/ 开头的非空行）。 */
export function isSlashCommand(text: string): boolean {
  return text.startsWith('/') && text.length > 1
}

/**
 * 起始页（无活动会话）的 /permission 草稿解析：
 * 命令执行需要会话（agentId），会话尚未创建时把预设名存为草稿，
 * 随首条消息创建会话后经 commands/execute 应用（与 AccessPicker 起始态写 draftAccess 一致）。
 * 仅匹配完整的 "/permission <preset>"；"/permission" 裸命令或其它命令返回 null（走正常建会话流程）。
 */
export function permissionDraft(text: string): string | null {
  const match = /^\/permission\s+(\S+)\s*$/.exec(text)
  return match ? match[1] : null
}

/** 组合默认权限预设值（bundle/base cordis.patch.yml 三档）。 */
export const KNOWN_PERMISSION_PRESETS = ['read-only', 'workspace-write', 'danger-full-access'] as const
