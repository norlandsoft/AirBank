import { InputNumber, Typography } from 'antd';
import type { CSSProperties } from 'react';
import { rmbUppercase } from '../utils/money';

interface Props {
  value?: number | null;
  onChange?: (v: number | null) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
  style?: CSSProperties;
}

/** 金额输入（元，两位小数，千分位；联动人民币大写，柜面凭证风格） */
export default function MoneyInput({
  value,
  onChange,
  min = 0.01,
  max,
  placeholder = '请输入金额（元）',
  disabled,
  style,
}: Props) {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : null;
  return (
    <div style={style}>
      <InputNumber<number>
        style={{ width: '100%' }}
        value={num}
        onChange={(v) => onChange?.(typeof v === 'number' ? v : null)}
        min={min}
        max={max}
        precision={2}
        step={100}
        placeholder={placeholder}
        disabled={disabled}
        addonBefore="¥"
        formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        parser={(displayValue) => ((displayValue ?? '').replace(/[^\d.-]/g, '') || '0') as unknown as number}
      />
      {num !== null && num > 0 && (
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'inline-block', marginTop: 2 }}>
          大写：{rmbUppercase(num)}
        </Typography.Text>
      )}
    </div>
  );
}
