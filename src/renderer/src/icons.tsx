/**
 * 应用图标体系（lucide-react 封装）：统一 strokeWidth 与 size 协议，
 * 导出名保持旧手绘版不变（调用点零改动）。IconLogo 为应用品牌图（resources/icon.svg）。
 */
import type { SVGProps } from 'react'
import {
  Check, Code2, Command, Cpu, Download, ExternalLink, FileText, Folder, GitBranch, Info, Loader2,
  MessageSquare, Minus, PanelLeft, Play, Plus, Puzzle, RefreshCw, RotateCw, ScrollText,
  Search, Server, Settings, Square, Trash2, Users, Workflow, X,
} from 'lucide-react'
import iconUrl from '../assets/icon.svg?url'

type P = SVGProps<SVGSVGElement> & { size?: number }

const make = (Icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>) =>
  function Wrapped({ size = 17, className, ...rest }: P) {
    return <Icon size={size} strokeWidth={1.8} className={className} {...(rest as Record<string, unknown>)} />
  }

export const IconChat = make(MessageSquare)
export const IconProfiles = make(Users)
export const IconPlugins = make(Puzzle)
export const IconCores = make(Cpu)
export const IconLogs = make(ScrollText)
export const IconSettings = make(Settings)
export const IconAbout = make(Info)
export const IconPlay = make(Play)
export const IconStop = make(Square)
export const IconRestart = make(RotateCw)
export const IconExternal = make(ExternalLink)
export const IconRefresh = make(RefreshCw)
export const IconMinimize = make(Minus)
export const IconMaximize = make(Square)
export const IconClose = make(X)
export const IconX = make(X)
export const IconSidebar = make(PanelLeft)
export const IconCode = make(Code2)
export const IconGitBranch = make(GitBranch)
export const IconServer = make(Server)
export const IconPipeline = make(Workflow)
export const IconFolder = make(Folder)
export const IconFile = make(FileText)
export const IconSearch = make(Search)
export const IconCommand = make(Command)
export const IconPlus = make(Plus)
export const IconCheck = make(Check)
export const IconDownload = make(Download)
export const IconTrash = make(Trash2)

/** 加载 Spinner（lucide Loader2 + 旋转动画）。 */
export function IconSpinner({ size = 17 }: { size?: number }) {
  return <Loader2 size={size} strokeWidth={1.8} className="spin" />
}

/** 应用品牌图标（resources/icon.svg，与打包图标同源）。 */
export function IconLogo({ size = 20 }: { size?: number }) {
  return <img src={iconUrl} width={size} height={size} alt="AirCode" style={{ display: 'block', borderRadius: size * 0.18 }} />
}
