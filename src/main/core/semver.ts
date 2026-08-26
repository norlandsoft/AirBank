/** 轻量版本比较：仅主/次/修订三段数字，预发布段按字典序劣后处理。 */
export function parseVersion(version: string): [number, number, number] {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (!match) return [0, 0, 0]
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let index = 0; index < 3; index++) {
    if (pa[index] !== pb[index]) return pa[index] - pb[index]
  }
  return 0
}

/** dsh 引擎要求：^22.19.0 || >=24.0.0。 */
export function nodeVersionSupported(version: string): boolean {
  const [major, minor] = parseVersion(version)
  if (major === 22) return minor >= 19
  return major >= 24
}
