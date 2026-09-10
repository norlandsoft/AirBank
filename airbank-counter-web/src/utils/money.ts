/**
 * 金额工具：后端 Long 一律序列化为字符串（单位：分）。
 * 前端展示元、千分位、两位小数；录入元、提交分。
 */

/** 分（string | number）→ 元字符串，千分位 + 两位小数，如 123456 → '1,234.56' */
export function fenToYuan(fen: string | number | null | undefined): string {
  if (fen === null || fen === undefined || fen === '') return '0.00';
  let n: bigint;
  try {
    n = typeof fen === 'number' ? BigInt(Math.round(fen)) : BigInt(String(fen).trim() || '0');
  } catch {
    return '0.00';
  }
  const neg = n < 0n;
  if (neg) n = -n;
  const yuan = n / 100n;
  const frac = (n % 100n).toString().padStart(2, '0');
  const yuanStr = yuan.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${yuanStr}.${frac}`;
}

/** 分（string | number）→ 元数值（用于 InputNumber 初值等） */
export function fenToYuanNumber(fen: string | number | null | undefined): number {
  return Number(fenToYuan(fen).replace(/,/g, ''));
}

/** 元（string | number，可含千分位逗号）→ 分字符串 */
export function yuanToFen(input: string | number | null | undefined): string {
  if (input === null || input === undefined || input === '') return '0';
  let s = String(input).trim().replace(/,/g, '');
  if (!s || !/^-?\d*(\.\d*)?$/.test(s)) return '0';
  const neg = s.startsWith('-');
  if (s.startsWith('-') || s.startsWith('+')) s = s.slice(1);
  if (s === '' || s === '.') return '0';
  let [int = '0', frac = ''] = s.split('.');
  int = int.replace(/^0+(?=\d)/, '');
  frac = (frac + '00').slice(0, 2);
  const fenVal = BigInt(int || '0') * 100n + BigInt(frac || '0');
  return `${neg ? '-' : ''}${fenVal.toString()}`;
}

const CHN_DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
const CHN_UNITS = ['', '拾', '佰', '仟'];
const CHN_GROUPS = ['', '万', '亿', '兆'];

function fourDigitToChinese(n: number): string {
  if (n === 0) return '';
  let out = '';
  const digits = [Math.floor(n / 1000), Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10];
  for (let i = 0; i < 4; i++) {
    const d = digits[i];
    if (d === 0) {
      if (out && !out.endsWith('零')) out += '零';
    } else {
      out += CHN_DIGITS[d] + CHN_UNITS[3 - i];
    }
  }
  return out.endsWith('零') ? out.slice(0, -1) : out;
}

function intToChinese(numStr: string): string {
  const s = numStr.replace(/^0+(?=\d)/, '');
  if (!s || s === '0') return '零';
  const groups: string[] = [];
  for (let i = s.length; i > 0; i -= 4) groups.unshift(s.slice(Math.max(0, i - 4), i));
  let out = '';
  groups.forEach((g, idx) => {
    const groupUnit = CHN_GROUPS[groups.length - 1 - idx] ?? '';
    const words = fourDigitToChinese(Number(g));
    if (words) {
      if (out && Number(g) < 1000) out += '零';
      out += words + groupUnit;
    }
  });
  return out;
}

/** 元 → 人民币大写（柜面凭证风格），如 1234.50 → '壹仟贰佰叁拾肆元伍角' */
export function rmbUppercase(input: string | number | null | undefined): string {
  if (input === null || input === undefined || input === '') return '';
  const fenStr = yuanToFen(input);
  const neg = fenStr.startsWith('-');
  let n = BigInt(fenStr.replace('-', ''));
  if (n === 0n) return '零元整';
  const jiao = Number((n % 100n) / 10n);
  const fenDigit = Number(n % 10n);
  n = n / 100n;
  let result = '';
  if (n > 0n) result = intToChinese(n.toString()) + '元';
  if (jiao === 0 && fenDigit === 0) {
    result += '整';
  } else {
    if (jiao > 0) result += CHN_DIGITS[jiao] + '角';
    else if (fenDigit > 0) result += '零';
    if (fenDigit > 0) result += CHN_DIGITS[fenDigit] + '分';
  }
  return (neg ? '负' : '') + result;
}
