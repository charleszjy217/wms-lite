import axios from 'axios';

/** 外部可注册的登出回调，由 AuthProvider 在 mount 时注入 */
let logoutHandler: (() => void) | null = null;

export function setLogoutHandler(handler: () => void) {
  logoutHandler = handler;
}

/**
 * Axios 实例 — 全局 HTTP 客户端
 * - baseURL: 经由 Vite proxy 转发至后端
 * - 请求拦截器: 自动附加 JWT Authorization header
 * - 响应拦截器: 401 时清除 token 并跳转登录页
 */
const client = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      logoutHandler?.();
    }
    return Promise.reject(error);
  },
);

export default client;
