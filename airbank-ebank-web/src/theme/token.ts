import type { ThemeConfig } from 'antd';

/** AirBank 网银品牌主题：清新青绿 #0E8A8A（docs/design/10 §2） */
export const BRAND_COLOR = '#0E8A8A';

export const brandTheme: ThemeConfig = {
  token: {
    colorPrimary: BRAND_COLOR,
    colorInfo: BRAND_COLOR,
    colorLink: BRAND_COLOR,
    borderRadius: 6,
    fontSize: 14,
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 56,
      bodyBg: '#f0f5f5',
      footerBg: 'transparent',
    },
    Menu: {
      itemSelectedColor: BRAND_COLOR,
      itemSelectedBg: 'rgba(14, 138, 138, 0.08)',
    },
    Card: {
      headerFontSize: 15,
    },
  },
};
