# 主数据入站同步 — 接口契约

> **文档版本:** 1.0.0  
> **链路编号:** LK-001  
> **方向:** 入站 (INBOUND)  
> **触发方式:** 定时轮询 (SCHEDULED)  
> **最后更新:** 2026-07-04

---

## 1. 概述

从外部 ERP 系统（沙箱端点）同步商品（Product）和供应商（Supplier）主数据到本系统。采用 HTTP/REST 协议，通过 API Key 认证，定时轮询外部接口获取增量数据。

### 1.1 架构位置

```
[外部 ERP 系统]  ──HTTP GET──→  [MasterDataSyncLink]
                                      │
                                      ├─→ FieldMapper (ERP → Canonical)
                                      ├─→ IdempotencyStore (去重)
                                      ├─→ InMemorySyncTaskTracker (状态)
                                      └─→ InMemoryDeadLetterQueue (失败)
```

### 1.2 端点基础 URL

| 环境 | URL |
|------|-----|
| **沙箱 (默认)** | `https://sandbox.erp.example.com/api/v1` |
| 开发 | `http://localhost:9000/api/v1` |
| 生产 | 由运维配置注入 |

> **注:** 端点 URL 通过环境变量 `INTEGRATION_MASTER_DATA_BASE_URL` 注入，严禁硬编码。

---

## 2. 请求

### 2.1 商品同步请求

```
GET {baseUrl}/products?updatedSince={ISO8601}&page={page}&size={size}
```

**请求头:**

| 头名称 | 值 | 必填 |
|--------|-----|:----:|
| `X-API-Key` | `{apiKey}` | 是 |
| `Accept` | `application/json` | 是 |
| `X-Idempotency-Key` | `{syncBatchId}` | 否 |

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `updatedSince` | string (ISO 8601) | 否 | 增量同步时间戳 |
| `page` | integer | 否 | 页码 (默认 1) |
| `size` | integer | 否 | 每页条数 (默认 100, 最大 1000) |

### 2.2 供应商同步请求

```
GET {baseUrl}/suppliers?updatedSince={ISO8601}&page={page}&size={size}
```

请求头与商品同步相同。

---

## 3. 响应

### 3.1 成功响应 (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "ext-prod-001",
        "sku": "MCU-STM32F103",
        "name": "STM32F103C8T6 微控制器",
        "description": "ARM Cortex-M3 内核，72MHz，64KB Flash",
        "category": "电子元器件",
        "categoryPath": "电子产品/电子元器件",
        "brand": "STMicroelectronics",
        "unit": "PCS",
        "barcode": "6901234567890",
        "active": true,
        "specAttributes": [
          { "name": "封装", "value": "LQFP-48", "sortOrder": 1 },
          { "name": "Flash", "value": "64KB", "sortOrder": 2 }
        ],
        "images": [],
        "updatedAt": "2026-07-04T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 100,
      "totalItems": 156,
      "totalPages": 2
    }
  }
}
```

### 3.2 通用错误响应

```json
{
  "code": 40001,
  "message": "认证失败",
  "traceId": "req-abc-123"
}
```

### 3.3 错误码

| 错误码 | 说明 |
|:------:|------|
| 0 | 成功 |
| 40001 | API Key 无效或缺失 |
| 40002 | 请求参数校验失败 |
| 40003 | 请求频率超限 (429) |
| 50001 | 外部系统内部错误 |
| 50002 | 超时 |

---

## 4. 本系统响应说明

### 4.1 同步流程

1. 系统按调度周期（默认每 5 分钟）向外部端点发起 GET 请求
2. 使用 API Key 认证适配器附加 `X-API-Key` 头
3. 对响应数据进行字段映射（FieldMapper）
4. 通过幂等键（`X-Idempotency-Key`）去重
5. 将映射后的规范数据写入本地 Product 表（upsert）
6. 记录同步状态到 SyncTaskTracker

### 4.2 重试策略

| 参数 | 值 |
|------|-----|
| 最大尝试次数 | 3 |
| 基础延迟 | 2s |
| 最大延迟 | 30s |
| 抖动 | 是 |

### 4.3 死信队列

当单条记录连续重试 3 次失败后，自动推入死信队列，留待人工处理。

---

## 5. 配置参考

```env
# 端点 URL（沙箱默认）
INTEGRATION_MASTER_DATA_BASE_URL=https://sandbox.erp.example.com/api/v1

# API Key
INTEGRATION_ERP_API_KEY=sk-sandbox-xxx

# 调度间隔（cron 表达式）
INTEGRATION_MASTER_DATA_SCHEDULE=*/5 * * * *

# 重试配置
INTEGRATION_MASTER_DATA_RETRY_MAX_ATTEMPTS=3
INTEGRATION_MASTER_DATA_RETRY_BASE_DELAY_MS=2000
INTEGRATION_MASTER_DATA_RETRY_MAX_DELAY_MS=30000
```

---

## 6. 安全注意事项

- API Key 通过 SecretStore 获取，不记录日志
- 幂等键防止数据重复处理
- 所有端点超时默认为 30s
- 沙箱和生产使用不同的 API Key
