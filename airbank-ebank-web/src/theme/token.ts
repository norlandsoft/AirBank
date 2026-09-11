import type { ThemeConfig } from 'antd';

/** AirBank 网银品牌主题：现代青绿（由 docs/design/10 的 #0E8A8A 现代化提亮） */
export const BRAND_COLOR = '#0D9488';
export const BRAND_DEEP_COLOR = '#0F766E';
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
    colorTextBase: '#1C2B2A',
    colorBgLayout: '#F3F7F6',
    colorBorderSecondary: '#EDF2F1',
    borderRadius: 8,
    borderRadiusLG: 12,
    fontFamily: FONT_STACK,
    fontSize: 13.5,
    boxShadowSecondary:
      '0 6px 16px rgba(15, 60, 56, 0.08), 0 12px 40px rgba(15, 60, 56, 0.12)',
  },
  components: {
    Layout: {
      headerBg: 'rgba(255, 255, 255, 0.86)',
      bodyBg: '#F3F7F6',
      footerBg: 'transparent',
      headerHeight: 60,
    },
    Menu: {
      itemBorderRadius: 8,
      itemMarginInline: 8,
      itemHeight: 38,
      itemSelectedColor: BRAND_COLOR,
      itemSelectedBg: 'rgba(13, 148, 136, 0.09)',
      activeBarBorderWidth: 0,
      horizontalItemSelectedColor: BRAND_COLOR,
    },
    Card: {
      headerFontSize: 14.5,
      paddingLG: 20,
    },
    Table: {
      headerBg: '#F5F9F8',
      headerColor: '#5A6F6C',
      headerSplitColor: 'transparent',
      rowHoverBg: '#F0F9F7',
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
    Tabs: {
      titleFontSize: 14,
    },
    Modal: {
      titleFontSize: 15.5,
    },
    Descriptions: {
      labelColor: '#5A6F6C',
    },
  },
};
