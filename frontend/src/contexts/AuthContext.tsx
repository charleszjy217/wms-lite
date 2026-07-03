import {
  createContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { authApi } from '../api/auth';
import { setLogoutHandler } from '../api/client';

/* ------------------------------------------------------------------ */
/*  类型                                                                */
/* ------------------------------------------------------------------ */

export interface User {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
});

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * 从 localStorage 同步恢复用户态（避免首次渲染闪烁）
 */
function getInitialUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (token && raw) {
      return JSON.parse(raw) as User;
    }
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
  return null;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(getInitialUser);
  const navigate = useNavigate();

  /** 登出：清除令牌 → 跳转登录页 */
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  /** 将登出回调注册到 HTTP 拦截器，供 401 时自动触发 */
  useEffect(() => {
    setLogoutHandler(logout);
  }, [logout]);

  /** 登录：调用后端 API → 存储 JWT → 跳转首页 */
  const login = useCallback(
    async (username: string, password: string) => {
      const res = await authApi.login({ username, password });
      const { accessToken, user: userData } = res.data;

      localStorage.setItem('token', accessToken);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      message.success('登录成功');
      navigate('/', { replace: true });
    },
    [navigate],
  );

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
