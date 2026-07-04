# 环境变量与密钥清单

> 最后更新: 2026-07-04  
> 对应项目: WMS-lite

---

## 1. 概览

所有环境变量通过 `.env` 文件或容器环境注入。**严禁**将 `.env` 文件提交至版本控制。

项目根目录提供 `.env.example` 作为模板，部署时复制为 `.env` 后修改。

---

## 2. 核心环境变量

### 2.1 数据库 (PostgreSQL)

| 变量名 | 必填 | 默认值 | 说明 | 敏感 |
|--------|------|--------|------|------|
| `POSTGRES_HOST` | ✅ | `localhost` | PostgreSQL 主机地址 | 否 |
| `POSTGRES_PORT` | — | `5432` | PostgreSQL 端口 | 否 |
| `POSTGRES_DB` | ✅ | `wms_lite` | 数据库名称 | 否 |
| `POSTGRES_USER` | ✅ | `wms_user` | 数据库用户 | 否 |
| `POSTGRES_PASSWORD` | ✅ | `wms_pass` | 数据库密码 | **是** |
| `DATABASE_URL` | ✅ | `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}` | Prisma 连接字符串（**生产环境推荐直接设置完整 URL**） | **是** |

> **⚠️ 生产环境**: `DATABASE_URL` 应直接设置为完整连接字符串，避免依赖变量拼接导致解析错误。密码中如有特殊字符需 URL 编码。

### 2.2 后端 (Backend)

| 变量名 | 必填 | 默认值 | 说明 | 敏感 |
|--------|------|--------|------|------|
| `BACKEND_PORT` | — | `3000` | 后端服务监听端口 | 否 |
| `BACKEND_HOST` | — | `0.0.0.0` | 后端服务绑定地址 | 否 |
| `NODE_ENV` | — | `development` | 运行环境 (`development` / `production` / `test`) | 否 |
| `CORS_ORIGIN` | — | `http://localhost:5173` | 允许的 CORS 来源，多个用逗号分隔 | 否 |
| `LOG_LEVEL` | — | `debug` | 日志级别 (`debug` / `info` / `warn` / `error`) | 否 |

### 2.3 前端 (Frontend)

| 变量名 | 必填 | 默认值 | 说明 | 敏感 |
|--------|------|--------|------|------|
| `VITE_API_BASE_URL` | ✅ | `http://localhost:3000/api/v1` | 后端 API 基地址（Vite 构建时注入） | 否 |
| `FRONTEND_PORT` | — | `5173` | 前端开发服务器端口（仅开发模式） | 否 |

> **注意**: 前端为静态资源（Nginx 容器），`VITE_API_BASE_URL` 在构建时写入，生产环境构建前必须设置为正确的 API 地址。

### 2.4 认证与安全

| 变量名 | 必填 | 默认值 | 说明 | 敏感 |
|--------|------|--------|------|------|
| `JWT_SECRET` | **✅** | 无默认值（**必须设置**） | JWT 签名密钥，生产环境建议 256 位随机字符串 | **是** |
| `JWT_EXPIRES_IN` | — | `1d` | JWT 过期时间（如 `7d`、`24h`、`3600s`） | 否 |

> **⚠️ 生产环境**: `JWT_SECRET` 必须设置为高强度随机字符串。推荐: `openssl rand -hex 64`。**严禁**使用 `change-me-in-production` 或任何默认值。

### 2.5 集成层 (Integrations)

| 变量名 | 必填 | 默认值 | 说明 | 敏感 |
|--------|------|--------|------|------|
| `INTEGRATION_ERP_API_KEY` | 按需 | — | ERP 系统 API 密钥 | **是** |
| `INTEGRATION_ERP_API_URL` | 按需 | `https://erp-sandbox.example.com` | ERP 系统 API 地址（默认沙箱） | 否 |
| `INTEGRATION_FINANCE_API_KEY` | 按需 | — | 财务系统 API 密钥 | **是** |
| `INTEGRATION_FINANCE_API_URL` | 按需 | `https://finance-sandbox.example.com` | 财务系统 API 地址（默认沙箱） | 否 |
| `INTEGRATION_SSO_CLIENT_ID` | 按需 | — | SSO/OIDC 客户端 ID | 否 |
| `INTEGRATION_SSO_CLIENT_SECRET` | 按需 | — | SSO/OIDC 客户端密钥 | **是** |
| `INTEGRATION_SSO_ISSUER_URL` | 按需 | — | SSO/OIDC 发行者 URL | 否 |
| `INTEGRATION_RABBITMQ_URL` | 按需 | — | RabbitMQ 连接字符串 | **是** |
| `INTEGRATION_SFTP_HOST` | 按需 | — | SFTP 服务器地址 | 否 |
| `INTEGRATION_SFTP_PORT` | 按需 | `22` | SFTP 端口 | 否 |
| `INTEGRATION_SFTP_USERNAME` | 按需 | — | SFTP 用户名 | **是** |
| `INTEGRATION_SFTP_PASSWORD` | 按需 | — | SFTP 密码（建议使用密钥认证） | **是** |
| `GITHUB_TOKEN` | 按需 | — | GitHub API 令牌（用于某些 CI/CD 场景） | **是** |

