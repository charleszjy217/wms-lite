import type { ThemeConfig } from 'antd';

/**
 * Design Tokens — 基于 ARCHITECTURE.md §3.5
 * 通过 Ant Design ConfigProvider 注入全局
 */
export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: '#1677FF',
    colorSuccess: '#52C41A',
    colorWarning: '#FAAD14',
    colorError: '#FF4D4F',
    colorInfo: '#1677FF',
    borderRadius: 6,
    fontSize: 14,
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Table: {
      headerBg: '#FAFAFA',
      headerBorderRadius: 6,
      rowHoverBg: '#F0F5FF',
    },
    Card: {
      borderRadiusLG: 8,
    },
    Layout: {
      headerBg: '#FFFFFF',
      siderBg: '#001529',
      bodyBg: '#F5F5F5',
    },
  },
};
