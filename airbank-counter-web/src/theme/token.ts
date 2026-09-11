import type { ThemeConfig } from 'antd';

/** 柜面品牌色：现代企业蓝 */
export const BRAND_COLOR = '#1668DC';
/** 侧栏深蓝 */
export const NAVY_COLOR = '#0C1C38';
/** 账务语义色：贷记/收入 绿 · 借记/支出 红 · 提醒 琥珀 */
export const MONEY_IN_COLOR = '#16A34A';
export const MONEY_OUT_COLOR = '#DC2626';
export const WARN_COLOR = '#D97706';

/** 全局字体：英文/数字 IBM Plex Mono，中文回退 Source Han Mono SC */
export const FONT_STACK =
  "'IBM Plex Mono', 'Source Han Mono SC', ui-monospace, 'SFMono-Regular', 'PingFang SC', 'Microsoft YaHei', Menlo, Consolas, monospace";

export const brandTheme: ThemeConfig = {
  token: {
    colorPrimary: BRAND_COLOR,
    colorInfo: BRAND_COLOR,
    colorLink: BRAND_COLOR,
    colorTextBase: '#1F2D3D',
    colorBgLayout: '#F4F6FA',
    colorBorderSecondary: '#EEF1F6',
    borderRadius: 6,
    borderRadiusLG: 10,
    fontFamily: FONT_STACK,
    fontSize: 13.5,
    boxShadowSecondary:
      '0 6px 16px rgba(12, 28, 56, 0.08), 0 12px 40px rgba(12, 28, 56, 0.12)',
  },
  components: {
    Layout: {
      bodyBg: '#F4F6FA',
      headerBg: '#ffffff',
      siderBg: NAVY_COLOR,
    },
    Menu: {
      itemBorderRadius: 8,
      itemMarginInline: 10,
      itemHeight: 38,
      darkItemBg: 'transparent',
      darkPopupBg: NAVY_COLOR,
      darkItemColor: 'rgba(255, 255, 255, 0.64)',
      darkItemHoverColor: '#ffffff',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.06)',
      darkItemSelectedColor: '#ffffff',
      darkItemSelectedBg: BRAND_COLOR,
    },
    Card: {
      headerFontSize: 14.5,
      paddingLG: 20,
    },
    Table: {
      headerBg: '#F7F9FC',
      headerColor: '#5B6B84',
      headerSplitColor: 'transparent',
      rowHoverBg: '#F2F7FF',
      cellPaddingBlock: 11,
    },
    Button: {
      fontWeight: 500,
      controlHeight: 32,
    },
    Statistic: {
      contentFontSize: 22,
      titleFontSize: 12.5,
    },
    Tag: {
      borderRadiusSM: 4,
    },
    Alert: {
      defaultPadding: '7px 15px',
    },
    Modal: {
      titleFontSize: 15.5,
    },
    Descriptions: {
      labelColor: '#5B6B84',
    },
  },
};
