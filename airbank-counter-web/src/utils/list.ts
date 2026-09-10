/** 兼容后端列表三种返回形态：数组 / {list} / {records} / {rows} */
export function asList<T>(data: T[] | { list?: T[]; records?: T[]; rows?: T[] } | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as { list?: unknown; records?: unknown; rows?: unknown };
    if (Array.isArray(obj.list)) return obj.list as T[];
    if (Array.isArray(obj.records)) return obj.records as T[];
    if (Array.isArray(obj.rows)) return obj.rows as T[];
  }
  return [];
}

/** 任意值 → 可展示字符串 */
export function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
