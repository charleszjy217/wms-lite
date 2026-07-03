import client from './client';

/* ------------------------------------------------------------------ */
/*  类型定义                                                            */
/* ------------------------------------------------------------------ */

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    roles: string[];
  };
}

/* ------------------------------------------------------------------ */
/*  Auth API                                                           */
/* ------------------------------------------------------------------ */

export const authApi = {
  /** POST /api/auth/login — 登录获取 JWT */
  login: (data: LoginRequest) =>
    client.post<LoginResponse>('/auth/login', data),
};
