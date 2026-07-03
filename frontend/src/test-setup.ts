import '@testing-library/jest-dom';
import React from 'react';

/**
 * jsdom 未实现 window.matchMedia，而 antd / pro-layout 依赖它
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

/**
 * @ant-design/pro-layout 在 BaseMenu 中使用 setTimeout 内部调度 setState，
 * 测试环境销毁后这些回调因 window 不可访问而抛出 ReferenceError。
 * 全局 mock ProLayout 避免此类未处理错误。
 */
vi.mock('@ant-design/pro-layout', () => ({
  ProLayout: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'pro-layout' }, children),
  PageContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'page-container' }, children),
  RouteContext: {
    Provider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  },
  default: undefined,
}));