> **密钥命名规则**: 集成层密钥使用 `INTEGRATION_` 前缀，通过 `EnvSecretStore` 读取。详见 [集成端点配置指南](./integration-config.md)。

---

## 3. 密钥管理策略

### 3.1 环境分层

| 环境 | 密钥来源 | 说明 |
|------|----------|------|
| 本地开发 (dev) | `.env` 文件 | `.env` 从 `.env.example` 复制，修改敏感字段 |
| 测试环境 (staging) | 容器环境变量 / CI Secrets | CI/CD 平台管理的密钥 |
| 生产环境 (production) | 密钥管理服务 (Vault / AWS Secrets Manager / K8s Secrets) | **严禁**使用 `.env` 文件 |

### 3.2 密钥轮换

| 密钥 | 轮换周期 | 轮换方式 |
|------|----------|----------|
| `JWT_SECRET` | 每 90 天 | 滚动更新：新旧密钥同时接受验证，新发行的 Token 使用新密钥 |
| `POSTGRES_PASSWORD` | 每 180 天 | 需同步更新 `DATABASE_URL`，涉及服务重启 |
| 集成层 API Key | 按外部系统要求 | 通过 `EnvSecretStore` 更新环境变量后重启服务 |

### 3.3 密钥安全规则

1. **不提交**: `.env` 文件、密钥文件、证书文件禁止提交到 Git
2. **不硬编码**: 代码中禁止出现明文密钥或 fallback 默认值
3. **最小权限**: 每个服务只应访问其需要的密钥
4. **审计**: 密钥访问应有日志记录

---

## 4. 环境变量文件模板

### `.env` (本地开发)

```bash
# ============================================================================
# WMS-lite Environment Variables
# ============================================================================
# 复制自 .env.example，修改敏感字段

# --- PostgreSQL ---
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=wms_lite
POSTGRES_USER=wms_user
POSTGRES_PASSWORD=your-strong-password-here
DATABASE_URL=postgresql://wms_user:your-strong-password-here@localhost:5432/wms_lite

# --- Backend ---
BACKEND_PORT=3000
BACKEND_HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# --- Frontend ---
VITE_API_BASE_URL=http://localhost:3000/api/v1
FRONTEND_PORT=5173

# --- Auth (JWT) ---
JWT_SECRET=your-jwt-secret-change-me
JWT_EXPIRES_IN=1d

# --- Logging ---
LOG_LEVEL=debug

# --- Integrations (按需配置) ---
# INTEGRATION_ERP_API_KEY=erp-api-key
# INTEGRATION_ERP_API_URL=https://erp-sandbox.example.com
```

### `.env.production` (生产环境模板)

```bash
# ============================================================================
# WMS-lite Production Environment Variables
# ============================================================================
# 此文件不应直接写入磁盘，应通过密钥管理服务注入

# --- PostgreSQL ---
DATABASE_URL=postgresql://wms_prod:strong-password@db-prod.internal:5432/wms_prod?sslmode=require

# --- Backend ---
BACKEND_PORT=3000
BACKEND_HOST=0.0.0.0
NODE_ENV=production
CORS_ORIGIN=https://wms.example.com,https://admin.wms.example.com
LOG_LEVEL=info

# --- Auth (JWT) ---
JWT_SECRET=<openssl rand -hex 64 的输出>
JWT_EXPIRES_IN=1d

# --- Integrations (生产端点) ---
# INTEGRATION_ERP_API_KEY=<生产环境 ERP API Key>
# INTEGRATION_ERP_API_URL=https://erp.production.example.com
# INTEGRATION_FINANCE_API_KEY=<生产环境财务系统 API Key>
# INTEGRATION_FINANCE_API_URL=https://finance.production.example.com
```

---

## 5. 密钥生成命令参考

```bash
# 生成 JWT_SECRET (64 字节十六进制)
openssl rand -hex 64

# 生成 PostgreSQL 密码 (32 字符随机)
openssl rand -base64 24

# 生成 API Key (32 字符随机)
openssl rand -base64 32
```

---

## 6. 相关文档

- [部署步骤](./deployment.md) — 从零开始部署
- [集成端点配置指南](./integration-config.md) — 集成层端点配置
- [生产切换清单](./production-switch-checklist.md) — 切生产前检查项
- [安全清单](./security-checklist.md) — 安全检查项
