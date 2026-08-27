import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 15) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
})

export const IconChat = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
)
export const IconProfiles = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
)
export const IconPlugins = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M10 3.5a1.75 1.75 0 1 1 3.5 0V5h3a1 1 0 0 1 1 1v3h1.5a1.75 1.75 0 1 1 0 3.5H17.5v3a1 1 0 0 1-1 1h-3v1.5a1.75 1.75 0 1 1-3.5 0V16.5H7a1 1 0 0 1-1-1v-3H4.5a1.75 1.75 0 1 1 0-3.5H6V6a1 1 0 0 1 1-1h3V3.5z"/></svg>
)
export const IconCores = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>
)
export const IconLogs = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>
)
export const IconSettings = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
)
export const IconAbout = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
)
export const IconPlay = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/></svg>
)
export const IconStop = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none"/></svg>
)
export const IconRestart = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
)
export const IconExternal = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>
)
export const IconRefresh = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/></svg>
)
export const IconMinimize = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M5 12h14"/></svg>
)
export const IconMaximize = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
)
export const IconClose = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M18 6L6 18M6 6l12 12"/></svg>
)
export const IconPlus = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M12 5v14M5 12h14"/></svg>
)
export const IconTrash = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
)
export const IconSpinner = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest} className="spin"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>
)
export const IconCheck = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M20 6L9 17l-5-5"/></svg>
)
export const IconDownload = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
)
export const IconSidebar = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
)
export const IconLogo = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="var(--accent)" />
    <path d="M7 6.5h4.2c3 0 5.3 2.3 5.3 5.5s-2.3 5.5-5.3 5.5H7v-11zm2.6 2.4v6.2h1.5c1.8 0 2.8-1.3 2.8-3.1s-1-3.1-2.8-3.1h-1.5z" fill="#fff"/>
  </svg>
)
export const IconCode = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
)
export const IconGitBranch = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
)
export const IconServer = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
)
export const IconPipeline = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v3a3 3 0 0 0 3 3h3"/><path d="M13 6h3a2 2 0 0 1 2 2v4"/></svg>
)
export const IconFolder = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
)
export const IconFile = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
)
export const IconSearch = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
)
export const IconCommand = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>
)
export const IconX = ({ size, ...rest }: P) => (
  <svg {...base(size)} {...rest}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
)
