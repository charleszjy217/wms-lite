# 集成端点配置指南

> 最后更新: 2026-07-04  
> 对应模块: `integrations/` 集成框架

---

## 目录

1. [概述](#1-概述)
2. [架构说明](#2-架构说明)
3. [环境区分：沙箱 vs 生产](#3-环境区分沙箱-vs-生产)
4. [认证方式](#4-认证方式)
5. [端点配置](#5-端点配置)
6. [参考集成链路](#6-参考集成链路)
7. [密钥配置](#7-密钥配置)
8. [切换环境检查清单](#8-切换环境检查清单)

---

## 1. 概述

系统集成层采用 **配置驱动 + 可插拔 Connector** 架构。每个外部系统对应一个端点配置，通过声明式配置定义：

- 传输协议（HTTP / AMQP / SFTP 等）
- 认证方式（API Key / OAuth2 / mTLS 等）
- 数据格式（JSON / XML / CSV 等）
- 同步方向（入站 / 出站 / 双向）
- 触发方式（定时 / Webhook / 手动）
- 可靠性策略（重试 / 熔断 / 死信队列）

**核心原则**: 新增一个已支持协议的端点只需修改配置，不修改代码。

---

## 2. 架构说明

```
┌──────────────────────┐
│  集成链路 (Wiring)    │ ← 预定义集成场景（主数据同步/财务推送/SSO）
│  ┌────────────────┐  │
│  │  ACL 防腐层     │  │ ← 字段映射 External ↔ Canonical
│  └────────────────┘  │
└─────────┬────────────┘
          │ 调用
┌─────────▼────────────┐
│  Connector 插件层     │ ← 传输协议实现（HTTP/AMQP/SFTP）
│  ConnectorRegistry   │ ← 全局注册表
└─────────┬────────────┘
          │ 配置驱动
┌─────────▼────────────┐
│  EndpointConfig      │ ← 运行时配置（YAML/管理API）
│  默认沙箱 → 切生产需确认│
└──────────────────────┘
```

---

## 3. 环境区分：沙箱 vs 生产

### 3.1 环境变量

端点运行环境在 `EndpointConfig.environment` 字段中指定：

```typescript
type Environment = 'PRODUCTION' | 'STAGING' | 'SANDBOX' | 'DEVELOPMENT';
```

### 3.2 沙箱环境

| 属性 | 值 |
|------|-----|
| `environment` | `SANDBOX` |
| `baseUrl` | `https://erp-sandbox.example.com` |
| 数据 | 沙箱/测试数据 |
| 影响范围 | 不影响生产业务 |
| 变更确认 | 无需审批 |

### 3.3 生产环境

| 属性 | 值 |
|------|-----|
| `environment` | `PRODUCTION` |
| `baseUrl` | `https://erp.production.example.com` |
| 数据 | 生产真实数据 |
| 影响范围 | 直接影响库存、订单等核心业务数据 |
| 变更确认 | **需要人工确认**（见 §8） |

### 3.4 默认行为

- **所有端点新建时默认指向沙箱环境**
- 从沙箱切换到生产环境需通过管理界面或配置变更**显式确认**
- 配置中的 `requireConfirm: true` 强制切生产时二次确认

---

## 4. 认证方式

系统支持以下认证适配器，通过 `AuthConfig.type` 选择：

### 4.1 API Key

```typescript
{
  auth: {
    type: 'api-key',
    credentials: {
      apiKey: '${INTEGRATION_ERP_API_KEY}',   // 从环境变量读取
      headerName: 'X-API-Key'                  // 自定义请求头名称
    }
  }
}
```

### 4.2 Bearer Token

```typescript
{
  auth: {
    type: 'bearer',
    credentials: {
      token: '${INTEGRATION_ERP_API_KEY}'      // 静态 Bearer Token
    }
  }
}
```

### 4.3 OAuth2 (Client Credentials)

```typescript
{
  auth: {
    type: 'oauth2',
    credentials: {
      tokenUrl: 'https://auth.example.com/oauth/token',
      clientId: '${INTEGRATION_SSO_CLIENT_ID}',
      clientSecret: '${INTEGRATION_SSO_CLIENT_SECRET}',
      scopes: ['products:read', 'inventory:write']
    }
  }
}
```

### 4.4 Basic Auth

```typescript
{
  auth: {
    type: 'basic',
    credentials: {
      username: '${INTEGRATION_SFTP_USERNAME}',
      password: '${INTEGRATION_SFTP_PASSWORD}'
    }
  }
}
```

### 4.5 mTLS

```typescript
{
  auth: {
    type: 'mtls',
    credentials: {
      certPath: '/etc/secrets/client.crt',
      keyPath: '/etc/secrets/client.key',
      caPath: '/etc/secrets/ca.crt'
    }
  }
}
```

### 4.6 HMAC

```typescript
{
  auth: {
    type: 'hmac',
    credentials: {
      secretKey: '${INTEGRATION_HMAC_SECRET}',
      algorithm: 'sha256',
      headerName: 'X-Signature'
    }
  }
}
```

---

## 5. 端点配置

### 5.1 配置文件格式

每个端点对应一个 YAML 配置文件，存放在 `config/integrations/` 目录：

```yaml
# config/integrations/erp-product-sync.yaml
endpoint:
  id: "erp-product-sync"
  name: "ERP 商品主数据同步"
  description: "从 ERP 系统同步商品基础信息"
  environment: "sandbox"           # sandbox | production
  requireConfirm: true             # 切生产需确认

  transport:
    type: "http"
    options:
      method: "GET"
      headers:
        Accept: "application/json"

  auth:
    type: "bearer"
    credentials:
      token: "${INTEGRATION_ERP_API_KEY}"

  format:
    type: "json"

  direction: "INBOUND"             # INBOUND | OUTBOUND | BIDIRECTIONAL
  trigger: "SCHEDULED"             # MANUAL | SCHEDULED | EVENT | WEBHOOK

  baseUrl: "https://erp-sandbox.example.com"
  timeout: 30000

  retry:
    maxAttempts: 3
    baseDelayMs: 1000
    maxDelayMs: 30000
    jitter: true

  circuitBreaker:
    failureThreshold: 5
    successThreshold: 3
    timeoutMs: 30000
    halfOpenMaxRequests: 3

  enabled: true
```

### 5.2 端点 URL 参考

| 集成场景 | 沙箱 URL | 生产 URL |
|----------|----------|----------|
| ERP 商品同步 | `https://erp-sandbox.example.com/api/v2/products` | `https://erp.production.example.com/api/v2/products` |
| ERP 供应商同步 | `https://erp-sandbox.example.com/api/v2/suppliers` | `https://erp.production.example.com/api/v2/suppliers` |
| 财务库存推送 | `https://finance-sandbox.example.com/api/v1/stock-movements` | `https://finance.production.example.com/api/v1/stock-movements` |
| SSO/OIDC 认证 | `https://sso-sandbox.example.com/oauth/authorize` | `https://sso.production.example.com/oauth/authorize` |

### 5.3 传输协议端点配置

#### HTTP/REST

```yaml
transport:
  type: "http"
  options:
    method: "GET"
    headers:
      Accept: "application/json"
      X-Request-Id: "${idempotencyKey}"
```

#### AMQP/RabbitMQ

```yaml
transport:
  type: "amqp"
  options:
    queue: "wms.inventory.sync"
    exchange: "wms.topic"
    routingKey: "inventory.updated"
    durable: true
```

#### SFTP

```yaml
transport:
  type: "sftp"
  options:
    host: "${INTEGRATION_SFTP_HOST}"
    port: 22
    remotePath: "/inbound/products/"
    filePattern: "products_*.csv"
```

---

## 6. 参考集成链路

### 6.1 主数据同步 (MasterDataSyncLink)

从外部 ERP 系统同步商品和供应商主数据。

```yaml
# 端点配置示例
endpoint:
  id: "erp-product-sync"
  direction: "INBOUND"
  trigger: "SCHEDULED"
  schedule: "*/5 * * * *"   # 每5分钟同步一次
  baseUrl: "https://erp-sandbox.example.com"
  enabled: true
```

### 6.2 库存推送财务 (InventoryPushFinanceLink)

将库存变动实时推送至财务系统。

```yaml
endpoint:
  id: "finance-inventory-push"
  direction: "OUTBOUND"
  trigger: "EVENT"
  baseUrl: "https://finance-sandbox.example.com"
  enabled: true
```

### 6.3 SSO 登录 (SsoLoginLink)

集成企业身份认证系统。

```yaml
endpoint:
  id: "sso-oidc"
  direction: "BIDIRECTIONAL"
  trigger: "WEBHOOK"
  baseUrl: "https://sso-sandbox.example.com"
  enabled: false    # 默认禁用，启用需确认
```

---

## 7. 密钥配置

### 7.1 环境变量命名规范

集成层密钥使用 `INTEGRATION_` 前缀，通过 `EnvSecretStore` 读取：

```typescript
const secrets = new EnvSecretStore('INTEGRATION_');
const apiKey = await secrets.get('ERP_API_KEY');
// 实际读取 process.env['INTEGRATION_ERP_API_KEY']
```

### 7.2 生产环境密钥注入

```
环境变量注入方式（按推荐优先级）:
1. 容器编排平台密钥管理 (K8s Secrets / Docker Secrets)
2. 密钥管理服务 (HashiCorp Vault / AWS Secrets Manager)
3. CI/CD 平台环境变量
4. 加密后的 .env 文件（最低推荐）
```

### 7.3 沙箱 vs 生产密钥分离

```bash
# 沙箱环境
INTEGRATION_ERP_API_KEY=sandbox-api-key-123
INTEGRATION_ERP_API_URL=https://erp-sandbox.example.com

# 生产环境
INTEGRATION_ERP_API_KEY=prod-api-key-456
INTEGRATION_ERP_API_URL=https://erp.production.example.com
```

> **⚠️ 严禁在沙箱和生产环境使用相同的密钥。**

---

## 8. 切换环境检查清单

> 以下为从沙箱切换到生产环境前需要逐项确认的事项。

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | 生产环境端点 URL 已验证 | ping/DNS 可达，SSL 证书有效 |
| 2 | 生产环境 API 密钥已配置 | 与沙箱密钥不同，权限最小化 |
| 3 | 端点配置中 `environment` 已改为 `PRODUCTION` | 二次确认 |
| 4 | 数据映射已验证 | 沙箱测试通过，字段映射无误 |
| 5 | 重试和熔断配置已审阅 | 生产环境阈值适当 |
| 6 | 幂等键机制已启用 | 防止重复处理 |
| 7 | 对应的 ACL 层已通过沙箱测试 | 字段转换、编码映射无误 |
| 8 | 切换后监控告警已配置 | 同步失败能及时告警 |
| 9 | 回滚方案已准备 | 可以快速切回沙箱 |
| 10 | 变更通知已发送 | 相关方已知切换计划和时间窗口 |

> 完整切换清单请参考 [生产切换清单](./production-switch-checklist.md)。

---

## 9. 相关文档

- [环境变量与密钥清单](./env-vars.md) — 密钥配置详情
- [部署步骤](./deployment.md) — 服务部署
- [监控与告警说明](./monitoring.md) — 同步状态监控
- [生产切换清单](./production-switch-checklist.md) — 完整切换检查项
- [架构文档](../../ARCHITECTURE.md) — 集成框架设计详情
