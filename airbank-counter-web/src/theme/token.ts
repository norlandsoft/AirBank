import type { ThemeConfig } from 'antd';

/** 柜面品牌色（稳重蓝） */
export const BRAND_COLOR = '#1B4D92';

/** 培训环境横幅文案 */
export const TRAINING_BANNER =
  'AirBank 柜面工作台 · 培训模拟环境 —— 本系统仅供业务培训与测试演练，非真实资金';

export const brandTheme: ThemeConfig = {
  token: {
    colorPrimary: BRAND_COLOR,
    colorInfo: BRAND_COLOR,
    colorLink: BRAND_COLOR,
    borderRadius: 4,
  },
  components: {
    Menu: {
      itemSelectedBg: '#e8eff8',
      itemSelectedColor: BRAND_COLOR,
    },
    Table: {
      headerBg: '#f2f5fa',
    },
  },
};
