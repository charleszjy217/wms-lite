# SSO 用户登录 — 接口契约

> **文档版本:** 1.0.0  
> **链路编号:** LK-003  
> **方向:** 双向 (BIDIRECTIONAL)  
> **触发方式:** 用户交互 (WEBHOOK/MANUAL)  
> **最后更新:** 2026-07-04

---

## 1. 概述

对接外部 OIDC/OAuth2 身份提供者（沙箱），实现单点登录（SSO）。用户通过 SSO 登录后，系统自动创建或匹配本地 User 记录。

### 1.1 架构位置

```
[浏览器/客户端]
    │
    ├── 1. 重定向至 IDP ──────────────────────────────→ [OIDC 身份提供者]
    │                                                         │
    │  ←─── 2. 授权码回调 ────────────────────────────────── │
    │                                                         │
    ▼                                                         │
[SsoLoginLink] ←── 3. 交换 Token ────────────────
    │
    ├── 4. 验证 ID Token (JWT)
    ├── 5. 查询/创建本地 User 记录
    ├── 6. 颁发本地 JWT
    └── 7. 返回 session
```

### 1.2 身份提供者信息

| 属性 | 值 (沙箱) |
|------|-----------|
| Provider | `sandbox-idp.example.com` |
| Authorization Endpoint | `https://sandbox-idp.example.com/oauth/authorize` |
| Token Endpoint | `https://sandbox-idp.example.com/oauth/token` |
| JWKS Endpoint | `https://sandbox-idp.example.com/oauth/jwks` |
| UserInfo Endpoint | `https://sandbox-idp.example.com/oauth/userinfo` |

> **注:** 所有端点 URL 通过环境变量注入，严禁硬编码。

---

## 2. 认证流程

### 2.1 获取授权 URL

```
GET /api/v1/auth/sso/authorize?redirectUri={redirectUri}
```

**响应 (200 OK):**

```json
{
  "authorizationUrl": "https://sandbox-idp.example.com/oauth/authorize?response_type=code&client_id={clientId}&redirect_uri={redirectUri}&scope=openid+profile+email&state={state}"
}
```

### 2.2 登录回调 (Token 交换)

```
POST /api/v1/auth/sso/callback
Content-Type: application/json

{
  "code": "auth_code_from_idp",
  "redirectUri": "https://myapp.example.com/auth/callback",
  "state": "state_parameter"
}
```

---

## 3. 响应

### 3.1 登录成功 (200 OK)

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "refreshToken": "ref_abc123...",
    "user": {
      "id": "uuid-local-user",
      "username": "john.doe@sso",
      "email": "john.doe@company.com",
      "displayName": "John Doe",
      "roles": ["OPERATOR"]
    },
    "isNewUser": false
  }
}
```

### 3.2 通用错误响应

```json
{
  "code": 40001,
  "message": "授权码无效或已过期",
  "traceId": "req-abc-123"
}
```

### 3.3 错误码

| 错误码 | 说明 |
|:------:|------|
| 0 | 成功 |
| 40001 | 授权码无效或已过期 |
| 40002 | ID Token 验证失败 |
| 40003 | State 参数不匹配 (CSRF 防护) |
| 40004 | 用户邮箱已被其他账号绑定 |
| 50001 | 身份提供者不可达 |
| 50002 | Token 端点调用失败 |

---

## 4. 用户匹配逻辑

### 4.1 匹配策略

1. 从 ID Token 的 `sub` 或 `email` 声明中提取用户标识
2. 按优先级查找本地 User:
   - 查询 `email` 匹配
   - 查询 `username` 匹配 (格式: `{sub}@{provider}`)
3. 若匹配到:
   - 更新用户的上次登录时间、SSO 关联信息
4. 若未匹配到:
   - 创建新 User 记录
   - 用户名格式: `{email_local_part}@{provider}`
   - 分配默认角色 `OPERATOR`
   - 生成随机密码（用户不通过密码登录）

### 4.2 本地用户数据结构

```json
{
  "username": "john.doe@okta-sandbox",
  "email": "john.doe@company.com",
  "displayName": "John Doe",
  "status": "ACTIVE",
  "ssoProvider": "okta-sandbox",
  "ssoSubject": "00uid1b2c3d4e5f6a7b8c"
}
```

---

## 5. ID Token 验证

### 5.1 验证步骤

1. 解码 JWT header 获取 `kid`
2. 从 JWKS 端点获取公钥
3. 验证 JWT 签名
4. 验证 `iss` (issuer) 声明
5. 验证 `aud` (audience) 声明
6. 验证 `exp` (过期时间) 声明
7. 验证 `nonce` (若存在)

### 5.2 所需 Scope

| Scope | 说明 |
|-------|------|
| `openid` | 必需，OIDC 核心 scope |
| `profile` | 获取 displayName, 头像等 |
| `email` | 获取用户邮箱 |

---

## 6. 配置参考

```env
# OAuth2 / OIDC 配置
INTEGRATION_SSO_PROVIDER=sandbox-idp
INTEGRATION_SSO_CLIENT_ID=sandbox-client-id
INTEGRATION_SSO_CLIENT_SECRET=sandbox-client-secret
INTEGRATION_SSO_AUTHORIZE_URL=https://sandbox-idp.example.com/oauth/authorize
INTEGRATION_SSO_TOKEN_URL=https://sandbox-idp.example.com/oauth/token
INTEGRATION_SSO_JWKS_URL=https://sandbox-idp.example.com/oauth/jwks
INTEGRATION_SSO_USERINFO_URL=https://sandbox-idp.example.com/oauth/userinfo
INTEGRATION_SSO_ISSUER=https://sandbox-idp.example.com
INTEGRATION_SSO_SCOPES=openid,profile,email

# 本地 JWT
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=1d

# 默认角色
INTEGRATION_SSO_DEFAULT_ROLE=OPERATOR
```

---

## 7. 安全注意事项

- 使用 PKCE (Proof Key for Code Exchange) 防止授权码拦截
- `state` 参数防 CSRF 攻击
- 严格验证 ID Token 签名和所有声明
- 令牌不过日志
- 沙箱和生产使用不同的 OAuth2 客户端配置
