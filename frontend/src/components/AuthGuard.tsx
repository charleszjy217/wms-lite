import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { ReactNode } from 'react';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * 路由守卫 — 未认证时重定向到 /login
 * 登录后会自动跳回原始路径（state.from）
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
